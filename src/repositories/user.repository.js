const { prisma } = require('../db/prisma');

async function upsertTelegramUser(from) {
  const telegramUserId = BigInt(from.id);
  const existing = await prisma.telegramUser.findUnique({
    where: {
      telegramUserId,
    },
    select: {
      id: true,
    },
  });
  const user = await prisma.telegramUser.upsert({
    where: {
      telegramUserId,
    },
    create: {
      telegramUserId,
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
      dialogState: {
        create: {
          state: 'IDLE',
        },
      },
    },
    update: {
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
    },
    include: {
      dialogState: true,
    },
  });

  return {
    ...user,
    isNewUser: !existing,
  };
}

async function findAllTelegramUsers() {
  return prisma.telegramUser.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });
}

module.exports = { findAllTelegramUsers, upsertTelegramUser };
