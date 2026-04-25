const { getUserCategoryNames } = require('./category.service');

function buildCategoryAliases(categories) {
  return new Map(
    categories.flatMap((category) => {
    const lower = category.toLowerCase();
    return [
      [lower, category],
      [lower.replace('ё', 'е'), category],
    ];
  })
  );
}

const KEYWORD_RULES = [
  ['Дети', ['дети', 'ребенок', 'ребёнок', 'садик', 'школа', 'игруш', 'подгуз', 'кружок']],
  ['Продукты', ['перекресток', 'перекрёсток', 'пятерочка', 'пятёрочка', 'магнит', 'ашан', 'лента', 'вкусвилл', 'овощ', 'молоко', 'хлеб']],
  ['Такси', ['такси', 'uber', 'яндекс go', 'yandex go']],
  ['Транспорт', ['метро', 'автобус', 'тройка', 'электрич', 'самокат']],
  ['Рестораны', ['ресторан', 'кафе', 'доставка', 'еда', 'бургер', 'суши']],
  ['Кофе', ['кофе', 'coffee', 'кофей']],
  ['Связь', ['телефон', 'мтс', 'билайн', 'мегафон', 'tele2', 'связь']],
  ['Интернет', ['интернет', 'провайдер']],
  ['Одежда', ['одежд', 'куртка', 'ботинки', 'кроссовки', 'футболка']],
  ['Аптека', ['аптека', 'лекар', 'витамин']],
  ['Здоровье', ['врач', 'клиника', 'анализ', 'стоматолог']],
  ['Развлечения', ['кино', 'театр', 'концерт', 'развлеч']],
  ['Подписки', ['подписка', 'netflix', 'spotify', 'youtube', 'яндекс плюс']],
  ['Авто', ['бензин', 'парковка', 'мойка', 'шиномонтаж']],
];

function normalize(value) {
  return value.toLowerCase().replace('ё', 'е').trim();
}

function getCategoryFromPrefix(text, categories) {
  const categoryAliases = buildCategoryAliases(categories);
  const input = text.trim().replace(/\s+/g, ' ');
  const words = input.split(' ');

  for (let length = Math.min(2, words.length - 1); length >= 1; length -= 1) {
    const prefix = normalize(words.slice(0, length).join(' '));
    const category = categoryAliases.get(prefix);

    if (category) {
      const rest = words.slice(length).join(' ');
      const textWithoutCategory = /^\d/.test(rest) ? `${category} ${rest}` : rest;

      return {
        category,
        textWithoutCategory,
      };
    }
  }

  return null;
}

async function inferCategory(text, userId) {
  const categories = await getUserCategoryNames({ userId, type: 'EXPENSE' });
  const normalizedText = normalize(text);
  const prefixResult = getCategoryFromPrefix(text, categories);

  if (prefixResult) {
    return prefixResult;
  }

  const rule = KEYWORD_RULES.find(([category, keywords]) => {
    if (!categories.includes(category)) {
      return false;
    }

    return keywords.some((keyword) => normalizedText.includes(normalize(keyword)));
  });

  if (!rule) {
    return null;
  }

  return {
    category: rule[0],
    textWithoutCategory: text,
  };
}

module.exports = { inferCategory };
