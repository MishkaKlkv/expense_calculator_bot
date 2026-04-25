const { prisma } = require('../db/prisma');

async function findWeeklyReportDelivery(userId) {
  return prisma.weeklyReportDelivery.findUnique({
    where: {
      userId,
    },
  });
}

async function markWeeklyReportSent({ userId, weekKey }) {
  return prisma.weeklyReportDelivery.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      lastSentWeek: weekKey,
    },
    update: {
      lastSentWeek: weekKey,
    },
  });
}

module.exports = {
  findWeeklyReportDelivery,
  markWeeklyReportSent,
};
