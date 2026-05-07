const fs = require('fs');
const {
  buildMonthChartPng,
  exportMonthExpenses,
  getFamilySpendingByUser,
  getMonthComparison,
  getTodayStats,
  getTopMonthExpenses,
  getWeekStats,
} = require('../../services/report.service');
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

function formatComparison(rows) {
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

  return `Сравнение с прошлым месяцем:\n\n${lines.join('\n')}`;
}

function formatTopExpenses(expenses) {
  if (expenses.length === 0) {
    return 'В этом месяце трат пока нет.';
  }

  const lines = expenses.map((expense, index) => {
    return `${index + 1}. ${formatDateTime(expense.expenseDate)} | ${expense.category} | ${
      expense.description
    } | ${formatMoney(expense.amount, expense.currency)}`;
  });

  return `Топ трат месяца:\n\n${lines.join('\n')}`;
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

async function sendTodayStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const rows = await getTodayStats(user.id);

  await ctx.reply(formatCategoryStats(rows, 'Расходы за сегодня'));
}

async function sendWeekStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const rows = await getWeekStats(user.id);

  await ctx.reply(formatCategoryStats(rows, 'Расходы за неделю'));
}

async function sendMonthComparison(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const rows = await getMonthComparison(user.id);

  await ctx.reply(formatComparison(rows));
}

async function sendTopMonthExpenses(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const expenses = await getTopMonthExpenses(user.id);

  await ctx.reply(formatTopExpenses(expenses));
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

async function sendExpensesExport(ctx, format) {
  const user = await upsertTelegramUser(ctx.from);
  const exported = await exportMonthExpenses({ userId: user.id, format });
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';

  try {
    await ctx.replyWithDocument({
      source: exported.filePath,
      filename: `expenses-current-month.${extension}`,
    });
  } finally {
    await cleanupTemp(exported.tempDir);
  }
}

async function sendMonthChart(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const chart = await buildMonthChartPng(user.id);

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
  sendExpensesExport,
  sendMonthChart,
  sendMonthComparison,
  sendTodayStats,
  sendTopMonthExpenses,
  sendWeekStats,
};
