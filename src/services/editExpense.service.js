const {
  findExpenseByIdForUser,
  findRecentExpenses,
  updateExpenseByIdForUser,
} = require('../repositories/expense.repository');
const { EXPENSE_CATEGORIES } = require('../constants/categories');
const { parseAmountWithCurrency } = require('./parser.service');
const { parseCashbackForExpense } = require('./expense.service');

async function getEditableExpenses(userId, limit = 10) {
  return findRecentExpenses({ userId, limit });
}

async function getExpenseForEdit({ expenseId, userId }) {
  return findExpenseByIdForUser({ id: expenseId, userId });
}

function normalizeCategory(value) {
  const input = value.trim().toLowerCase();
  return EXPENSE_CATEGORIES.find((category) => category.toLowerCase() === input) || null;
}

function parseEditValue({ field, value, expense }) {
  if (field === 'category') {
    const category = normalizeCategory(value);

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

    if (Number(expense.cashback || 0) > Number(parsed.amount)) {
      return { ok: false, reason: 'CASHBACK_TOO_HIGH' };
    }

    return {
      ok: true,
      data: {
        amount: parsed.amount,
        currency: parsed.currency,
      },
    };
  }

  if (field === 'cashback') {
    const parsed = parseCashbackForExpense({
      messageText: value,
      currency: expense.currency,
      amount: expense.amount,
    });

    if (!parsed.ok) {
      return parsed;
    }

    return {
      ok: true,
      data: {
        cashback: parsed.cashback,
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

  const parsed = parseEditValue({ field, value, expense });

  if (!parsed.ok) {
    return parsed;
  }

  const result = await updateExpenseByIdForUser({
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
