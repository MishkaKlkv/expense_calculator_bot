const {
  countActiveEventUsers,
  countBotEvents,
  createBotEvent,
  getTopBotEvents,
} = require('../repositories/botEvent.repository');

function getSinceDate(days) {
  const date = new Date();

  date.setDate(date.getDate() - days);
  return date;
}

function getEventDetails(ctx) {
  const updateType = ctx.updateType || 'unknown';
  const text = ctx.message?.text || '';
  const callbackData = ctx.callbackQuery?.data || '';

  if (text.startsWith('/')) {
    return {
      eventType: 'command',
      eventName: text.split(/\s+/u)[0].replace(/^\//u, ''),
    };
  }

  if (callbackData) {
    return {
      eventType: 'callback',
      eventName: callbackData.split(':')[0],
    };
  }

  if (updateType === 'message') {
    return {
      eventType: ctx.message?.voice ? 'voice' : 'message',
      eventName: ctx.message?.voice ? 'voice' : 'text',
    };
  }

  return {
    eventType: updateType,
    eventName: null,
  };
}

async function logBotEventFromContext(ctx) {
  const fromId = ctx.from?.id;
  const details = getEventDetails(ctx);

  return createBotEvent({
    telegramUserId: fromId ? BigInt(fromId) : null,
    updateType: ctx.updateType || 'unknown',
    eventType: details.eventType,
    eventName: details.eventName,
    payload: {
      chatType: ctx.chat?.type || null,
    },
  });
}

async function getBotUsageStats() {
  const since1d = getSinceDate(1);
  const since7d = getSinceDate(7);
  const since30d = getSinceDate(30);
  const [
    eventsTotal,
    events1d,
    events7d,
    active1d,
    active7d,
    active30d,
    topEvents7d,
  ] = await Promise.all([
    countBotEvents(),
    countBotEvents({ since: since1d }),
    countBotEvents({ since: since7d }),
    countActiveEventUsers({ since: since1d }),
    countActiveEventUsers({ since: since7d }),
    countActiveEventUsers({ since: since30d }),
    getTopBotEvents({ since: since7d, limit: 10 }),
  ]);

  return {
    active1d,
    active7d,
    active30d,
    events1d,
    events7d,
    eventsTotal,
    topEvents7d,
  };
}

module.exports = {
  getBotUsageStats,
  logBotEventFromContext,
};
