const { prisma } = require('../db/prisma');

const ACTIVE_STATE_TTL_MS = 30 * 60 * 1000;

function isExpired(state) {
  if (!state || state.state === 'IDLE') {
    return false;
  }

  return Date.now() - state.updatedAt.getTime() > ACTIVE_STATE_TTL_MS;
}

async function getDialogState(userId) {
  const state = await prisma.dialogState.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      state: 'IDLE',
    },
    update: {},
  });

  if (!isExpired(state)) {
    return state;
  }

  return resetDialogState(userId);
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
