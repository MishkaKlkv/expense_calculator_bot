const { Telegraf } = require('telegraf');
const { env } = require('./config/env');
const { configureBotCommands } = require('./bot/botCommands');
const { prisma } = require('./db/prisma');
const { registerBot } = require('./bot/registerBot');
const {
  startPlannedPaymentReminderScheduler,
} = require('./services/plannedPaymentReminderScheduler.service');
const { startReminderScheduler } = require('./services/reminderScheduler.service');
const { startWeeklyReportScheduler } = require('./services/weeklyReportScheduler.service');

const bot = new Telegraf(env.botToken);
let plannedPaymentReminderScheduler = null;
let reminderScheduler = null;
let weeklyReportScheduler = null;

registerBot(bot);

bot.catch((error, ctx) => {
  console.error(`Bot error for update ${ctx.update?.update_id}:`, error);
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);
  plannedPaymentReminderScheduler?.stop();
  reminderScheduler?.stop();
  weeklyReportScheduler?.stop();
  bot.stop(signal);
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

reminderScheduler = startReminderScheduler(bot);
weeklyReportScheduler = startWeeklyReportScheduler(bot);
plannedPaymentReminderScheduler = startPlannedPaymentReminderScheduler(bot);

bot.launch().then(async () => {
  try {
    await configureBotCommands(bot);
    console.log('[bot:commands] commands and menu button configured');
  } catch (error) {
    console.error('[bot:commands] failed to configure commands or menu button', error);
  }

  console.log('Expense bot is running');
}).catch(async (error) => {
  console.error('Failed to launch bot:', error);
  plannedPaymentReminderScheduler?.stop();
  reminderScheduler?.stop();
  weeklyReportScheduler?.stop();
  await prisma.$disconnect();
  process.exit(1);
});
