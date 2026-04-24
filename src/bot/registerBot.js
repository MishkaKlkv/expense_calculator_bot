const { registerDeleteExpenseHandlers } = require('./handlers/deleteExpense.handler');
const { registerEditExpenseHandlers } = require('./handlers/editExpense.handler');
const { registerExpenseHandlers } = require('./handlers/expense.handler');
const { registerFamilyHandlers } = require('./handlers/family.handler');
const { registerMenuHandlers } = require('./handlers/menu.handler');
const { registerRecentHandlers } = require('./handlers/recent.handler');
const { registerReminderHandlers } = require('./handlers/reminder.handler');
const { registerReportHandlers } = require('./handlers/report.handler');
const { registerStatsHandlers } = require('./handlers/stats.handler');

function registerBot(bot) {
  bot.use(async (ctx, next) => {
    const updateType = ctx.updateType;
    const fromId = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';

    console.log(`[bot:update] type=${updateType} user=${fromId} text="${text}"`);
    return next();
  });

  registerMenuHandlers(bot);
  registerFamilyHandlers(bot);
  registerReminderHandlers(bot);
  registerStatsHandlers(bot);
  registerReportHandlers(bot);
  registerRecentHandlers(bot);
  registerDeleteExpenseHandlers(bot);
  registerEditExpenseHandlers(bot);
  registerExpenseHandlers(bot);
}

module.exports = { registerBot };
