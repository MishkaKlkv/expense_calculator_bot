const { prisma } = require('../db/prisma');

async function upsertDailyReminder({ userId, timeOfDay, timezone, lastSentDate }) {
  return prisma.dailyReminder.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      timeOfDay,
      timezone,
      enabled: true,
      lastSentDate,
    },
    update: {
      timeOfDay,
      timezone,
      enabled: true,
      lastSentDate,
    },
  });
}

async function findDailyReminderByUserId(userId) {
  return prisma.dailyReminder.findUnique({
    where: {
      userId,
    },
  });
}

async function setDailyReminderEnabled({ userId, enabled }) {
  return prisma.dailyReminder.updateMany({
    where: {
      userId,
    },
    data: {
      enabled,
    },
  });
}

async function findEnabledDailyReminders() {
  return prisma.dailyReminder.findMany({
    where: {
      enabled: true,
    },
    include: {
      user: true,
    },
  });
}

async function markDailyReminderSent({ id, sentDate }) {
  return prisma.dailyReminder.update({
    where: {
      id,
    },
    data: {
      lastSentDate: sentDate,
    },
  });
}

module.exports = {
  findDailyReminderByUserId,
  findEnabledDailyReminders,
  markDailyReminderSent,
  setDailyReminderEnabled,
  upsertDailyReminder,
};
