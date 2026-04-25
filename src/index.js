const { Telegraf } = require('telegraf');
const { env } = require('./config/env');
const { prisma } = require('./db/prisma');
const { registerBot } = require('./bot/registerBot');
const { startReminderScheduler } = require('./services/reminderScheduler.service');

const bot = new Telegraf(env.botToken);
let reminderScheduler = null;

registerBot(bot);

bot.catch((error, ctx) => {
  console.error(`Bot error for update ${ctx.update?.update_id}:`, error);
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);
  reminderScheduler?.stop();
  bot.stop(signal);
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

reminderScheduler = startReminderScheduler(bot);

bot.launch().then(() => {
  console.log('Expense bot is running');
}).catch(async (error) => {
  console.error('Failed to launch bot:', error);
  reminderScheduler?.stop();
  await prisma.$disconnect();
  process.exit(1);
});
