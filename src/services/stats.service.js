const {
  aggregateExpensesByCategory,
  findRecentExpenses,
} = require('../repositories/expense.repository');
const { getCurrentMonthRange } = require('../utils/date');

async function getCurrentMonthStats(userId) {
  const { start, end } = getCurrentMonthRange();

  return aggregateExpensesByCategory({ userId, start, end });
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
  getCurrentMonthStats,
  getCurrentMonthStatsForUsers,
  getRecentExpenses,
  getRecentExpensesForUsers,
};
