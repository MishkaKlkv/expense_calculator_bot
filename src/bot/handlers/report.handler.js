const fs = require('fs');
const {
  CATEGORY_EXPENSES_PAGE_SIZE,
  buildLast30DaysChartPng,
  buildMonthChartPng,
  exportMonthExpenses,
  getCurrentMonthExpenseCategories,
  getCurrentMonthExpensesByCategory,
  getFamilySpendingByUser,
  getMonthComparison,
  getTodayStats,
  getTopMonthExpenses,
  getWeekStats,
} = require('../../services/report.service');
const {
  actions,
  categoryExpensesNextKeyboard,
  categoryNamesKeyboard,
} = require('../keyboards');
const { getFamilyContext } = require('../../services/family.service');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { getCurrentMonthRange } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');
const { formatDateTime } = require('../../utils/date');

function formatCategoryStats(rows, title) {
  if (rows.length === 0) {
    return `${title}: расходов нет.`;
  }

  const lines = rows.map((row) => {
    const amount = Number(row._sum.amount || 0);
    return `${row.category}: ${formatMoney(amount, row.currency)}`;
  });

  return `${title}:\n\n${lines.join('\n')}`;
}

function formatComparison(rows, title = 'Сравнение с прошлым месяцем') {
  if (rows.length === 0) {
    return 'Сравнивать пока нечего.';
  }

  const lines = rows.map((row) => {
    const diff = row.current - row.previous;
    const percent = row.previous === 0 ? null : Math.round((diff / row.previous) * 100);
    const sign = diff >= 0 ? '+' : '';
    const percentText = percent === null ? 'новая категория' : `${sign}${percent}%`;

    return `${row.category}: ${formatMoney(row.current, row.currency)} (${sign}${formatMoney(
      diff,
      row.currency
    )}, ${percentText})`;
  });

  return `${title}:\n\n${lines.join('\n')}`;
}

function formatTopExpenses(expenses, title = 'Топ трат месяца', options = {}) {
  if (expenses.length === 0) {
    return 'В этом месяце трат пока нет.';
  }

  const lines = expenses.map((expense, index) => {
    const userText = options.includeUser ? ` | ${getDisplayName(expense.user)}` : '';

    return `${index + 1}. ${formatDateTime(expense.expenseDate)}${userText} | ${
      expense.category
    } | ${expense.description} | ${formatMoney(expense.amount, expense.currency)}`;
  });

  return `${title}:\n\n${lines.join('\n')}`;
}

function formatCategoryExpenses(expenses, category, offset = 0, options = {}) {
  if (expenses.length === 0) {
    return offset > 0
      ? `В категории "${category}" больше нет трат за текущий месяц.`
      : `В категории "${category}" за текущий месяц трат пока нет.`;
  }

  const title = options.family
    ? `Семейные траты в категории "${category}" за текущий месяц`
    : `Траты в категории "${category}" за текущий месяц`;
  const lines = expenses.map((expense, index) => {
    const userText = options.family ? ` | ${getDisplayName(expense.user)}` : '';

    return `${offset + index + 1}. ${formatDateTime(expense.expenseDate)}${userText} | ${
      expense.description
    } | ${formatMoney(expense.amount, expense.currency)}`;
  });

  return `${title}:\n\n${lines.join('\n')}`;
}

function getDisplayName(user) {
  return user.firstName || (user.username ? `@${user.username}` : `ID ${user.telegramUserId}`);
}

function formatFamilyByUser(rows, context) {
  if (rows.length === 0) {
    return 'В семейном счете за текущий месяц расходов пока нет.';
  }

  const membersById = new Map(context.members.map((member) => [member.userId, member.user]));
  const lines = rows.map((row) => {
    const user = membersById.get(row.userId);
    const amount = Number(row._sum.amount || 0);

    return `${getDisplayName(user)}: ${formatMoney(amount, row.currency)}`;
  });

  return `Кто сколько потратил в семье за месяц:\n\n${lines.join('\n')}`;
}

async function cleanupTemp(tempDir) {
  await fs.promises.rm(tempDir, { force: true, recursive: true });
}

async function getExpenseReportScope(ctx, options = {}) {
  const user = await upsertTelegramUser(ctx.from);

  if (!options.family) {
    return {
      ok: true,
      scope: { userId: user.id },
    };
  }

  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет или присоединитесь к нему.');
    return { ok: false };
  }

  return {
    ok: true,
    scope: { userIds: context.memberUserIds },
  };
}

async function sendTodayStats(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const rows = await getTodayStats(reportScope.scope);
  const title = options.family ? 'Семейные расходы за сегодня' : 'Расходы за сегодня';

  await ctx.reply(formatCategoryStats(rows, title));
}

