const { isAdminTelegramUser } = require('../../services/admin.service');
const { getBotUsageStats } = require('../../services/botEvent.service');
const { prisma } = require('../../db/prisma');

function formatTopEvents(rows) {
  if (rows.length === 0) {
    return 'нет событий';
  }

  return rows
    .map((row, index) => {
      const name = row.eventName ? `${row.eventType}:${row.eventName}` : row.eventType;

      return `${index + 1}. ${name} - ${row._count._all}`;
    })
    .join('\n');
}

async function getDomainStats() {
  const [usersTotal, expensesTotal, incomesTotal, remindersEnabled, familiesTotal] =
    await Promise.all([
      prisma.telegramUser.count(),
      prisma.expense.count({ where: { type: 'EXPENSE' } }),
      prisma.expense.count({ where: { type: 'INCOME' } }),
      prisma.dailyReminder.count({ where: { enabled: true } }),
      prisma.familyAccount.count(),
    ]);

  return {
    expensesTotal,
    familiesTotal,
    incomesTotal,
    remindersEnabled,
    usersTotal,
  };
}

function formatAdminStats({ usage, domain }) {
  return [
    'Статистика бота',
    '',
    `Пользователей всего: ${domain.usersTotal}`,
    `Активных за 24ч: ${usage.active1d}`,
    `Активных за 7д: ${usage.active7d}`,
    `Активных за 30д: ${usage.active30d}`,
    '',
    `Событий всего: ${usage.eventsTotal}`,
    `Событий за 24ч: ${usage.events1d}`,
    `Событий за 7д: ${usage.events7d}`,
    '',
    `Расходов всего: ${domain.expensesTotal}`,
    `Доходов всего: ${domain.incomesTotal}`,
    `Включенных напоминаний: ${domain.remindersEnabled}`,
    `Семейных счетов: ${domain.familiesTotal}`,
    '',
    'Топ событий за 7 дней:',
    formatTopEvents(usage.topEvents7d),
  ].join('\n');
}

function registerAdminHandlers(bot) {
  bot.command('admin_stats', async (ctx) => {
    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    const [usage, domain] = await Promise.all([getBotUsageStats(), getDomainStats()]);

    await ctx.reply(formatAdminStats({ usage, domain }));
  });
}

module.exports = { registerAdminHandlers };
