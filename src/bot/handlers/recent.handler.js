const { actions, recentExpensesKeyboard, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { getRecentExpenses } = require('../../services/stats.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');

const RECENT_EXPENSES_PAGE_SIZE = 10;

function normalizeOffset(value) {
  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function formatRecentExpenses(expenses, offset = 0) {
  if (expenses.length === 0) {
    return offset > 0 ? 'Больше трат пока нет.' : 'Последних трат пока нет.';
  }

  const lines = expenses.map((expense) => {
    return `${formatDateTime(expense.expenseDate)} | ${expense.category} | ${expense.description} | ${formatMoney(
      expense.amount,
      expense.currency
    )}`;
  });

  return `Последние траты:\n\n${lines.join('\n')}`;
}

async function sendRecentExpenses(ctx, offset = 0) {
  const user = await upsertTelegramUser(ctx.from);
  const requestedOffset = normalizeOffset(offset);
  const expenses = await getRecentExpenses(user.id, RECENT_EXPENSES_PAGE_SIZE + 1, requestedOffset);
  const hasNextPage = expenses.length > RECENT_EXPENSES_PAGE_SIZE;
  const pageExpenses = expenses.slice(0, RECENT_EXPENSES_PAGE_SIZE);
  const keyboard = hasNextPage
    ? recentExpensesKeyboard(requestedOffset + RECENT_EXPENSES_PAGE_SIZE)
    : undefined;

  await ctx.reply(formatRecentExpenses(pageExpenses, requestedOffset), keyboard);
}

function registerRecentHandlers(bot) {
  bot.command('recent', sendRecentExpenses);
  bot.hears(replyLabels.RECENT_EXPENSES, sendRecentExpenses);

  bot.action(actions.RECENT_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendRecentExpenses(ctx);
  });

  bot.action(/^RECENT_EXPENSES_NEXT:(\d+)$/u, async (ctx) => {
    await ctx.answerCbQuery();
    await sendRecentExpenses(ctx, ctx.match[1]);
  });
}

module.exports = { registerRecentHandlers };
