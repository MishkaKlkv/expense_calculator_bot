const { createExpense } = require('../repositories/expense.repository');
const { parseCashbackMessage, parseExpenseMessage } = require('./parser.service');

function buildPendingExpenseFromMessage({ category, messageText }) {
  const parsed = parseExpenseMessage(messageText);

  if (!parsed) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  return {
    ok: true,
    pendingExpense: {
      category,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
    },
  };
}

function parseCashbackForExpense({ messageText, currency, amount }) {
  const parsed = parseCashbackMessage(messageText);

  if (!parsed) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  if (parsed.percent) {
    const cashback = ((Number(amount) * Number(parsed.percent)) / 100).toFixed(2);

    return {
      ok: true,
      cashback,
    };
  }

  if (parsed.currency && parsed.currency !== currency) {
    return { ok: false, reason: 'CURRENCY_MISMATCH' };
  }

  if (Number(parsed.cashback) > Number(amount)) {
    return { ok: false, reason: 'CASHBACK_TOO_HIGH' };
  }

  return {
    ok: true,
    cashback: parsed.cashback,
  };
}

async function createExpenseFromPending({ user, pendingExpense, cashback }) {
  const expense = await createExpense({
    userId: user.id,
    telegramUserId: user.telegramUserId,
    type: 'EXPENSE',
    category: pendingExpense.category,
    description: pendingExpense.description,
    amount: pendingExpense.amount,
    cashback,
    currency: pendingExpense.currency,
    expenseDate: new Date(),
  });

  return { ok: true, expense };
}

module.exports = {
  buildPendingExpenseFromMessage,
  createExpenseFromPending,
  parseCashbackForExpense,
};
