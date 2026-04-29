const { aggregateTransactionsByCategory, findTopExpenses } = require('../repositories/expense.repository');
const { findAllTelegramUsers } = require('../repositories/user.repository');
const {
  findWeeklyReportDelivery,
  markWeeklyReportSent,
} = require('../repositories/weeklyReport.repository');
const { getEnabledPlannedPayments } = require('./plannedPayment.service');
const { getTrackedDaysForRange, shiftDateKey } = require('./gamification.service');
const { formatMoney } = require('../utils/money');

const WEEKLY_REPORT_TIMEZONE = 'Europe/Moscow';
const WEEKLY_REPORT_TIME = '10:00';

function getZonedParts(date = new Date(), timezone = WEEKLY_REPORT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;

  return {
    day: Number(parts.day),
    hour: Number(hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    year: Number(parts.year),
  };
}

function getLocalWeekday(parts) {
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();

  return day === 0 ? 7 : day;
}

function getMoscowDate(parts, dayOffset = 0) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset, 0, 0, 0, 0));
}

function formatDateKeyFromUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function moscowDateToUtc(date, hour = 0, minute = 0) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 3, minute, 0, 0)
  );
}

function getWeeklyReportDueInfo(date = new Date()) {
  const parts = getZonedParts(date);
  const weekday = getLocalWeekday(parts);
  const currentTime = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  const currentMonday = getMoscowDate(parts, 1 - weekday);
  const previousMonday = getMoscowDate(parts, 1 - weekday - 7);

  return {
    currentDate: formatDateKeyFromUtcDate(getMoscowDate(parts)),
    currentTime,
    isDueTime: weekday === 1 && currentTime >= WEEKLY_REPORT_TIME,
    periodEnd: moscowDateToUtc(currentMonday),
    periodStart: moscowDateToUtc(previousMonday),
    timezone: WEEKLY_REPORT_TIMEZONE,
    weekKey: formatDateKeyFromUtcDate(currentMonday),
  };
}

function sumRowsByCurrency(rows) {
  const totals = new Map();

  rows.forEach((row) => {
    totals.set(row.currency, (totals.get(row.currency) || 0) + Number(row._sum.amount || 0));
  });

  return totals;
}

function formatCategoryRows(rows, emptyText) {
  if (rows.length === 0) {
    return [emptyText];
  }

  return rows.map((row) => `${row.category}: ${formatMoney(row._sum.amount || 0, row.currency)}`);
}

function formatTotals(rows) {
  const totals = Array.from(sumRowsByCurrency(rows).entries());

  if (totals.length === 0) {
    return '0 ₽';
  }

  return totals.map(([currency, amount]) => formatMoney(amount, currency)).join(', ');
}

function formatTopExpenses(expenses) {
  if (expenses.length === 0) {
    return ['Крупных расходов не было.'];
  }

  return expenses.map((expense, index) => {
    return `${index + 1}. ${expense.category}: ${expense.description}, ${formatMoney(
      expense.amount,
      expense.currency
    )}`;
  });
}

function getPlannedPaymentDueDate(payment, monthDate) {
  const lastDay = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = Math.min(payment.dayOfMonth, lastDay);

  return new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), day, 0, 0, 0, 0));
}

function getPlannedPaymentsDueInMoscowRange(payments, { start, end }) {
  const startParts = getZonedParts(start);
  const endParts = getZonedParts(new Date(end.getTime() - 1));
  const monthKeys = new Set([
    `${startParts.year}-${startParts.month}`,
    `${endParts.year}-${endParts.month}`,
  ]);

  return payments.flatMap((payment) => {
    return Array.from(monthKeys).flatMap((key) => {
      const [year, month] = key.split('-').map(Number);
      const dueLocalDate = getPlannedPaymentDueDate(payment, new Date(Date.UTC(year, month - 1, 1)));
      const dueAt = moscowDateToUtc(dueLocalDate);

      if (dueAt < start || dueAt >= end) {
        return [];
      }

      return [{ ...payment, dueAt }];
    });
  });
}

