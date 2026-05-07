const { createExpense } = require('../repositories/expense.repository');
const { learnAutoCategoryFromExpense } = require('./autoCategory.service');
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

  try {
    await learnAutoCategoryFromExpense({
      category: expense.category,
      description: expense.description,
    });
  } catch (error) {
    console.error('[auto-category] failed to learn from expense', error);
  }

  return { ok: true, expense };
}

module.exports = {
  buildPendingExpenseFromMessage,
  createExpenseFromPending,
};
