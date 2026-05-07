const { searchExpenses } = require('../repositories/expense.repository');

const SEARCH_LIMIT = 10;

function normalizeSearchQuery(text, command = '/search') {
  return text.replace(command, '').trim();
}

async function searchUserExpenses({ userId, query, limit = SEARCH_LIMIT }) {
  return searchExpenses({ userId, query, limit });
}

module.exports = {
  normalizeSearchQuery,
  searchUserExpenses,
};
