const {
  getDueDailyReminders,
  markReminderSentForToday,
} = require('./reminder.service');

const REMINDER_INTERVAL_MS = 60 * 1000;
const REMINDER_IDLE_LOG_INTERVAL_MS = 10 * 60 * 1000;

function buildReminderMessage() {
  return [
    'Напоминание: внесите траты за сегодня.',
    '',
    'Добавить расход: /add',
    'Баланс за месяц: /balance',
  ].join('\n');
}

async function runReminderTick(bot, options = {}) {
  const { forceLog = false } = options;
  const reminders = await getDueDailyReminders();

  if (forceLog || reminders.length > 0) {
    console.log(`[reminder] due reminders found: ${reminders.length}`);
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      await bot.telegram.sendMessage(
        Number(reminder.user.telegramUserId),
        buildReminderMessage()
      );
      await markReminderSentForToday(reminder);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[reminder] failed user=${reminder.user.telegramUserId} reminder=${reminder.id}`,
        error
      );
    }
  }

  return {
    due: reminders.length,
    failed,
    sent,
  };
}

function startReminderScheduler(bot) {
  let isRunning = false;
  let lastIdleLogAt = 0;
  console.log('[reminder] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runReminderTick(bot);
      const now = Date.now();

      if (result.due === 0 && now - lastIdleLogAt >= REMINDER_IDLE_LOG_INTERVAL_MS) {
        console.log('[reminder] tick checked: due=0');
        lastIdleLogAt = now;
      }
    } catch (error) {
      console.error('[reminder] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, REMINDER_INTERVAL_MS);
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  buildReminderMessage,
  runReminderTick,
  startReminderScheduler,
};
