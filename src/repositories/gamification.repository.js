const { prisma } = require('../db/prisma');

async function ensureGamification(userId) {
  return prisma.userGamification.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function findGamification(userId) {
  return prisma.userGamification.findUnique({
    where: { userId },
  });
}

async function updateGamification({ userId, data }) {
  return prisma.userGamification.update({
    where: { userId },
    data,
  });
}

async function createTrackedDay({ userId, dateKey, source, xpAwarded }) {
  return prisma.trackedDay.create({
    data: {
      userId,
      dateKey,
      source,
      xpAwarded,
    },
  });
}

async function updateTrackedDayXp({ id, xpAwarded }) {
  return prisma.trackedDay.update({
    where: {
      id,
    },
    data: {
      xpAwarded,
    },
  });
}

async function findTrackedDay({ userId, dateKey }) {
  return prisma.trackedDay.findUnique({
    where: {
      userId_dateKey: {
        userId,
        dateKey,
      },
    },
  });
}

async function findTrackedDays({ userId, startDateKey, endDateKey }) {
  return prisma.trackedDay.findMany({
    where: {
      userId,
      ...(startDateKey && endDateKey
        ? {
            dateKey: {
              gte: startDateKey,
              lt: endDateKey,
            },
          }
        : {}),
    },
    orderBy: {
      dateKey: 'desc',
    },
  });
}

async function countTrackedDays({ userId, startDateKey, endDateKey }) {
  return prisma.trackedDay.count({
    where: {
      userId,
      dateKey: {
        gte: startDateKey,
        lt: endDateKey,
      },
    },
  });
}

async function unlockAchievement({ userId, code }) {
  try {
    return {
      achievement: await prisma.userAchievement.create({
        data: {
          userId,
          code,
        },
      }),
      created: true,
    };
  } catch (error) {
    if (error.code === 'P2002') {
      return { achievement: null, created: false };
    }

    throw error;
  }
}

async function findAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: {
      userId,
    },
    orderBy: {
      unlockedAt: 'asc',
    },
  });
}

module.exports = {
  countTrackedDays,
  createTrackedDay,
  ensureGamification,
  findAchievements,
  findGamification,
  findTrackedDay,
  findTrackedDays,
  unlockAchievement,
  updateTrackedDayXp,
  updateGamification,
};