async function sendWeekStats(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const rows = await getWeekStats(reportScope.scope);
  const title = options.family ? 'Семейные расходы за неделю' : 'Расходы за неделю';

  await ctx.reply(formatCategoryStats(rows, title));
}

async function sendMonthComparison(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const rows = await getMonthComparison(reportScope.scope);
  const title = options.family
    ? 'Сравнение семейных расходов с прошлым месяцем'
    : 'Сравнение с прошлым месяцем';

  await ctx.reply(formatComparison(rows, title));
}

async function sendTopMonthExpenses(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const expenses = await getTopMonthExpenses(reportScope.scope);
  const title = options.family ? 'Топ семейных трат месяца' : 'Топ трат месяца';

  await ctx.reply(formatTopExpenses(expenses, title, { includeUser: options.family }));
}

async function sendCategoryExpensePicker(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const categories = await getCurrentMonthExpenseCategories(reportScope.scope);

  if (categories.length === 0) {
    await ctx.reply(
      options.family
        ? 'В семейном счете за текущий месяц расходов пока нет.'
        : 'За текущий месяц расходов пока нет.'
    );
    return;
  }

  const action = options.family
    ? actions.STATS_FAMILY_CATEGORY_EXPENSES
    : actions.STATS_CATEGORY_EXPENSES;

  await ctx.reply('Выберите категорию:', categoryNamesKeyboard(categories, action));
}

async function sendCategoryExpenses(ctx, category, offset = 0, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const safeOffset = Number(offset) || 0;
  const expenses = await getCurrentMonthExpensesByCategory(reportScope.scope, category, {
    limit: CATEGORY_EXPENSES_PAGE_SIZE + 1,
    offset: safeOffset,
  });
  const page = expenses.slice(0, CATEGORY_EXPENSES_PAGE_SIZE);
  const hasNext = expenses.length > CATEGORY_EXPENSES_PAGE_SIZE;
  const message = formatCategoryExpenses(page, category, safeOffset, options);
  const extra = hasNext
    ? categoryExpensesNextKeyboard(safeOffset + CATEGORY_EXPENSES_PAGE_SIZE, category, options)
    : undefined;

  await ctx.reply(message, extra);
}

async function sendFamilySpendingByUser(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет или присоединитесь к нему.');
    return;
  }

  const range = getCurrentMonthRange();
  const rows = await getFamilySpendingByUser({
    userIds: context.memberUserIds,
    start: range.start,
    end: range.end,
  });

  await ctx.reply(formatFamilyByUser(rows, context));
}

async function sendExpensesExport(ctx, format, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const exported = await exportMonthExpenses({ ...reportScope.scope, format });
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';
  const filenamePrefix = options.family ? 'family-expenses-current-month' : 'expenses-current-month';

  try {
    await ctx.replyWithDocument({
      source: exported.filePath,
      filename: `${filenamePrefix}.${extension}`,
    });
  } finally {
    await cleanupTemp(exported.tempDir);
  }
}

async function sendMonthChart(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const chart = await buildMonthChartPng(reportScope.scope, {
    title: options.family ? 'Семейные расходы за месяц' : 'Расходы за месяц',
  });

  try {
    await ctx.replyWithPhoto({
      source: chart.filePath,
    });
  } finally {
    await cleanupTemp(chart.tempDir);
  }
}

async function sendLast30DaysChart(ctx, options = {}) {
  const reportScope = await getExpenseReportScope(ctx, options);

  if (!reportScope.ok) {
    return;
  }

  const chart = await buildLast30DaysChartPng(reportScope.scope, {
    title: options.family ? 'Семейные расходы за 30 дней' : 'Расходы за 30 дней',
  });

  try {
    await ctx.replyWithPhoto({
      source: chart.filePath,
    });
  } finally {
    await cleanupTemp(chart.tempDir);
  }
}

function registerReportHandlers(bot) {
  bot.command('today', sendTodayStats);
  bot.command('week', sendWeekStats);
  bot.command('compare', sendMonthComparison);
  bot.command('top', sendTopMonthExpenses);
  bot.command('family_by_user', sendFamilySpendingByUser);
  bot.command('export_csv', (ctx) => sendExpensesExport(ctx, 'csv'));
  bot.command('export_xlsx', (ctx) => sendExpensesExport(ctx, 'xlsx'));
  bot.command('chart', sendMonthChart);
}

module.exports = {
  registerReportHandlers,
  sendCategoryExpensePicker,
  sendCategoryExpenses,
  sendExpensesExport,
  sendLast30DaysChart,
  sendMonthChart,
  sendMonthComparison,
  sendTodayStats,
  sendTopMonthExpenses,
  sendWeekStats,
};
