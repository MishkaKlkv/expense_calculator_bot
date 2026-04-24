const { actions, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { getCurrentMonthStats } = require('../../services/stats.service');
const { formatMoney } = require('../../utils/money');

function formatStats(rows) {
  if (rows.length === 0) {
    return 'За текущий месяц расходов пока нет.';
  }

  const totalsByCurrency = new Map();
  const lines = rows.map((row) => {
    const amount = Number(row._sum.amount || 0);
    const cashback = Number(row._sum.cashback || 0);
    const netAmount = amount - cashback;
    const total = totalsByCurrency.get(row.currency) || {
      amount: 0,
      cashback: 0,
      netAmount: 0,
    };

    total.amount += amount;
    total.cashback += cashback;
    total.netAmount += netAmount;
    totalsByCurrency.set(row.currency, total);

    return `${row.category}: ${formatMoney(netAmount, row.currency)} (расходы ${formatMoney(
      amount,
      row.currency
    )}, кешбек ${formatMoney(cashback, row.currency)})`;
  });

  const totalLines = Array.from(totalsByCurrency.entries()).map(([currency, total]) => {
    return `${formatMoney(total.netAmount, currency)} = ${formatMoney(
      total.amount,
      currency
    )} - кешбек ${formatMoney(total.cashback, currency)}`;
  });

  return `Расходы за текущий месяц:\n\n${lines.join('\n')}\n\nИтого:\n${totalLines.join('\n')}`;
}

async function sendMonthStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getCurrentMonthStats(user.id);

  await ctx.reply(formatStats(stats));
}

function registerStatsHandlers(bot) {
  bot.command('stats', sendMonthStats);
  bot.hears(replyLabels.STATS_MONTH, sendMonthStats);

  bot.action(actions.STATS_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthStats(ctx);
  });
}

module.exports = { registerStatsHandlers };
