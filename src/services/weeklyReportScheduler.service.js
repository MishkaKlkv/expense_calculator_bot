const {
  buildWeeklyReport,
  getUsersForDueWeeklyReport,
  markWeeklyReportSent,
} = require('./weeklyReport.service');

const WEEKLY_REPORT_INTERVAL_MS = 60 * 1000;
const WEEKLY_REPORT_IDLE_LOG_INTERVAL_MS = 60 * 60 * 1000;

async function runWeeklyReportTick(bot, options = {}) {
  const { forceLog = false } = options;
  const { dueInfo, users } = await getUsersForDueWeeklyReport();

  if (forceLog || users.length > 0) {
    console.log(
      `[weekly-report] check date=${dueInfo.currentDate} time=${dueInfo.currentTime} due=${users.length}`
    );
  }

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const report = await buildWeeklyReport(user.id);
      await bot.telegram.sendMessage(Number(user.telegramUserId), report);
      await markWeeklyReportSent({ userId: user.id, weekKey: dueInfo.weekKey });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(`[weekly-report] failed user=${user.telegramUserId}`, error);
    }
  }

  return {
    due: users.length,
    failed,
    sent,
  };
}

function startWeeklyReportScheduler(bot) {
  let isRunning = false;
  let lastIdleLogAt = 0;
  console.log('[weekly-report] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runWeeklyReportTick(bot);
      const now = Date.now();

      if (result.due === 0 && now - lastIdleLogAt >= WEEKLY_REPORT_IDLE_LOG_INTERVAL_MS) {
        console.log('[weekly-report] tick checked: due=0');
        lastIdleLogAt = now;
      }
    } catch (error) {
      console.error('[weekly-report] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, WEEKLY_REPORT_INTERVAL_MS);
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  runWeeklyReportTick,
  startWeeklyReportScheduler,
};
