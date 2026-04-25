const {
  findRecentTransactions,
  findTransactionByIdForUser,
  updateTransactionByIdForUser,
} = require('../repositories/expense.repository');
const { findUserCategoryName } = require('./category.service');
const { parseAmountWithCurrency } = require('./parser.service');

async function getEditableExpenses(userId, limit = 10) {
  return findRecentTransactions({ userId, limit });
}

async function getExpenseForEdit({ expenseId, userId }) {
  return findTransactionByIdForUser({ id: expenseId, userId });
}

async function parseEditValue({ field, value, expense, userId }) {
  if (field === 'category') {
    const category = await findUserCategoryName({
      userId,
      type: expense.type,
      name: value,
    });

    if (!category) {
      return { ok: false, reason: 'UNKNOWN_CATEGORY' };
    }

    return { ok: true, data: { category } };
  }

  if (field === 'description') {
    const description = value.trim();

    if (!description) {
      return { ok: false, reason: 'EMPTY_DESCRIPTION' };
    }

    return { ok: true, data: { description } };
  }

  if (field === 'amount') {
    const parsed = parseAmountWithCurrency(value, expense.currency);

    if (!parsed) {
      return { ok: false, reason: 'INVALID_AMOUNT' };
    }

    return {
      ok: true,
      data: {
        amount: parsed.amount,
        currency: parsed.currency,
      },
    };
  }

  return { ok: false, reason: 'UNKNOWN_FIELD' };
}

async function updateExpenseField({ expenseId, userId, field, value }) {
  const expense = await getExpenseForEdit({ expenseId, userId });

  if (!expense) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const parsed = await parseEditValue({ field, value, expense, userId });

  if (!parsed.ok) {
    return parsed;
  }

  const result = await updateTransactionByIdForUser({
    id: expenseId,
    userId,
    data: parsed.data,
  });

  return { ok: result.count === 1 };
}

module.exports = {
  getEditableExpenses,
  getExpenseForEdit,
  updateExpenseField,
};
