const { prisma } = require('../db/prisma');

async function findReminderSuggestionCandidates({ telegramUserIds, limit = 100 }) {
  if (telegramUserIds.length === 0) {
    return [];
  }

  return prisma.telegramUser.findMany({
    where: {
      telegramUserId: {
        in: telegramUserIds,
      },
      dailyReminder: {
        is: null,
      },
      reminderSuggestionPrompt: {
        is: null,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
  });
}

async function markReminderSuggestionPromptSent(userId) {
  return prisma.reminderSuggestionPrompt.upsert({
    where: {
      userId,
    },
    create: {
      userId,
    },
    update: {},
  });
}

module.exports = {
  findReminderSuggestionCandidates,
  markReminderSuggestionPromptSent,
};
