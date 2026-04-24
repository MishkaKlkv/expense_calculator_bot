const SUPPORTED_CURRENCIES = ['RUB', 'USD'];

const CURRENCY_ALIASES = {
  rub: 'RUB',
  rouble: 'RUB',
  roubles: 'RUB',
  ruble: 'RUB',
  rubles: 'RUB',
  rur: 'RUB',
  руб: 'RUB',
  рубль: 'RUB',
  рубля: 'RUB',
  рублей: 'RUB',
  р: 'RUB',
  '₽': 'RUB',
  usd: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  бакс: 'USD',
  бакса: 'USD',
  баксов: 'USD',
  доллар: 'USD',
  доллара: 'USD',
  долларов: 'USD',
  '$': 'USD',
};

module.exports = { CURRENCY_ALIASES, SUPPORTED_CURRENCIES };
