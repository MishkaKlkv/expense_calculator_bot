const { actions, reminderManageKeyboard } = require('../keyboards');
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
const {
  buildReminderMessage,
  runReminderTick,
} = require('../../services/reminderScheduler.service');

function formatReminderStatus(reminder, options = {}) {
  const { isAdmin = false } = options;

  if (!reminder) {
    return [
      'Ежедневное напоминание не настроено.',
      '',
      'Включить: /reminder 20:00',
    ].join('\n');
  }

  const lines = [
    `Ежедневное напоминание: ${reminder.enabled ? 'включено' : 'выключено'}`,
    `Время: ${reminder.timeOfDay}`,
    `Часовой пояс: ${reminder.timezone}`,
    '',
    'Управление доступно кнопками ниже.',
  ];

  if (isAdmin) {
    lines.push(
      '',
      'Админские проверки тоже доступны кнопками.'
    );
  }

  return lines.join('\n');
}

async function showReminderStatus(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const reminder = await getDailyReminder(user.id);
  const isAdmin = isAdminTelegramUser(ctx);

  await ctx.reply(formatReminderStatus(reminder, { isAdmin }), reminderManageKeyboard({
    enabled: Boolean(reminder?.enabled),
    isAdmin,
  }));
}

function registerReminderHandlers(bot) {
  bot.command('reminder', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const timeText = ctx.message.text.replace('/reminder', '').trim();

    if (!timeText) {
      const reminder = await getDailyReminder(user.id);
      const isAdmin = isAdminTelegramUser(ctx);
      await ctx.reply(formatReminderStatus(reminder, { isAdmin }), reminderManageKeyboard({
        enabled: Boolean(reminder?.enabled),
        isAdmin,
      }));
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

  bot.action(actions.REMINDER_CHANGE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyTemporary('Отправьте новое время так: /reminder 20:00');
  });

  bot.action(actions.REMINDER_OFF, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);
    const result = await disableDailyReminder(user.id);

    await ctx.reply(
      result.ok
        ? 'Ежедневное напоминание выключено.'
        : 'Напоминание еще не настроено. Включить: /reminder 20:00'
    );
  });

  bot.action(actions.REMINDER_ON, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);
    const result = await enableDailyReminder(user.id);

    if (!result.ok) {
      await ctx.reply('Сначала задайте время: /reminder 20:00');
      return;
    }

    await showReminderStatus(ctx);
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

  bot.action(actions.REMINDER_TEST, async (ctx) => {
    await ctx.answerCbQuery();
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

  bot.action(actions.REMINDER_CHECK, async (ctx) => {
    await ctx.answerCbQuery();
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

  bot.command('reminder_run', async (ctx) => {
    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    const result = await runReminderTick(ctx, { forceLog: true });

    await ctx.reply(
      [
        'Проверка отправки выполнена.',
        `Готовы к отправке: ${result.due}`,
        `Отправлено: ${result.sent}`,
        `Ошибок: ${result.failed}`,
      ].join('\n')
    );
  });

  bot.action(actions.REMINDER_RUN, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    const result = await runReminderTick(ctx, { forceLog: true });

    await ctx.reply(
      [
        'Проверка отправки выполнена.',
        `Готовы к отправке: ${result.due}`,
        `Отправлено: ${result.sent}`,
        `Ошибок: ${result.failed}`,
      ].join('\n')
    );
  });
}

module.exports = { registerReminderHandlers };
