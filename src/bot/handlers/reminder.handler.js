const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  DEFAULT_TIMEZONE,
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminder,
  setDailyReminder,
} = require('../../services/reminder.service');

function formatReminderStatus(reminder) {
  if (!reminder) {
    return [
      'Ежедневное напоминание не настроено.',
      '',
      'Включить: /reminder 20:00',
    ].join('\n');
  }

  return [
    `Ежедневное напоминание: ${reminder.enabled ? 'включено' : 'выключено'}`,
    `Время: ${reminder.timeOfDay}`,
    `Часовой пояс: ${reminder.timezone}`,
    '',
    'Изменить время: /reminder 20:00',
    'Выключить: /reminder_off',
    'Включить снова: /reminder_on',
  ].join('\n');
}

async function showReminderStatus(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const reminder = await getDailyReminder(user.id);

  await ctx.reply(formatReminderStatus(reminder));
}

function registerReminderHandlers(bot) {
  bot.command('reminder', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const timeText = ctx.message.text.replace('/reminder', '').trim();

    if (!timeText) {
      const reminder = await getDailyReminder(user.id);
      await ctx.reply(formatReminderStatus(reminder));
      return;
    }

    const result = await setDailyReminder({
      userId: user.id,
      timeText,
      timezone: DEFAULT_TIMEZONE,
    });

    if (!result.ok && result.reason === 'INVALID_TIME') {
      await ctx.reply('Не понял время. Отправьте так: /reminder 20:00');
      return;
    }

    await ctx.reply(
      `Готово. Каждый день в ${result.reminder.timeOfDay} напомню внести траты за день.`
    );
  });

  bot.command('reminder_off', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await disableDailyReminder(user.id);

    if (!result.ok) {
      await ctx.reply('Напоминание еще не настроено. Включить: /reminder 20:00');
      return;
    }

    await ctx.reply('Ежедневное напоминание выключено.');
  });

  bot.command('reminder_on', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await enableDailyReminder(user.id);

    if (!result.ok) {
      await ctx.reply('Сначала задайте время: /reminder 20:00');
      return;
    }

    await showReminderStatus(ctx);
  });
}

module.exports = { registerReminderHandlers };
