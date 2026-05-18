const {
  aggregateExpensesByCategory,
  aggregateTransactionsByCategory,
  findExpensesInRange,
  findRecentExpenses,
} = require('../repositories/expense.repository');
const { getCurrentMonthRange, getPreviousMonthRange } = require('../utils/date');

const DAILY_EXPENSES_PAGE_SIZE = 10;

function normalizeOffset(value) {
  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function normalizeScope(scope) {
  if (typeof scope === 'object' && scope !== null) {
    return {
      userId: scope.userId,
      userIds: scope.userIds,
    };
  }

  return { userId: scope };
}

function getMoscowDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyToUtcDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function shiftDateKey(dateKey, days) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMoscowDateRangeForDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0));

  return { start, end };
}

function buildDailyExpenseKeys(now, offset, limit) {
  const latestDateKey = shiftDateKey(getMoscowDateKey(now), -offset);

  return Array.from({ length: limit }, (_, index) => shiftDateKey(latestDateKey, -index));
}

function buildTotalsMap(expenses, dateKeys) {
  const totalsByDate = new Map(dateKeys.map((dateKey) => [dateKey, new Map()]));

  expenses.forEach((expense) => {
    const dateKey = getMoscowDateKey(expense.expenseDate);
    const totals = totalsByDate.get(dateKey);

    if (!totals) {
      return;
    }

    const currency = expense.currency || 'RUB';
    totals.set(currency, (totals.get(currency) || 0) + Number(expense.amount || 0));
  });

  return totalsByDate;
}

async function getCurrentMonthStats(userId) {
  const { start, end } = getCurrentMonthRange();

  return aggregateExpensesByCategory({ userId, start, end });
}

async function getCurrentMonthIncomeStats(userId) {
  const { start, end } = getCurrentMonthRange();

  return aggregateTransactionsByCategory({ userId, start, end, type: 'INCOME' });
}

async function getCurrentMonthBalance(userId) {
  const { start, end } = getCurrentMonthRange();
  return getMonthBalanceForRange({ userId, start, end });
}

async function getPreviousMonthBalance(userId) {
  const { start, end } = getPreviousMonthRange();
  return getMonthBalanceForRange({ userId, start, end });
}

async function getMonthBalanceForRange({ userId, start, end }) {
  const [expenses, incomes] = await Promise.all([
    aggregateTransactionsByCategory({ userId, start, end, type: 'EXPENSE' }),
    aggregateTransactionsByCategory({ userId, start, end, type: 'INCOME' }),
  ]);

  return { expenses, incomes };
}

async function getCurrentMonthStatsForUsers(userIds) {
  const { start, end } = getCurrentMonthRange();

  return aggregateExpensesByCategory({ userIds, start, end });
}

async function getPreviousMonthStatsForUsers(userIds) {
  const { start, end } = getPreviousMonthRange();

  return aggregateExpensesByCategory({ userIds, start, end });
}

async function getRecentExpenses(userId, limit = 10, offset = 0) {
  return findRecentExpenses({ userId, limit, offset });
}

async function getRecentExpensesForUsers(userIds, limit = 10, offset = 0) {
  return findRecentExpenses({ userIds, limit, offset });
}

async function getDailyExpenseTotals(scope, options = {}) {
  const offset = normalizeOffset(options.offset);
  const limit = options.limit || DAILY_EXPENSES_PAGE_SIZE;
  const dateKeys = buildDailyExpenseKeys(options.now || new Date(), offset, limit);
  const newestRange = getMoscowDateRangeForDateKey(dateKeys[0]);
  const oldestRange = getMoscowDateRangeForDateKey(dateKeys[dateKeys.length - 1]);
  const expenses = await findExpensesInRange({
    ...normalizeScope(scope),
    start: oldestRange.start,
    end: newestRange.end,
  });
  const totalsByDate = buildTotalsMap(expenses, dateKeys);

  return dateKeys.map((dateKey) => {
    const totals = Array.from(totalsByDate.get(dateKey).entries())
      .map(([currency, amount]) => ({ amount, currency }))
      .sort((left, right) => left.currency.localeCompare(right.currency));

    return {
      dateKey,
      totals: totals.length > 0 ? totals : [{ amount: 0, currency: 'RUB' }],
    };
  });
}

module.exports = {
  getCurrentMonthBalance,
  getCurrentMonthIncomeStats,
  getCurrentMonthStats,
  getCurrentMonthStatsForUsers,
  getDailyExpenseTotals,
  getPreviousMonthBalance,
  getPreviousMonthStatsForUsers,
  getRecentExpenses,
  getRecentExpensesForUsers,
};
