const { actions, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  getCurrentMonthBalance,
  getCurrentMonthIncomeStats,
  getCurrentMonthStats,
} = require('../../services/stats.service');
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

function formatIncomeStats(rows) {
  if (rows.length === 0) {
    return 'За текущий месяц доходов пока нет.';
  }

  const totalsByCurrency = new Map();
  const lines = rows.map((row) => {
    const amount = Number(row._sum.amount || 0);
    const total = totalsByCurrency.get(row.currency) || 0;

    totalsByCurrency.set(row.currency, total + amount);

    return `${row.category}: ${formatMoney(amount, row.currency)}`;
  });

  const totalLines = Array.from(totalsByCurrency.entries()).map(([currency, amount]) => {
    return formatMoney(amount, currency);
  });

  return `Доходы за текущий месяц:\n\n${lines.join('\n')}\n\nИтого:\n${totalLines.join('\n')}`;
}

function sumRowsByCurrency(rows, { subtractCashback = false } = {}) {
  const totals = new Map();

  rows.forEach((row) => {
    const amount = Number(row._sum.amount || 0);
    const cashback = subtractCashback ? Number(row._sum.cashback || 0) : 0;
    const value = amount - cashback;

    totals.set(row.currency, (totals.get(row.currency) || 0) + value);
  });

  return totals;
}

function formatBalance({ expenses, incomes }) {
  if (expenses.length === 0 && incomes.length === 0) {
    return 'За текущий месяц операций пока нет.';
  }

  const expenseTotals = sumRowsByCurrency(expenses, { subtractCashback: true });
  const incomeTotals = sumRowsByCurrency(incomes);
  const currencies = Array.from(new Set([...expenseTotals.keys(), ...incomeTotals.keys()])).sort();

  const lines = currencies.map((currency) => {
    const income = incomeTotals.get(currency) || 0;
    const expense = expenseTotals.get(currency) || 0;
    const balance = income - expense;

    return `${currency}: ${formatMoney(balance, currency)} = доходы ${formatMoney(
      income,
      currency
    )} - расходы ${formatMoney(expense, currency)}`;
  });

  return `Баланс за текущий месяц:\n\n${lines.join('\n')}`;
}

async function sendMonthStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getCurrentMonthStats(user.id);

  await ctx.reply(formatStats(stats));
}

async function sendMonthBalance(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const balance = await getCurrentMonthBalance(user.id);

  await ctx.reply(formatBalance(balance));
}

async function sendMonthIncomeStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getCurrentMonthIncomeStats(user.id);

  await ctx.reply(formatIncomeStats(stats));
}

function registerStatsHandlers(bot) {
  bot.command('stats', sendMonthStats);
  bot.command('income', sendMonthIncomeStats);
  bot.command('balance', sendMonthBalance);
  bot.hears(replyLabels.STATS_MONTH, sendMonthStats);

  bot.action(actions.STATS_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthStats(ctx);
  });
}

module.exports = { registerStatsHandlers };
