function formatMoney(amount, currency) {
  const value = Number(amount);

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

module.exports = { formatMoney };
