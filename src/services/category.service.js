const {
  createCategory,
  createManyCategories,
  deleteCategoryByName,
  findCategories,
  findCategoryByName,
} = require('../repositories/category.repository');
const { EXPENSE_CATEGORIES, INCOME_CATEGORIES } = require('../constants/categories');

const CATEGORY_TYPES = ['EXPENSE', 'INCOME'];

function normalizeCategoryName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeCategoryType(type) {
  const normalized = type.trim().toUpperCase();

  if (['EXPENSE', 'EXPENSES', 'EXPENCE', 'EXPENCES', 'РАСХОД', 'РАСХОДЫ'].includes(normalized)) {
    return 'EXPENSE';
  }

  if (['INCOME', 'INCOMES', 'ДОХОД', 'ДОХОДЫ'].includes(normalized)) {
    return 'INCOME';
  }

  return null;
}

function getDefaultCategoryNames(type) {
  return type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

async function ensureDefaultCategories(userId) {
  const existingByType = await Promise.all(
    CATEGORY_TYPES.map(async (type) => ({
      type,
      categories: await findCategories({ userId, type }),
    }))
  );
  const data = existingByType.flatMap(({ type, categories }) => {
    if (categories.length > 0) {
      return [];
    }

    return getDefaultCategoryNames(type).map((name, index) => ({
      userId,
      type,
      name,
      sortOrder: index,
    }));
  });

  if (data.length === 0) {
    return;
  }

  await createManyCategories(data);
}

async function getUserCategories({ userId, type }) {
  await ensureDefaultCategories(userId);
  return findCategories({ userId, type });
}

async function getUserCategoryNames({ userId, type }) {
  const categories = await getUserCategories({ userId, type });

  return categories.map((category) => category.name);
}

async function findUserCategoryName({ userId, type, name }) {
  await ensureDefaultCategories(userId);
  const category = await findCategoryByName({
    userId,
    type,
    name: normalizeCategoryName(name),
  });

  return category?.name || null;
}

async function addUserCategory({ userId, type, name }) {
  const categoryType = normalizeCategoryType(type);
  const categoryName = normalizeCategoryName(name);

  if (!categoryType) {
    return { ok: false, reason: 'UNKNOWN_TYPE' };
  }

  if (!categoryName) {
    return { ok: false, reason: 'EMPTY_NAME' };
  }

  await ensureDefaultCategories(userId);
  const existing = await findCategoryByName({
    userId,
    type: categoryType,
    name: categoryName,
  });

  if (existing) {
    return { ok: false, reason: 'ALREADY_EXISTS', category: existing };
  }

  const category = await createCategory({
    userId,
    type: categoryType,
    name: categoryName,
  });

  return { ok: true, category };
}

async function deleteUserCategory({ userId, type, name }) {
  const categoryType = normalizeCategoryType(type);
  const categoryName = normalizeCategoryName(name);

  if (!categoryType) {
    return { ok: false, reason: 'UNKNOWN_TYPE' };
  }

  if (!categoryName) {
    return { ok: false, reason: 'EMPTY_NAME' };
  }

  await ensureDefaultCategories(userId);
  const categories = await findCategories({ userId, type: categoryType });

  if (categories.length <= 1) {
    return { ok: false, reason: 'LAST_CATEGORY' };
  }

  const result = await deleteCategoryByName({
    userId,
    type: categoryType,
    name: categoryName,
  });

  return { ok: result.count > 0, count: result.count };
}

module.exports = {
  addUserCategory,
  deleteUserCategory,
  ensureDefaultCategories,
  findUserCategoryName,
  getUserCategoryNames,
  getUserCategories,
  normalizeCategoryType,
};
