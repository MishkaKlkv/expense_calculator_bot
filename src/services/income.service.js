const { createExpense } = require('../repositories/expense.repository');
const { parseExpenseMessage } = require('./parser.service');

function buildPendingIncomeFromMessage({ category, messageText }) {
  const parsed = parseExpenseMessage(messageText);

  if (!parsed) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }

  return {
    ok: true,
    pendingIncome: {
      category,
      description: parsed.description,
      amount: parsed.amount,
      currency: parsed.currency,
    },
  };
}

async function createIncomeFromPending({ user, pendingIncome }) {
  const income = await createExpense({
    userId: user.id,
    telegramUserId: user.telegramUserId,
    type: 'INCOME',
    category: pendingIncome.category,
    description: pendingIncome.description,
    amount: pendingIncome.amount,
    cashback: '0',
    currency: pendingIncome.currency,
    expenseDate: new Date(),
  });

  return { ok: true, income };
}

module.exports = {
  buildPendingIncomeFromMessage,
  createIncomeFromPending,
};
