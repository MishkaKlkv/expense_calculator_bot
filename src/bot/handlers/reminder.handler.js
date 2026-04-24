const { upsertTelegramUser } = require('../../repositories/user.repository');
const { isAdminTelegramUser } = require('../../services/admin.service');
const {
  DEFAULT_TIMEZONE,
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminder,
  getReminderDueInfo,
  setDailyReminder,
} = require('../../services/reminder.service');
const { buildReminderMessage } = require('../../services/reminderScheduler.service');

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
    'Проверить отправку: /reminder_test',
    'Проверить расписание: /reminder_check',
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

  bot.command('reminder_test', async (ctx) => {
    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    await ctx.reply(buildReminderMessage());
  });

  bot.command('reminder_check', async (ctx) => {
    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const reminder = await getDailyReminder(user.id);

    if (!reminder) {
      await ctx.reply('Напоминание не настроено. Включить: /reminder 20:00');
      return;
    }

    const dueInfo = getReminderDueInfo(reminder);

    await ctx.reply(
      [
        'Проверка напоминания:',
        `Статус: ${reminder.enabled ? 'включено' : 'выключено'}`,
        `Время напоминания: ${dueInfo.reminderTime}`,
        `Текущее время (${dueInfo.timezone}): ${dueInfo.currentTime}`,
        `Сегодня: ${dueInfo.currentDate}`,
        `Последняя отправка: ${dueInfo.lastSentDate || 'не было'}`,
        `Должно отправиться сейчас: ${dueInfo.isDue ? 'да' : 'нет'}`,
      ].join('\n')
    );
  });
}

module.exports = { registerReminderHandlers };
