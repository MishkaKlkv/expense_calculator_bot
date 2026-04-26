const { prisma } = require('../db/prisma');

async function createAccount(data) {
  return prisma.account.create({ data });
}

async function findAccounts(userId) {
  return prisma.account.findMany({
    where: {
      userId,
    },
    orderBy: [
      { kind: 'asc' },
      { createdAt: 'asc' },
    ],
  });
}

async function findAccountByName({ userId, name }) {
  return prisma.account.findFirst({
    where: {
      userId,
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });
}

async function updateAccountByIdForUser({ id, userId, data }) {
  return prisma.account.updateMany({
    where: {
      id,
      userId,
    },
    data,
  });
}

async function deleteAccountByIdForUser({ id, userId }) {
  return prisma.account.deleteMany({
    where: {
      id,
      userId,
    },
  });
}

module.exports = {
  createAccount,
  deleteAccountByIdForUser,
  findAccountByName,
  findAccounts,
  updateAccountByIdForUser,
};
