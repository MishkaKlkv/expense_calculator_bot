const { prisma } = require('../db/prisma');

async function findUsersWithoutBuyNothingDayDelivery({ telegramUserIds, eventYear }) {
  if (telegramUserIds.length === 0) {
    return [];
  }

  return prisma.telegramUser.findMany({
    where: {
      telegramUserId: {
        in: telegramUserIds,
      },
      buyNothingDayDeliveries: {
        none: {
          eventYear,
        },
      },
    },
  });
}

async function markBuyNothingDaySent({ userId, eventYear }) {
  return prisma.buyNothingDayDelivery.upsert({
    where: {
      userId_eventYear: {
        userId,
        eventYear,
      },
    },
    create: {
      userId,
      eventYear,
    },
    update: {
      sentAt: new Date(),
    },
  });
}

module.exports = {
  findUsersWithoutBuyNothingDayDelivery,
  markBuyNothingDaySent,
};
