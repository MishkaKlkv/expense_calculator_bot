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
  findPlannedPaymentByIdForUser,
  findPlannedPayments,
};
