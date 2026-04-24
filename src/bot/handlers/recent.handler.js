const { actions, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { getRecentExpenses } = require('../../services/stats.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');

function formatRecentExpenses(expenses) {
  if (expenses.length === 0) {
    return 'Последних трат пока нет.';
  }

  const lines = expenses.map((expense) => {
    const cashback = Number(expense.cashback || 0);
    const cashbackText = cashback > 0 ? ` | кешбек ${formatMoney(cashback, expense.currency)}` : '';

    return `${formatDateTime(expense.expenseDate)} | ${expense.category} | ${expense.description} | ${formatMoney(
      expense.amount,
      expense.currency
    )}${cashbackText}`;
  });

  return `Последние траты:\n\n${lines.join('\n')}`;
}

async function sendRecentExpenses(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const expenses = await getRecentExpenses(user.id);

  await ctx.reply(formatRecentExpenses(expenses));
}

function registerRecentHandlers(bot) {
  bot.command('recent', sendRecentExpenses);
  bot.hears(replyLabels.RECENT_EXPENSES, sendRecentExpenses);

  bot.action(actions.RECENT_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendRecentExpenses(ctx);
  });
}

module.exports = { registerRecentHandlers };
