const { prisma } = require('../db/prisma');

async function createPlannedPayment(data) {
  return prisma.plannedPayment.create({ data });
}

async function findPlannedPayments({ userId, enabledOnly = false }) {
  return prisma.plannedPayment.findMany({
    where: {
      userId,
      ...(enabledOnly ? { enabled: true } : {}),
    },
    orderBy: [
      { dayOfMonth: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

async function findPlannedPaymentByIdForUser({ id, userId }) {
  return prisma.plannedPayment.findFirst({
    where: {
      id,
      userId,
    },
  });
}

async function findPlannedPaymentById(id) {
  return prisma.plannedPayment.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });
}

async function findReminderEnabledPlannedPayments() {
  return prisma.plannedPayment.findMany({
    where: {
      enabled: true,
      reminderEnabled: true,
    },
    include: {
      user: true,
    },
    orderBy: [
      { dayOfMonth: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

async function updatePlannedPaymentByIdForUser({ id, userId, data }) {
  return prisma.plannedPayment.updateMany({
    where: {
      id,
      userId,
    },
    data,
  });
}

async function markPlannedPaymentReminderSent({ id, sentMonth }) {
  return prisma.plannedPayment.update({
    where: {
      id,
    },
    data: {
      lastReminderSentMonth: sentMonth,
    },
  });
}

async function deletePlannedPaymentByIdForUser({ id, userId }) {
  return prisma.plannedPayment.deleteMany({
    where: {
      id,
      userId,
    },
  });
}

module.exports = {
  createPlannedPayment,
  deletePlannedPaymentByIdForUser,
  findPlannedPaymentById,
  findPlannedPaymentByIdForUser,
  findPlannedPayments,
  findReminderEnabledPlannedPayments,
  markPlannedPaymentReminderSent,
  updatePlannedPaymentByIdForUser,
};
