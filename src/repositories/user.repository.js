const { prisma } = require('../db/prisma');

async function upsertTelegramUser(from) {
  return prisma.telegramUser.upsert({
    where: {
      telegramUserId: BigInt(from.id),
    },
    create: {
      telegramUserId: BigInt(from.id),
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
}

async function findAllTelegramUsers() {
  return prisma.telegramUser.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });
}

module.exports = { findAllTelegramUsers, upsertTelegramUser };
