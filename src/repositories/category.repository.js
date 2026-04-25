const { prisma } = require('../db/prisma');

async function createManyCategories(categories) {
  return prisma.userCategory.createMany({
    data: categories,
    skipDuplicates: true,
  });
}

async function findCategories({ userId, type }) {
  return prisma.userCategory.findMany({
    where: {
      userId,
      type,
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

async function findCategoryByName({ userId, type, name }) {
  return prisma.userCategory.findFirst({
    where: {
      userId,
      type,
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });
}

async function createCategory({ userId, type, name }) {
  return prisma.userCategory.create({
    data: {
      userId,
      type,
      name,
    },
  });
}

async function deleteCategoryByName({ userId, type, name }) {
  return prisma.userCategory.deleteMany({
    where: {
      userId,
      type,
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });
}

module.exports = {
  createCategory,
  createManyCategories,
  deleteCategoryByName,
  findCategories,
  findCategoryByName,
};
