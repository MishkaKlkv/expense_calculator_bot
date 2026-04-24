const { deleteExpensesForUser } = require('../repositories/expense.repository');
const { getCurrentMonthRange } = require('../utils/date');

async function clearAllExpenses(userId) {
  const result = await deleteExpensesForUser({ userId });

  return { count: result.count };
}

async function clearCurrentMonthExpenses(userId) {
  const { start, end } = getCurrentMonthRange();
  const result = await deleteExpensesForUser({ userId, start, end });

  return { count: result.count };
}

module.exports = {
  clearAllExpenses,
  clearCurrentMonthExpenses,
};
