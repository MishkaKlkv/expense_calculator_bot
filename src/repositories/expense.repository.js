const { prisma } = require('../db/prisma');

async function createExpense(data) {
  return prisma.expense.create({
    data,
  });
}

function buildUserWhere({ userId, userIds }) {
  if (userIds) {
    return {
      in: userIds,
    };
  }

  return userId;
}

async function findRecentExpenses({ userId, userIds, limit = 10 }) {
  return prisma.expense.findMany({
    where: {
      userId: buildUserWhere({ userId, userIds }),
      type: 'EXPENSE',
    },
    include: {
      user: true,
    },
    orderBy: {
      expenseDate: 'desc',
    },
    take: limit,
  });
}

async function findExpensesInRange({ userId, userIds, start, end }) {
  return prisma.expense.findMany({
    where: {
      userId: buildUserWhere({ userId, userIds }),
      type: 'EXPENSE',
      expenseDate: {
        gte: start,
        lt: end,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      expenseDate: 'desc',
    },
  });
}

async function findTopExpenses({ userId, userIds, start, end, limit = 5 }) {
  return prisma.expense.findMany({
    where: {
      userId: buildUserWhere({ userId, userIds }),
      type: 'EXPENSE',
      expenseDate: {
        gte: start,
        lt: end,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      amount: 'desc',
    },
    take: limit,
  });
}

async function findExpenseByIdForUser({ id, userId }) {
  return prisma.expense.findFirst({
    where: {
      id,
      userId,
      type: 'EXPENSE',
    },
  });
}

async function updateExpenseByIdForUser({ id, userId, data }) {
  return prisma.expense.updateMany({
    where: {
      id,
      userId,
      type: 'EXPENSE',
    },
    data,
  });
}

async function deleteExpenseByIdForUser({ id, userId }) {
  return prisma.expense.deleteMany({
    where: {
      id,
      userId,
      type: 'EXPENSE',
    },
  });
}

async function aggregateExpensesByCategory({ userId, userIds, start, end }) {
  return prisma.expense.groupBy({
    by: ['category', 'currency'],
    where: {
      userId: buildUserWhere({ userId, userIds }),
      type: 'EXPENSE',
      expenseDate: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      amount: true,
      cashback: true,
    },
    orderBy: {
      category: 'asc',
    },
  });
}

async function aggregateExpensesByUser({ userIds, start, end }) {
  return prisma.expense.groupBy({
    by: ['userId', 'currency'],
    where: {
      userId: {
        in: userIds,
      },
      type: 'EXPENSE',
      expenseDate: {
        gte: start,
        lt: end,
      },
    },
    _sum: {
      amount: true,
      cashback: true,
    },
  });
}

module.exports = {
  aggregateExpensesByCategory,
  aggregateExpensesByUser,
  createExpense,
  deleteExpenseByIdForUser,
  findExpensesInRange,
  findExpenseByIdForUser,
  findRecentExpenses,
  findTopExpenses,
  updateExpenseByIdForUser,
};
