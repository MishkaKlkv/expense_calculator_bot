const {
  createCategory,
  createManyCategories,
  deleteCategoryByName,
  deleteCategoryByNameForUsers,
  findCategories,
  findCategoriesForUsers,
  findCategoryByName,
} = require('../repositories/category.repository');
const { getFamilyForUser } = require('../repositories/family.repository');
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

function getCategoryKey(category) {
  return `${category.type}:${category.name.trim().toLowerCase()}`;
}

async function getFamilyUserIds(userId) {
  const membership = await getFamilyForUser(userId);

  if (!membership) {
    return [userId];
  }

  return membership.familyAccount.members.map((member) => member.userId);
}

async function ensureFamilyCategories(userId) {
  const userIds = await getFamilyUserIds(userId);

  if (userIds.length <= 1) {
    return userIds;
  }

  await Promise.all(userIds.map((memberUserId) => ensureDefaultCategories(memberUserId)));

  const categories = await findCategoriesForUsers({ userIds });
  const sharedCategoriesByKey = new Map();

  categories.forEach((category) => {
    const key = getCategoryKey(category);

    if (!sharedCategoriesByKey.has(key)) {
      sharedCategoriesByKey.set(key, {
        name: category.name,
        sortOrder: category.sortOrder,
        type: category.type,
      });
    }
  });

  const existingKeysByUserId = new Map(
    userIds.map((memberUserId) => [memberUserId, new Set()])
  );

  categories.forEach((category) => {
    existingKeysByUserId.get(category.userId)?.add(getCategoryKey(category));
  });

  const data = [];

  userIds.forEach((memberUserId) => {
    const existingKeys = existingKeysByUserId.get(memberUserId);

    sharedCategoriesByKey.forEach((category, key) => {
      if (existingKeys.has(key)) {
        return;
      }

      data.push({
        userId: memberUserId,
        type: category.type,
        name: category.name,
        sortOrder: category.sortOrder,
      });
    });
  });

  if (data.length > 0) {
    await createManyCategories(data);
  }

  return userIds;
}

async function getUserCategories({ userId, type }) {
  await ensureDefaultCategories(userId);
  await ensureFamilyCategories(userId);
  return findCategories({ userId, type });
}

async function getUserCategoryNames({ userId, type }) {
  const categories = await getUserCategories({ userId, type });

  return categories
    .map((category) => category.name)
    .sort((left, right) => left.localeCompare(right, 'ru'));
}

async function findUserCategoryName({ userId, type, name }) {
  await ensureDefaultCategories(userId);
  await ensureFamilyCategories(userId);
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
  const userIds = await ensureFamilyCategories(userId);
  const existing = await findCategoryByName({
    userId,
    type: categoryType,
    name: categoryName,
  });

  if (existing) {
    return { ok: false, reason: 'ALREADY_EXISTS', category: existing };
  }

  if (userIds.length > 1) {
    await createManyCategories(
      userIds.map((memberUserId) => ({
        userId: memberUserId,
        type: categoryType,
        name: categoryName,
      }))
    );
  } else {
    await createCategory({
      userId,
      type: categoryType,
      name: categoryName,
    });
  }

  const category = await findCategoryByName({
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
  const userIds = await ensureFamilyCategories(userId);
  const categories = await findCategories({ userId, type: categoryType });

  if (categories.length <= 1) {
    return { ok: false, reason: 'LAST_CATEGORY' };
  }

  const result =
    userIds.length > 1
      ? await deleteCategoryByNameForUsers({
          userIds,
          type: categoryType,
          name: categoryName,
        })
      : await deleteCategoryByName({
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
  syncFamilyCategoriesForUser: ensureFamilyCategories,
};
