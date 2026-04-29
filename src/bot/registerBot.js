const { registerClearExpensesHandlers } = require('./handlers/clearExpenses.handler');
const { registerDeleteExpenseHandlers } = require('./handlers/deleteExpense.handler');
const { registerEditExpenseHandlers } = require('./handlers/editExpense.handler');
const { registerExpenseHandlers } = require('./handlers/expense.handler');
const { registerFamilyHandlers } = require('./handlers/family.handler');
const { registerGamificationHandlers } = require('./handlers/gamification.handler');
const { registerMenuHandlers } = require('./handlers/menu.handler');
const { registerRecentHandlers } = require('./handlers/recent.handler');
const { registerPlannedPaymentHandlers } = require('./handlers/plannedPayment.handler');
const { registerReminderHandlers } = require('./handlers/reminder.handler');
const { registerReportHandlers } = require('./handlers/report.handler');
const { registerStatsHandlers } = require('./handlers/stats.handler');
const { registerAdminHandlers } = require('./handlers/admin.handler');
const { registerAccountHandlers } = require('./handlers/account.handler');
const { registerCategoryHandlers } = require('./handlers/category.handler');
const { configureChatMenuButton } = require('./botCommands');
const { logBotEventFromContext } = require('../services/botEvent.service');
const { mainMenuReplyKeyboard, replyLabels } = require('./keyboards');

const lastInlineKeyboardByChat = new Map();
const temporaryMessagesByChat = new Map();
const removableUserTexts = new Set([
  replyLabels.MENU,
  replyLabels.ADD_EXPENSE,
  replyLabels.ADD_INCOME,
  replyLabels.STATS_MONTH,
  replyLabels.RECENT_EXPENSES,
  replyLabels.DELETE_EXPENSE,
  replyLabels.EDIT_EXPENSE,
  replyLabels.FAMILY_INFO,
  replyLabels.HELP,
]);

function getChatKey(ctx) {
  return ctx.chat?.id ? String(ctx.chat.id) : null;
}

function hasInlineKeyboard(extra) {
  return Array.isArray(extra?.reply_markup?.inline_keyboard);
}

function hasReplyMarkup(extra) {
  return Boolean(extra?.reply_markup);
}

function withMainMenuReplyKeyboard(ctx, extra) {
  if (ctx.chat?.type !== 'private' || hasReplyMarkup(extra)) {
    return extra;
  }

  return {
    ...(extra || {}),
    ...mainMenuReplyKeyboard(),
  };
}

async function hideLastInlineKeyboard(ctx) {
  const chatKey = getChatKey(ctx);

  if (!chatKey) {
    return;
  }

  const messageId = lastInlineKeyboardByChat.get(chatKey);

  if (!messageId) {
    return;
  }

  await ctx.telegram
    .editMessageReplyMarkup(ctx.chat.id, messageId, undefined, { inline_keyboard: [] })
    .catch(() => {});

  lastInlineKeyboardByChat.delete(chatKey);
}

function rememberTemporaryMessage(ctx, message) {
  const chatKey = getChatKey(ctx);

  if (!chatKey || !message?.message_id) {
    return;
  }

  const messageIds = temporaryMessagesByChat.get(chatKey) || new Set();
  messageIds.add(message.message_id);
  temporaryMessagesByChat.set(chatKey, messageIds);
}

async function deleteTemporaryMessages(ctx) {
  const chatKey = getChatKey(ctx);

  if (!chatKey) {
    return;
  }

  const messageIds = temporaryMessagesByChat.get(chatKey);

  if (!messageIds || messageIds.size === 0) {
    return;
  }

  await Promise.all(
    Array.from(messageIds).map((messageId) => {
      return ctx.telegram.deleteMessage(ctx.chat.id, messageId).catch(() => {});
    })
  );

  temporaryMessagesByChat.delete(chatKey);
}

async function deleteRemovableUserMessage(ctx) {
  const text = ctx.message?.text;

  if (!text) {
    return;
  }

  if (!text.startsWith('/') && !removableUserTexts.has(text)) {
    return;
  }

  await ctx.deleteMessage().catch(() => {});
}

async function ensureChatMenuButton(ctx) {
  if (!ctx.chat?.id || ctx.chat.type !== 'private') {
    return;
  }

  await configureChatMenuButton(ctx.telegram, ctx.chat.id).catch((error) => {
    console.error(`[bot:commands] failed to configure menu button for chat=${ctx.chat.id}`, error);
  });
}

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

    await ensureChatMenuButton(ctx);

    return next();
  });

  bot.use(async (ctx, next) => {
    const originalReply = ctx.reply.bind(ctx);

    ctx.reply = async (...args) => {
      const extra = withMainMenuReplyKeyboard(ctx, args[1]);
      const message = await originalReply(args[0], extra, ...args.slice(2));
      const chatKey = getChatKey(ctx);

      if (chatKey && hasInlineKeyboard(extra) && message?.message_id) {
        lastInlineKeyboardByChat.set(chatKey, message.message_id);
      }

      return message;
    };

    ctx.replyTemporary = async (...args) => {
      const message = await originalReply(...args);
      const extra = args[1];
      const chatKey = getChatKey(ctx);

      if (chatKey && hasInlineKeyboard(extra) && message?.message_id) {
        lastInlineKeyboardByChat.set(chatKey, message.message_id);
      }

      rememberTemporaryMessage(ctx, message);
      return message;
    };

    await deleteTemporaryMessages(ctx);

    if (ctx.callbackQuery?.message) {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
      const chatKey = getChatKey(ctx);

      if (
        chatKey &&
        lastInlineKeyboardByChat.get(chatKey) === ctx.callbackQuery.message.message_id
      ) {
        lastInlineKeyboardByChat.delete(chatKey);
      }
    } else if (ctx.message) {
      await hideLastInlineKeyboard(ctx);
      await deleteRemovableUserMessage(ctx);
    }

    return next();
  });

  registerAdminHandlers(bot);
  registerAccountHandlers(bot);
  registerCategoryHandlers(bot);
  registerGamificationHandlers(bot);
  registerMenuHandlers(bot);
  registerFamilyHandlers(bot);
  registerReminderHandlers(bot);
  registerPlannedPaymentHandlers(bot);
  registerStatsHandlers(bot);
  registerReportHandlers(bot);
  registerRecentHandlers(bot);
  registerClearExpensesHandlers(bot);
  registerDeleteExpenseHandlers(bot);
  registerEditExpenseHandlers(bot);
  registerExpenseHandlers(bot);
}

module.exports = { registerBot };
