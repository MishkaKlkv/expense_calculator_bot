const { getUserCategoryNames } = require('./category.service');
const {
  findAutoCategoryStats,
  incrementAutoCategoryStat,
} = require('../repositories/autoCategory.repository');

const LEARNED_RULES_CACHE_TTL_MS = 60 * 60 * 1000;
const MIN_LEARNED_RULE_HITS = 5;
const MIN_LEARNED_RULE_CONFIDENCE = 0.8;
const IGNORED_LEARNING_CATEGORIES = new Set(['другое']);
const STOP_PHRASES = new Set([
  'apple',
  'google',
  'online',
  'yandex',
  'яндекс',
  'магазин',
  'маркет',
  'онлайн',
  'оплата',
  'перевод',
  'платеж',
  'платёж',
  'покупка',
  'расход',
  'сбер',
  'сервис',
  'услуга',
]);

let learnedRulesCache = {
  loadedAt: 0,
  rules: [],
};

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
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

function normalizePhrase(value) {
  return normalize(value)
    .replace(/[^0-9a-zа-я\s-]/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidLearningPhrase(phrase) {
  if (!phrase || phrase.length < 3) {
    return false;
  }

  if (STOP_PHRASES.has(phrase)) {
    return false;
  }

  if (/^\d+$/u.test(phrase)) {
    return false;
  }

  return true;
}

function extractLearningPhrases(description) {
  const normalized = normalizePhrase(description);
  const words = normalized.split(' ').filter(Boolean);
  const phrases = [];

  if (words.length >= 2) {
    phrases.push(words.slice(0, 2).join(' '));
  }

  if (words.length >= 1) {
    phrases.push(words[0]);
  }

  return Array.from(new Set(phrases.filter(isValidLearningPhrase)));
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

  try {
    const learnedResult = await getCategoryFromLearnedRules(text, categories);

    if (learnedResult) {
      return learnedResult;
    }
  } catch (error) {
    console.error('[auto-category] failed to load learned rules', error);
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

function buildActiveLearnedRules(stats) {
  const byPhrase = new Map();

  stats.forEach((stat) => {
    const phraseStats = byPhrase.get(stat.phrase) || {
      rows: [],
      totalHits: 0,
    };

    phraseStats.rows.push(stat);
    phraseStats.totalHits += stat.hits;
    byPhrase.set(stat.phrase, phraseStats);
  });

  const rules = [];

  byPhrase.forEach(({ rows, totalHits }, phrase) => {
    const best = rows.sort((left, right) => right.hits - left.hits)[0];
    const confidence = best.hits / totalHits;

    if (best.hits < MIN_LEARNED_RULE_HITS || confidence < MIN_LEARNED_RULE_CONFIDENCE) {
      return;
    }

    rules.push({
      category: best.category,
      confidence,
      hits: best.hits,
      phrase,
    });
  });

  return rules.sort((left, right) => {
    if (right.phrase.length !== left.phrase.length) {
      return right.phrase.length - left.phrase.length;
    }

    return right.hits - left.hits;
  });
}

async function getActiveLearnedRules() {
  const now = Date.now();

  if (now - learnedRulesCache.loadedAt < LEARNED_RULES_CACHE_TTL_MS) {
    return learnedRulesCache.rules;
  }

  const stats = await findAutoCategoryStats('EXPENSE');
  const rules = buildActiveLearnedRules(stats);

  learnedRulesCache = {
    loadedAt: now,
    rules,
  };

  return rules;
}

async function getCategoryFromLearnedRules(text, categories) {
  const normalizedText = normalizePhrase(text);
  const rules = await getActiveLearnedRules();
  const rule = rules.find((item) => {
    if (!categories.includes(item.category)) {
      return false;
    }

    return normalizedText === item.phrase || normalizedText.startsWith(`${item.phrase} `);
  });

  if (!rule) {
    return null;
  }

  return {
    category: rule.category,
    textWithoutCategory: text,
  };
}

async function learnAutoCategoryFromExpense({ category, description }) {
  if (IGNORED_LEARNING_CATEGORIES.has(normalize(category))) {
    return [];
  }

  const phrases = extractLearningPhrases(description);

  await Promise.all(
    phrases.map((phrase) =>
      incrementAutoCategoryStat({
        category,
        phrase,
        type: 'EXPENSE',
      })
    )
  );

  return phrases;
}

module.exports = {
  extractLearningPhrases,
  inferCategory,
  learnAutoCategoryFromExpense,
};
