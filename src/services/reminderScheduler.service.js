const {
  getDueDailyReminders,
  markReminderSentForToday,
} = require('./reminder.service');

const REMINDER_INTERVAL_MS = 60 * 1000;

function buildReminderMessage() {
  return [
    'Напоминание: внесите траты за сегодня.',
    '',
    'Добавить расход: /add',
    'Баланс за месяц: /balance',
  ].join('\n');
}

function startReminderScheduler(bot) {
  let isRunning = false;
  console.log('[reminder] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const reminders = await getDueDailyReminders();

      if (reminders.length > 0) {
        console.log(`[reminder] due reminders found: ${reminders.length}`);
      }

      for (const reminder of reminders) {
        try {
          await bot.telegram.sendMessage(
            Number(reminder.user.telegramUserId),
            buildReminderMessage()
          );
          await markReminderSentForToday(reminder);
        } catch (error) {
          console.error(
            `[reminder] failed user=${reminder.user.telegramUserId} reminder=${reminder.id}`,
            error
          );
        }
      }
    } catch (error) {
      console.error('[reminder] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, REMINDER_INTERVAL_MS);
  interval.unref?.();
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = { startReminderScheduler };
module.exports.buildReminderMessage = buildReminderMessage;
