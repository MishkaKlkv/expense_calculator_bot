const { prisma } = require('../db/prisma');

async function incrementAutoCategoryStat({ type, phrase, category }) {
  return prisma.autoCategoryStat.upsert({
    where: {
      type_phrase_category: {
        type,
        phrase,
        category,
      },
    },
    create: {
      type,
      phrase,
      category,
      hits: 1,
    },
    update: {
      hits: {
        increment: 1,
      },
      lastSeenAt: new Date(),
    },
  });
}

async function findAutoCategoryStats(type) {
  return prisma.autoCategoryStat.findMany({
    where: {
      type,
    },
    orderBy: [
      {
        phrase: 'asc',
      },
      {
        hits: 'desc',
      },
    ],
  });
}

module.exports = {
  findAutoCategoryStats,
  incrementAutoCategoryStat,
};
