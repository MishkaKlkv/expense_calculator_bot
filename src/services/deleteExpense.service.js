const {
  deleteExpenseByIdForUser,
  findExpenseByIdForUser,
  findRecentExpenses,
} = require('../repositories/expense.repository');

async function getDeletableExpenses(userId, limit = 10) {
  return findRecentExpenses({ userId, limit });
}

async function getExpenseForDeletion({ expenseId, userId }) {
  return findExpenseByIdForUser({ id: expenseId, userId });
}

async function deleteExpense({ expenseId, userId }) {
  const result = await deleteExpenseByIdForUser({ id: expenseId, userId });

  return {
    ok: result.count === 1,
  };
}

module.exports = {
  deleteExpense,
  getDeletableExpenses,
  getExpenseForDeletion,
};
