const {
  aggregateExpensesByCategory,
  aggregateTransactionsByCategory,
  findRecentExpenses,
} = require('../repositories/expense.repository');
const { getCurrentMonthRange } = require('../utils/date');

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

async function getRecentExpenses(userId, limit = 10) {
  return findRecentExpenses({ userId, limit });
}

async function getRecentExpensesForUsers(userIds, limit = 10) {
  return findRecentExpenses({ userIds, limit });
}

module.exports = {
  getCurrentMonthBalance,
  getCurrentMonthIncomeStats,
  getCurrentMonthStats,
  getCurrentMonthStatsForUsers,
  getRecentExpenses,
  getRecentExpensesForUsers,
};
