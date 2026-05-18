const {
  actions,
  dailyExpensesKeyboard,
  familyStatsManageKeyboard,
  replyLabels,
  statsManageKeyboard,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  getCurrentMonthBalance,
  getCurrentMonthIncomeStats,
  getCurrentMonthStatsForUsers,
  getDailyExpenseTotals,
  getPreviousMonthBalance,
  getPreviousMonthStatsForUsers,
} = require('../../services/stats.service');
const { getFamilyContext } = require('../../services/family.service');
const { buildWeeklyReport } = require('../../services/weeklyReport.service');
const { getAccounts, summarizeAccounts } = require('../../services/account.service');
const { resetDialogState } = require('../../services/dialogState.service');
const { getUsdToRubRate } = require('../../services/exchangeRate.service');
const { getMarketRatesSnapshot } = require('../../services/marketRates.service');
const {
  sendCategoryExpensePicker,
  sendCategoryExpenses,
  sendExpensesExport,
  sendLast30DaysChart,
  sendMonthChart,
  sendMonthComparison,
  sendTodayStats,
  sendTopMonthExpenses,
  sendWeekStats,
} = require('./report.handler');
const { formatMoney } = require('../../utils/money');

const DAILY_EXPENSES_PAGE_SIZE = 10;

function normalizeOffset(value) {
  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

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

function formatExpenseOnlyStats(rows, title) {
  const expenseStats = formatCategoryRows(rows, 'Расходов пока нет.');

  return [
    title,
    '',
    'Расходы:',
    expenseStats.lines.join('\n'),
    ...(expenseStats.totals.length > 0 ? ['', `Итого расходов: ${expenseStats.totals.join(', ')}`] : []),
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

function formatDailyDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(date);
}

function formatDailyTotals(totals) {
  return totals.map((total) => formatMoney(total.amount, total.currency)).join(', ');
}

function formatDailyExpenseStats(rows, offset = 0, options = {}) {
  const rangeText =
    offset === 0
      ? 'Последние 10 дней'
      : `Дни ${offset + 1}-${offset + rows.length} от сегодняшнего`;
  const title = options.family ? 'Семейные расходы по дням' : 'Расходы по дням';

  return [
    title,
    rangeText,
    '',
    ...rows.map((row) => `${formatDailyDate(row.dateKey)}: ${formatDailyTotals(row.totals)}`),
  ].join('\n');
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

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat('ru-RU', options).format(value);
}

function formatUsdMarketValue(rate) {
  if (!rate?.ok) {
    return 'не удалось получить';
  }

  const maximumFractionDigits = rate.value >= 1000 ? 0 : 2;

  return `${formatNumber(rate.value, { maximumFractionDigits })} $`;
}

function formatRubMarketValue(rate) {
  if (!rate?.ok) {
    return 'не удалось получить';
  }

  return `${formatNumber(rate.value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} ₽`;
}

function formatExchangeRates(snapshot) {
  return [
    'Актуальные курсы:',
    '',
    `🥇 Золото ${formatUsdMarketValue(snapshot.gold)}.`,
    `🛢️ Нефть ${formatUsdMarketValue(snapshot.oil)}.`,
    `💵 Доллар ${formatRubMarketValue(snapshot.usd)}`,
    `💵 Биткоин ${formatUsdMarketValue(snapshot.bitcoin)}`,
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
  await resetDialogState(user.id);
  const stats = await getCurrentMonthBalance(user.id);

  await ctx.reply(formatStats(stats), statsManageKeyboard());
}

async function sendPreviousMonthStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const stats = await getPreviousMonthBalance(user.id);

  await ctx.reply(formatStats(stats, 'Статистика за прошлый месяц'));
}

async function getFamilyStatsContext(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет или присоединитесь к нему.');
    return null;
  }

  return context;
}

async function sendFamilyMonthStats(ctx) {
  const context = await getFamilyStatsContext(ctx);

  if (!context) {
    return;
  }

  const rows = await getCurrentMonthStatsForUsers(context.memberUserIds);

  await ctx.reply(
    formatExpenseOnlyStats(rows, 'Семейные расходы за текущий месяц'),
    familyStatsManageKeyboard()
  );
}

async function sendFamilyPreviousMonthStats(ctx) {
  const context = await getFamilyStatsContext(ctx);

  if (!context) {
    return;
  }

  const rows = await getPreviousMonthStatsForUsers(context.memberUserIds);

  await ctx.reply(
    formatExpenseOnlyStats(rows, 'Семейные расходы за прошлый месяц'),
    familyStatsManageKeyboard()
  );
}

async function sendMonthBalance(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const [balance, accounts] = await Promise.all([
    getCurrentMonthBalance(user.id),
    getAccounts(user.id),
  ]);

  await ctx.reply(await formatBalance(balance, accounts));
}

async function sendMonthIncomeStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const stats = await getCurrentMonthIncomeStats(user.id);

  await ctx.reply(formatIncomeStats(stats));
}

async function sendDailyExpenseStats(ctx, offset = 0) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const requestedOffset = normalizeOffset(offset);
  const rows = await getDailyExpenseTotals(user.id, {
    limit: DAILY_EXPENSES_PAGE_SIZE,
    offset: requestedOffset,
  });

  await ctx.reply(
    formatDailyExpenseStats(rows, requestedOffset),
    dailyExpensesKeyboard(requestedOffset + DAILY_EXPENSES_PAGE_SIZE)
  );
}