async function buildWeeklyReport(userId, date = new Date()) {
  const dueInfo = getWeeklyReportDueInfo(date);
  const [expenses, incomes, topExpenses, plannedPayments] = await Promise.all([
    aggregateTransactionsByCategory({
      userId,
      start: dueInfo.periodStart,
      end: dueInfo.periodEnd,
      type: 'EXPENSE',
    }),
    aggregateTransactionsByCategory({
      userId,
      start: dueInfo.periodStart,
      end: dueInfo.periodEnd,
      type: 'INCOME',
    }),
    findTopExpenses({
      userId,
      start: dueInfo.periodStart,
      end: dueInfo.periodEnd,
      limit: 5,
    }),
    getEnabledPlannedPayments(userId),
  ]);
  const previousWeekStartKey = shiftDateKey(dueInfo.weekKey, -7);
  const trackedDays = await getTrackedDaysForRange({
    userId,
    startDateKey: previousWeekStartKey,
    endDateKey: dueInfo.weekKey,
  });
  const trackedDaysCount = trackedDays.length;
  const trackedDaysXp = trackedDays.reduce((sum, day) => sum + day.xpAwarded, 0);
  const currentWeekEnd = new Date(dueInfo.periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
  const duePayments = getPlannedPaymentsDueInMoscowRange(plannedPayments, {
    start: dueInfo.periodEnd,
    end: currentWeekEnd,
  });
  const plannedLines =
    duePayments.length === 0
      ? ['На этой неделе плановых платежей нет.']
      : duePayments.map((payment) => {
          const day = new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            timeZone: WEEKLY_REPORT_TIMEZONE,
          }).format(payment.dueAt);

          return `${day}: ${payment.category}, ${payment.description}, ${formatMoney(
            payment.amount,
            payment.currency
          )}`;
        });

  return [
    'Еженедельный отчет',
    '',
    'Период: прошлая неделя',
    '',
    `Итого расходов: ${formatTotals(expenses)}`,
    `Итого доходов: ${formatTotals(incomes)}`,
    '',
    'Прогресс учета:',
    `Учтено дней: ${trackedDaysCount} из 7`,
    `XP за учет: +${trackedDaysXp}`,
    '',
    'Расходы по категориям:',
    formatCategoryRows(expenses, 'Расходов не было.').join('\n'),
    '',
    'Доходы по категориям:',
    formatCategoryRows(incomes, 'Доходов не было.').join('\n'),
    '',
    'Крупные расходы:',
    formatTopExpenses(topExpenses).join('\n'),
    '',
    'Плановые платежи на эту неделю:',
    plannedLines.join('\n'),
  ].join('\n');
}

async function getUsersForDueWeeklyReport(date = new Date()) {
  const dueInfo = getWeeklyReportDueInfo(date);

  if (!dueInfo.isDueTime) {
    return { dueInfo, users: [] };
  }

  const users = await findAllTelegramUsers();
  const previousWeekStartKey = shiftDateKey(dueInfo.weekKey, -7);
  const usersWithState = await Promise.all(
    users.map(async (user) => {
      const [delivery, trackedDays] = await Promise.all([
        findWeeklyReportDelivery(user.id),
        getTrackedDaysForRange({
          userId: user.id,
          startDateKey: previousWeekStartKey,
          endDateKey: dueInfo.weekKey,
        }),
      ]);

      return {
        delivery,
        isActive: trackedDays.length > 0,
        user,
      };
    })
  );

  return {
    dueInfo,
    users: usersWithState
      .filter(({ delivery, isActive }) => isActive && delivery?.lastSentWeek !== dueInfo.weekKey)
      .map(({ user }) => user),
  };
}

module.exports = {
  WEEKLY_REPORT_TIME,
  WEEKLY_REPORT_TIMEZONE,
  buildWeeklyReport,
  getWeeklyReportDueInfo,
  getUsersForDueWeeklyReport,
  markWeeklyReportSent,
};
