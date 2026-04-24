const { prisma } = require('../db/prisma');

async function getDialogState(userId) {
  return prisma.dialogState.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      state: 'IDLE',
    },
    update: {},
  });
}

async function setDialogState(userId, state, payload = null) {
  return prisma.dialogState.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      state,
      payload,
    },
    update: {
      state,
      payload,
    },
  });
}

async function resetDialogState(userId) {
  return setDialogState(userId, 'IDLE', null);
}

module.exports = {
  getDialogState,
  resetDialogState,
  setDialogState,
};