async function sendFamilyDailyExpenseStats(ctx, offset = 0) {
  const context = await getFamilyStatsContext(ctx);

  if (!context) {
    return;
  }

  const requestedOffset = normalizeOffset(offset);
  const rows = await getDailyExpenseTotals(
    { userIds: context.memberUserIds },
    {
      limit: DAILY_EXPENSES_PAGE_SIZE,
      offset: requestedOffset,
    }
  );

  await ctx.reply(
    formatDailyExpenseStats(rows, requestedOffset, { family: true }),
    dailyExpensesKeyboard(requestedOffset + DAILY_EXPENSES_PAGE_SIZE, { family: true })
  );
}

async function sendWeeklyReport(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);

  await ctx.reply(await buildWeeklyReport(user.id));
}

async function sendExchangeRates(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  await resetDialogState(user.id);
  const snapshot = await getMarketRatesSnapshot();

  await ctx.reply(formatExchangeRates(snapshot));
}

function registerStatsHandlers(bot) {
  bot.command('stats', sendMonthStats);
  bot.command('prev_month', sendPreviousMonthStats);
  bot.command('income', sendMonthIncomeStats);
  bot.command('balance', sendMonthBalance);
  bot.command('exchange_rate', sendExchangeRates);
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

  bot.action(actions.STATS_FAMILY_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyMonthStats(ctx);
  });

  bot.action(actions.STATS_FAMILY_PREVIOUS_MONTH, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyPreviousMonthStats(ctx);
  });

  bot.action(actions.STATS_TODAY, async (ctx) => {
    await ctx.answerCbQuery();
    await sendTodayStats(ctx);
  });

  bot.action(actions.STATS_WEEK, async (ctx) => {
    await ctx.answerCbQuery();
    await sendWeekStats(ctx);
  });

  bot.action(actions.STATS_COMPARE, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthComparison(ctx);
  });

  bot.action(actions.STATS_TOP, async (ctx) => {
    await ctx.answerCbQuery();
    await sendTopMonthExpenses(ctx);
  });

  bot.action(actions.STATS_CHART, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthChart(ctx);
  });

  bot.action(actions.STATS_LAST_30_DAYS_CHART, async (ctx) => {
    await ctx.answerCbQuery();
    await sendLast30DaysChart(ctx);
  });

  bot.action(actions.STATS_DAILY_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendDailyExpenseStats(ctx);
  });

  bot.action(new RegExp(`^${actions.STATS_DAILY_EXPENSES_NEXT}:(\\d+)$`, 'u'), async (ctx) => {
    await ctx.answerCbQuery();
    await sendDailyExpenseStats(ctx, ctx.match[1]);
  });

  bot.action(actions.STATS_CATEGORY_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendCategoryExpensePicker(ctx);
  });

  bot.action(new RegExp(`^${actions.STATS_CATEGORY_EXPENSES}:(.+)$`, 'u'), async (ctx) => {
    await ctx.answerCbQuery();
    await sendCategoryExpenses(ctx, ctx.match[1]);
  });

  bot.action(new RegExp(`^${actions.STATS_CATEGORY_EXPENSES_NEXT}:(\\d+):(.+)$`, 'u'), async (ctx) => {
    await ctx.answerCbQuery();
    await sendCategoryExpenses(ctx, ctx.match[2], ctx.match[1]);
  });

  bot.action(actions.STATS_EXPORT_CSV, async (ctx) => {
    await ctx.answerCbQuery();
    await sendExpensesExport(ctx, 'csv');
  });

  bot.action(actions.STATS_EXPORT_XLSX, async (ctx) => {
    await ctx.answerCbQuery();
    await sendExpensesExport(ctx, 'xlsx');
  });

  bot.action(actions.STATS_FAMILY_TODAY, async (ctx) => {
    await ctx.answerCbQuery();
    await sendTodayStats(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_WEEK, async (ctx) => {
    await ctx.answerCbQuery();
    await sendWeekStats(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_COMPARE, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthComparison(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_TOP, async (ctx) => {
    await ctx.answerCbQuery();
    await sendTopMonthExpenses(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_CHART, async (ctx) => {
    await ctx.answerCbQuery();
    await sendMonthChart(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_LAST_30_DAYS_CHART, async (ctx) => {
    await ctx.answerCbQuery();
    await sendLast30DaysChart(ctx, { family: true });
  });

  bot.action(actions.STATS_FAMILY_DAILY_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyDailyExpenseStats(ctx);
  });

  bot.action(
    new RegExp(`^${actions.STATS_FAMILY_DAILY_EXPENSES_NEXT}:(\\d+)$`, 'u'),
    async (ctx) => {
      await ctx.answerCbQuery();
      await sendFamilyDailyExpenseStats(ctx, ctx.match[1]);
    }
  );

  bot.action(actions.STATS_FAMILY_CATEGORY_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await sendCategoryExpensePicker(ctx, { family: true });
  });

  bot.action(new RegExp(`^${actions.STATS_FAMILY_CATEGORY_EXPENSES}:(.+)$`, 'u'), async (ctx) => {
    await ctx.answerCbQuery();
    await sendCategoryExpenses(ctx, ctx.match[1], 0, { family: true });
  });

  bot.action(
    new RegExp(`^${actions.STATS_FAMILY_CATEGORY_EXPENSES_NEXT}:(\\d+):(.+)$`, 'u'),
    async (ctx) => {
      await ctx.answerCbQuery();
      await sendCategoryExpenses(ctx, ctx.match[2], ctx.match[1], { family: true });
    }
  );

  bot.action(actions.STATS_FAMILY_EXPORT_CSV, async (ctx) => {
    await ctx.answerCbQuery();
    await sendExpensesExport(ctx, 'csv', { family: true });
  });

  bot.action(actions.STATS_FAMILY_EXPORT_XLSX, async (ctx) => {
    await ctx.answerCbQuery();
    await sendExpensesExport(ctx, 'xlsx', { family: true });
  });
}

module.exports = { registerStatsHandlers };
