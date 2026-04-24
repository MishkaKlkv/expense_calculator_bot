const { createExpense } = require('../repositories/expense.repository');
const { parseExpenseMessage } = require('./parser.service');

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

async function createExpenseFromPending({ user, pendingExpense }) {
  const expense = await createExpense({
    userId: user.id,
    telegramUserId: user.telegramUserId,
    type: 'EXPENSE',
    category: pendingExpense.category,
    description: pendingExpense.description,
    amount: pendingExpense.amount,
    cashback: '0',
    currency: pendingExpense.currency,
    expenseDate: new Date(),
  });

  return { ok: true, expense };
}

module.exports = {
  buildPendingExpenseFromMessage,
  createExpenseFromPending,
};
