const {
  buildBuyNothingDayMessage,
  getUsersForBuyNothingDayNotification,
  markBuyNothingDayNotificationSent,
} = require('./buyNothingDay.service');

const BUY_NOTHING_DAY_INTERVAL_MS = 60 * 1000;
const BUY_NOTHING_DAY_IDLE_LOG_INTERVAL_MS = 60 * 60 * 1000;

async function runBuyNothingDayTick(bot, options = {}) {
  const { forceLog = false } = options;
  const { dueInfo, users } = await getUsersForBuyNothingDayNotification();

  if (forceLog || users.length > 0) {
    console.log(
      `[buy-nothing-day] check date=${dueInfo.currentDate} time=${dueInfo.currentTime} event=${dueInfo.eventDate} due=${users.length}`
    );
  }

  let sent = 0;
  let failed = 0;
  const message = buildBuyNothingDayMessage();

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(Number(user.telegramUserId), message);
      await markBuyNothingDayNotificationSent({
        eventYear: dueInfo.eventYear,
        userId: user.id,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[buy-nothing-day] failed user=${user.telegramUserId}`, error);
    }
  }

  return {
    due: users.length,
    failed,
    sent,
  };
}

function startBuyNothingDayScheduler(bot) {
  let isRunning = false;
  let lastIdleLogAt = 0;
  console.log('[buy-nothing-day] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runBuyNothingDayTick(bot);
      const now = Date.now();

      if (result.due === 0 && now - lastIdleLogAt >= BUY_NOTHING_DAY_IDLE_LOG_INTERVAL_MS) {
        console.log('[buy-nothing-day] tick checked: due=0');
        lastIdleLogAt = now;
      }
    } catch (error) {
      console.error('[buy-nothing-day] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, BUY_NOTHING_DAY_INTERVAL_MS);
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  runBuyNothingDayTick,
  startBuyNothingDayScheduler,
};
