const {
  buildReminderSuggestionMessage,
  getUsersForReminderSuggestion,
  markReminderSuggestionSent,
} = require('./reminderSuggestion.service');

const REMINDER_SUGGESTION_INTERVAL_MS = 60 * 1000;
const REMINDER_SUGGESTION_IDLE_LOG_INTERVAL_MS = 60 * 60 * 1000;

async function runReminderSuggestionTick(bot, options = {}) {
  const { forceLog = false } = options;
  const { dueInfo, users } = await getUsersForReminderSuggestion();

  if (forceLog || users.length > 0) {
    console.log(
      `[reminder-suggestion] check date=${dueInfo.currentDate} time=${dueInfo.currentTime} due=${users.length}`
    );
  }

  let sent = 0;
  let failed = 0;
  const message = buildReminderSuggestionMessage();

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(Number(user.telegramUserId), message);
      await markReminderSuggestionSent(user.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[reminder-suggestion] failed user=${user.telegramUserId}`, error);
    }
  }

  return {
    due: users.length,
    failed,
    sent,
  };
}

function startReminderSuggestionScheduler(bot) {
  let isRunning = false;
  let lastIdleLogAt = 0;
  console.log('[reminder-suggestion] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runReminderSuggestionTick(bot);
      const now = Date.now();

      if (result.due === 0 && now - lastIdleLogAt >= REMINDER_SUGGESTION_IDLE_LOG_INTERVAL_MS) {
        console.log('[reminder-suggestion] tick checked: due=0');
        lastIdleLogAt = now;
      }
    } catch (error) {
      console.error('[reminder-suggestion] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, REMINDER_SUGGESTION_INTERVAL_MS);
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  runReminderSuggestionTick,
  startReminderSuggestionScheduler,
};
