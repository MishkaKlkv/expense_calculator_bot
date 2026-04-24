const {
  deleteTransactionByIdForUser,
  findRecentTransactions,
  findTransactionByIdForUser,
} = require('../repositories/expense.repository');

async function getDeletableExpenses(userId, limit = 10) {
  return findRecentTransactions({ userId, limit });
}

async function getExpenseForDeletion({ expenseId, userId }) {
  return findTransactionByIdForUser({ id: expenseId, userId });
}

async function deleteExpense({ expenseId, userId }) {
  const result = await deleteTransactionByIdForUser({ id: expenseId, userId });

  return {
    ok: result.count === 1,
  };
}

module.exports = {
  deleteExpense,
  getDeletableExpenses,
  getExpenseForDeletion,
};
