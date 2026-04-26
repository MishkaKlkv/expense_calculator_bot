const { actions, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  getCurrentMonthBalance,
  getCurrentMonthIncomeStats,
  getPreviousMonthBalance,
} = require('../../services/stats.service');
const { buildWeeklyReport } = require('../../services/weeklyReport.service');
const { getAccounts, summarizeAccounts } = require('../../services/account.service');
const { getUsdToRubRate } = require('../../services/exchangeRate.service');
const { formatMoney } = require('../../utils/money');

function formatCategoryRows(rows, emptyText) {
  if (rows.length === 0) {
    return {
      lines: [emptyText],
      totals: [],
    };
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

  return { lines, totals: totalLines };
}

function formatStats({ expenses, incomes }, title = 'Статистика за текущий месяц') {
  if (expenses.length === 0 && incomes.length === 0) {
    return `${title}: операций пока нет.`;
  }

  const expenseStats = formatCategoryRows(expenses, 'Расходов пока нет.');
  const incomeStats = formatCategoryRows(incomes, 'Доходов пока нет.');
  const balanceTotals = subtractTotals(sumRowsByCurrency(incomes), sumRowsByCurrency(expenses));

  return [
    title,
    '',
    `Остаток: ${formatTotalsMap(balanceTotals)}`,
    '',
    'Расходы:',
    expenseStats.lines.join('\n'),
    ...(expenseStats.totals.length > 0 ? ['', `Итого расходов: ${expenseStats.totals.join(', ')}`] : []),
    '',
    'Доходы:',
    incomeStats.lines.join('\n'),
    ...(incomeStats.totals.length > 0 ? ['', `Итого доходов: ${incomeStats.totals.join(', ')}`] : []),
  ].join('\n');
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

function sumRowsByCurrency(rows) {
  const totals = new Map();

  rows.forEach((row) => {
    const amount = Number(row._sum.amount || 0);

    totals.set(row.currency, (totals.get(row.currency) || 0) + amount);
  });

  return totals;
}

function hasUsdTotals(...totalsMaps) {
  return totalsMaps.some((totals) => Number(totals.get('USD') || 0) !== 0);
}

function convertTotalsToRub(totals, usdRate) {
  return Array.from(totals.entries()).reduce((sum, [currency, amount]) => {
    if (currency === 'RUB') {
      return sum + amount;
    }

    if (currency === 'USD') {
      return sum + amount * usdRate.value;
    }

    return sum;
  }, 0);
}

function subtractTotals(incomeTotals, expenseTotals) {
  const result = new Map();
  const currencies = new Set([...incomeTotals.keys(), ...expenseTotals.keys()]);

  currencies.forEach((currency) => {
    result.set(currency, (incomeTotals.get(currency) || 0) - (expenseTotals.get(currency) || 0));
  });

  return result;
}

function formatTotalsMap(totals) {
  const entries = Array.from(totals.entries()).filter(([, amount]) => Number(amount) !== 0);

  if (entries.length === 0) {
    return formatMoney(0, 'RUB');
  }

  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(', ');
}

function formatAccountsSummary(accounts) {
  if (accounts.length === 0) {
    return [
      'Деньги сейчас:',
      'Счета пока не добавлены. Добавить: /account_add Карта | доступно | 150000',
    ].join('\n');
  }

  const summary = summarizeAccounts(accounts);

  return [
    'Деньги сейчас:',
    `Всего: ${formatTotalsMap(summary.TOTAL)}`,
    `Накоплено: ${formatTotalsMap(summary.SAVINGS)}`,
    `Доступно: ${formatTotalsMap(summary.AVAILABLE)}`,
  ].join('\n');
}

async function formatBalance({ expenses, incomes }, accounts = []) {
  if (expenses.length === 0 && incomes.length === 0) {
    return ['За текущий месяц операций пока нет.', '', formatAccountsSummary(accounts)].join('\n');
  }

  const expenseTotals = sumRowsByCurrency(expenses);
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

  const resultLines = ['Баланс за текущий месяц', '', ...lines];

  if (!hasUsdTotals(expenseTotals, incomeTotals)) {
    const incomeRub = incomeTotals.get('RUB') || 0;
    const expenseRub = expenseTotals.get('RUB') || 0;

    resultLines.push(
      '',
      `Итого доходов в RUB: ${formatMoney(incomeRub, 'RUB')}`,
      `Итоговый баланс в RUB: ${formatMoney(incomeRub - expenseRub, 'RUB')}`
    );
    resultLines.push('', formatAccountsSummary(accounts));
    return resultLines.join('\n');
  }

  try {
    const usdRate = await getUsdToRubRate();
    const incomeRub = convertTotalsToRub(incomeTotals, usdRate);
    const expenseRub = convertTotalsToRub(expenseTotals, usdRate);

    resultLines.push(
      '',
      `Итого доходов в RUB: ${formatMoney(incomeRub, 'RUB')}`,
      `Итоговый баланс в RUB: ${formatMoney(incomeRub - expenseRub, 'RUB')}`,
      `Курс USD: ${formatMoney(usdRate.value, 'RUB')}${usdRate.date ? ` (${usdRate.date}, ${usdRate.source})` : ''}`
    );
  } catch (error) {
    console.error('[stats:balance] failed to fetch USD rate', error);
    resultLines.push('', 'Итого в RUB не посчитал: не удалось получить текущий курс USD.');
  }

  resultLines.push('', formatAccountsSummary(accounts));
  return resultLines.join('\n');
}

async function sendMonthStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getCurrentMonthBalance(user.id);

  await ctx.reply(formatStats(stats));
}

async function sendPreviousMonthStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getPreviousMonthBalance(user.id);

  await ctx.reply(formatStats(stats, 'Статистика за прошлый месяц'));
}

async function sendMonthBalance(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const [balance, accounts] = await Promise.all([
    getCurrentMonthBalance(user.id),
    getAccounts(user.id),
  ]);

  await ctx.reply(await formatBalance(balance, accounts));
}

async function sendMonthIncomeStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const stats = await getCurrentMonthIncomeStats(user.id);

  await ctx.reply(formatIncomeStats(stats));
}

async function sendWeeklyReport(ctx) {
  const user = await upsertTelegramUser(ctx.from);

  await ctx.reply(await buildWeeklyReport(user.id));
}

function registerStatsHandlers(bot) {
  bot.command('stats', sendMonthStats);
  bot.command('prev_month', sendPreviousMonthStats);
  bot.command('income', sendMonthIncomeStats);
  bot.command('balance', sendMonthBalance);
  bot.command('weekly_report', sendWeeklyReport);
  bot.hears(replyLabels.STATS_MONTH, sendMonthStats);

  bot.action(actions.STATS_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthStats(ctx);
  });

  bot.action(actions.STATS_PREVIOUS_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendPreviousMonthStats(ctx);
  });
}

module.exports = { registerStatsHandlers };
