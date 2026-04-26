const {
  createAccount,
  deleteAccountByIdForUser,
  findAccountByName,
  findAccounts,
  updateAccountByIdForUser,
} = require('../repositories/account.repository');
const { parseAmountWithCurrency } = require('./parser.service');

function normalizeAccountName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeAccountKind(kind) {
  const normalized = kind.trim().toUpperCase();

  if (['AVAILABLE', 'ДОСТУПНО', 'ДОСТУПНЫЕ', 'ТРАТЫ', 'МОЖНО'].includes(normalized)) {
    return 'AVAILABLE';
  }

  if (['SAVINGS', 'НАКОПЛЕНИЯ', 'НАКОПЛЕНО', 'ВКЛАД', 'ИНВЕСТИЦИИ'].includes(normalized)) {
    return 'SAVINGS';
  }

  return null;
}

function parseAccountInput(input) {
  const parts = input
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 3) {
    return { ok: false, reason: 'INVALID_FORMAT' };
  }

  const name = normalizeAccountName(parts[0]);
  const kind = normalizeAccountKind(parts[1]);
  const balance = parseAmountWithCurrency(parts[2]);

  if (!name) {
    return { ok: false, reason: 'EMPTY_NAME' };
  }

  if (!kind) {
    return { ok: false, reason: 'UNKNOWN_KIND' };
  }

  if (!balance) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }

  return {
    account: {
      balance: balance.amount,
      currency: balance.currency,
      kind,
      name,
    },
    ok: true,
  };
}

async function addAccount({ userId, input }) {
  const parsed = parseAccountInput(input);

  if (!parsed.ok) {
    return parsed;
  }

  const existing = await findAccountByName({ userId, name: parsed.account.name });

  if (existing) {
    return { ok: false, reason: 'ALREADY_EXISTS' };
  }

  const account = await createAccount({
    ...parsed.account,
    userId,
  });

  return { account, ok: true };
}

async function getAccounts(userId) {
  return findAccounts(userId);
}

async function setAccountBalance({ userId, id, amountText }) {
  const parsed = parseAmountWithCurrency(amountText);

  if (!parsed) {
    return { ok: false, reason: 'INVALID_AMOUNT' };
  }

  const result = await updateAccountByIdForUser({
    id,
    userId,
    data: {
      balance: parsed.amount,
      currency: parsed.currency,
    },
  });

  return { ok: result.count > 0 };
}

async function deleteAccount({ userId, id }) {
  const result = await deleteAccountByIdForUser({ id, userId });

  return { ok: result.count > 0 };
}

function summarizeAccounts(accounts) {
  const totals = {
    AVAILABLE: new Map(),
    SAVINGS: new Map(),
    TOTAL: new Map(),
  };

  accounts.forEach((account) => {
    const amount = Number(account.balance || 0);
    const kindTotals = totals[account.kind];

    kindTotals.set(account.currency, (kindTotals.get(account.currency) || 0) + amount);
    totals.TOTAL.set(account.currency, (totals.TOTAL.get(account.currency) || 0) + amount);
  });

  return totals;
}

module.exports = {
  addAccount,
  deleteAccount,
  getAccounts,
  normalizeAccountKind,
  parseAccountInput,
  setAccountBalance,
  summarizeAccounts,
};
