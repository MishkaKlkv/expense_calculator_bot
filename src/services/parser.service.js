const { CURRENCY_ALIASES } = require('../constants/currencies');

function normalizeAmount(value) {
  return value.replace(',', '.');
}

function normalizeCurrency(value) {
  if (!value) {
    return null;
  }

  return CURRENCY_ALIASES[value.toLowerCase()];
}

function parseExpenseMessage(text) {
  const input = text.trim().replace(/\s+/g, ' ');
  const match = input.match(/(.+?)\s+(\d+(?:[.,]\d{1,2})?)\s*([a-zA-Zа-яА-ЯёЁ₽$]+)?$/u);

  if (!match) {
    return null;
  }

  const description = match[1].trim();
  const amount = normalizeAmount(match[2]);
  const currency = normalizeCurrency(match[3]) || 'RUB';

  if (!description || Number(amount) <= 0) {
    return null;
  }

  return {
    description,
    amount,
    currency,
  };
}

function parseAmountWithCurrency(text, defaultCurrency = 'RUB') {
  const input = text.trim().replace(/\s+/g, ' ');
  const match = input.match(/^(\d+(?:[.,]\d{1,2})?)\s*([a-zA-Zа-яА-ЯёЁ₽$]+)?$/u);

  if (!match) {
    return null;
  }

  const amount = normalizeAmount(match[1]);
  const currency = normalizeCurrency(match[2]) || defaultCurrency;

  if (Number(amount) <= 0) {
    return null;
  }

  return {
    amount,
    currency,
  };
}

module.exports = { parseAmountWithCurrency, parseExpenseMessage };
