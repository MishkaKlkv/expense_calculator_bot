const {
  createPlannedPayment,
  deletePlannedPaymentByIdForUser,
  findPlannedPaymentById,
  findPlannedPayments,
  findReminderEnabledPlannedPayments,
  markPlannedPaymentReminderSent,
  updatePlannedPaymentByIdForUser,
} = require('../repositories/plannedPayment.repository');
const { parseAmountWithCurrency } = require('./parser.service');
const { findUserCategoryName } = require('./category.service');

function parsePlannedPaymentInput(text) {
  const parts = text
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 4) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  const dayOfMonth = Number(parts[0]);
  const amount = parseAmountWithCurrency(parts[3]);

  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    return { ok: false, reason: 'INVALID_DAY' };
  }

  if (!amount) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }

  return {
    ok: true,
    payment: {
      amount: amount.amount,
      category: parts[1],
      currency: amount.currency,
      dayOfMonth,
      description: parts[2],
    },
  };
}

async function addPlannedPayment({ userId, input }) {
  const parsed = parsePlannedPaymentInput(input);

  if (!parsed.ok) {
    return parsed;
  }

  const category = await findUserCategoryName({
    userId,
    type: 'EXPENSE',
    name: parsed.payment.category,
  });

  if (!category) {
    return { ok: false, reason: 'UNKNOWN_CATEGORY' };
  }

  const payment = await createPlannedPayment({
    ...parsed.payment,
    category,
    userId,
  });

  return { ok: true, payment };
}

async function getPlannedPayments(userId) {
  return findPlannedPayments({ userId });
}

async function getEnabledPlannedPayments(userId) {
  return findPlannedPayments({ userId, enabledOnly: true });
}

async function deletePlannedPayment({ userId, id }) {
  const result = await deletePlannedPaymentByIdForUser({ id, userId });

  return { ok: result.count > 0 };
}

async function enablePlannedPaymentReminder({ userId, id }) {
  const result = await updatePlannedPaymentByIdForUser({
    id,
    userId,
    data: {
      reminderEnabled: true,
    },
  });

  return { ok: result.count > 0 };
}

async function disablePlannedPaymentReminder({ userId, id }) {
  const result = await updatePlannedPaymentByIdForUser({
    id,
    userId,
    data: {
      reminderEnabled: false,
    },
  });

  return { ok: result.count > 0 };
}

function getPlannedPaymentDueDate(payment, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(payment.dayOfMonth, lastDay);

  return new Date(year, month, day, 0, 0, 0, 0);
}

function getMoscowParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
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
    daysInMonth: new Date(Number(parts.year), Number(parts.month), 0).getDate(),
    monthKey: `${parts.year}-${parts.month}`,
    time: `${hour}:${parts.minute}`,
  };
}

function isPlannedPaymentReminderDue(payment, date = new Date()) {
  const parts = getMoscowParts(date);
  const dueDay = Math.min(payment.dayOfMonth, parts.daysInMonth);

  return (
    payment.enabled &&
    payment.reminderEnabled &&
    payment.lastReminderSentMonth !== parts.monthKey &&
    dueDay === parts.day &&
    payment.reminderTimeOfDay <= parts.time
  );
}

async function getDuePlannedPaymentReminders(date = new Date()) {
  const payments = await findReminderEnabledPlannedPayments();

  return payments.filter((payment) => isPlannedPaymentReminderDue(payment, date));
}

function getPlannedPaymentsDueInRange(payments, { start, end }) {
  return payments.filter((payment) => {
    const dueDate = getPlannedPaymentDueDate(payment, start);

    return dueDate >= start && dueDate < end;
  });
}

module.exports = {
  addPlannedPayment,
  deletePlannedPayment,
  disablePlannedPaymentReminder,
  enablePlannedPaymentReminder,
  findPlannedPaymentById,
  getDuePlannedPaymentReminders,
  getEnabledPlannedPayments,
  getPlannedPaymentDueDate,
  getPlannedPayments,
  getPlannedPaymentsDueInRange,
  isPlannedPaymentReminderDue,
  markPlannedPaymentReminderSent,
  parsePlannedPaymentInput,
};
