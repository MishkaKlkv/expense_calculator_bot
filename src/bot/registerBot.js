const { registerClearExpensesHandlers } = require('./handlers/clearExpenses.handler');
const { registerDeleteExpenseHandlers } = require('./handlers/deleteExpense.handler');
const { registerEditExpenseHandlers } = require('./handlers/editExpense.handler');
const { registerExpenseHandlers } = require('./handlers/expense.handler');
const { registerFamilyHandlers } = require('./handlers/family.handler');
const { registerMenuHandlers } = require('./handlers/menu.handler');
const { registerRecentHandlers } = require('./handlers/recent.handler');
const { registerReminderHandlers } = require('./handlers/reminder.handler');
const { registerReportHandlers } = require('./handlers/report.handler');
const { registerStatsHandlers } = require('./handlers/stats.handler');
const { registerAdminHandlers } = require('./handlers/admin.handler');
const { registerCategoryHandlers } = require('./handlers/category.handler');
const { logBotEventFromContext } = require('../services/botEvent.service');

function registerBot(bot) {
  bot.use(async (ctx, next) => {
    const updateType = ctx.updateType;
    const fromId = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';

    console.log(`[bot:update] type=${updateType} user=${fromId} text="${text}"`);

    try {
      await logBotEventFromContext(ctx);
    } catch (error) {
      console.error('[bot:event] failed', error);
    }

    return next();
  });

  bot.use(async (ctx, next) => {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    }

    return next();
  });

  registerAdminHandlers(bot);
  registerCategoryHandlers(bot);
  registerMenuHandlers(bot);
  registerFamilyHandlers(bot);
  registerReminderHandlers(bot);
  registerStatsHandlers(bot);
  registerReportHandlers(bot);
  registerRecentHandlers(bot);
  registerClearExpensesHandlers(bot);
  registerDeleteExpenseHandlers(bot);
  registerEditExpenseHandlers(bot);
  registerExpenseHandlers(bot);
}

module.exports = { registerBot };
