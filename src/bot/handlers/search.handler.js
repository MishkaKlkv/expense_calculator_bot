const { upsertTelegramUser } = require('../../repositories/user.repository');
const { normalizeSearchQuery, searchUserExpenses } = require('../../services/search.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');

function formatSearchResults(expenses, query) {
  if (expenses.length === 0) {
    return `По запросу "${query}" ничего не нашел.`;
  }

  const lines = expenses.map((expense, index) => {
    return `${index + 1}. ${formatDateTime(expense.expenseDate)} | ${expense.category} | ${
      expense.description
    } | ${formatMoney(expense.amount, expense.currency)}`;
  });

  return `Нашел по запросу "${query}":\n\n${lines.join('\n')}`;
}

async function handleSearchCommand(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const query = normalizeSearchQuery(ctx.message.text);

  if (!query) {
    await ctx.reply('Напишите, что найти. Пример: /search вкусвилл');
    return;
  }

  const expenses = await searchUserExpenses({ userId: user.id, query });
  await ctx.reply(formatSearchResults(expenses, query));
}

function registerSearchHandlers(bot) {
  bot.command('search', handleSearchCommand);
}

module.exports = { registerSearchHandlers };
