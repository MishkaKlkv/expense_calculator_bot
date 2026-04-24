const { prisma } = require('../db/prisma');

async function createBotEvent(data) {
  return prisma.botEvent.create({
    data,
  });
}

async function countBotEvents({ since } = {}) {
  return prisma.botEvent.count({
    where: since
      ? {
          createdAt: {
            gte: since,
          },
        }
      : undefined,
  });
}

async function countActiveEventUsers({ since } = {}) {
  const rows = await prisma.botEvent.groupBy({
    by: ['telegramUserId'],
    where: {
      telegramUserId: {
        not: null,
      },
      ...(since
        ? {
            createdAt: {
              gte: since,
            },
          }
        : {}),
    },
  });

  return rows.length;
}

async function getTopBotEvents({ since, limit = 10 } = {}) {
  return prisma.botEvent.groupBy({
    by: ['eventType', 'eventName'],
    where: since
      ? {
          createdAt: {
            gte: since,
          },
        }
      : undefined,
    _count: {
      _all: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
    take: limit,
  });
}

module.exports = {
  countActiveEventUsers,
  countBotEvents,
  createBotEvent,
  getTopBotEvents,
};
