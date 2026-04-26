const {
  countTrackedDays,
  createTrackedDay,
  ensureGamification,
  findAchievements,
  findGamification,
  findTrackedDay,
  findTrackedDays,
  unlockAchievement,
  updateGamification,
  updateTrackedDayXp,
} = require('../repositories/gamification.repository');

const XP_BY_SOURCE = {
  TRANSACTION: 10,
  MANUAL_DONE: 8,
};

const BONUS_XP = {
  STREAK_7: 25,
  STREAK_30: 100,
  MONTH_25: 50,
};

const achievementMeta = {
  FIRST_TRANSACTION: { title: 'Первый шаг', description: 'первая сохраненная операция' },
  FIRST_NO_EXPENSE_DAY: { title: 'Честный ноль', description: 'день без расходов отмечен честно' },
  STREAK_7: { title: 'Неделя в фокусе', description: '7 дней учета подряд' },
  STREAK_30: { title: 'Месяц под контролем', description: '30 дней учета подряд' },
  MONTH_25: { title: 'Ритм месяца', description: '25 учтенных дней за месяц' },
  FIRST_ACCOUNT: { title: 'Финансовая карта', description: 'добавлен первый счет' },
  FIRST_PLANNED_PAYMENT: { title: 'Планировщик', description: 'добавлен первый плановый платеж' },
  FIRST_FAMILY_ACCOUNT: { title: 'Семейный учет', description: 'подключен семейный счет' },
  FIRST_CATEGORY: { title: 'Без хаоса', description: 'добавлена первая категория' },
};

function getMoscowDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyToUtcDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function shiftDateKey(dateKey, days) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMonthRangeKeys(dateKey) {
  const [year, month] = dateKey.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = [
    endDate.getUTCFullYear(),
    String(endDate.getUTCMonth() + 1).padStart(2, '0'),
    '01',
  ].join('-');

  return { start, end };
}

function getLevelThreshold(level) {
  if (level <= 1) {
    return 0;
  }

  let total = 0;

  for (let nextLevel = 2; nextLevel <= level; nextLevel += 1) {
    total += Math.round((50 * Math.pow(1.18, nextLevel - 2)) / 10) * 10;
  }

  return total;
}

function getLevelInfo(xp) {
  let level = 1;

  for (let candidate = 2; candidate <= 30; candidate += 1) {
    if (xp >= getLevelThreshold(candidate)) {
      level = candidate;
    }
  }

  const currentThreshold = getLevelThreshold(level);
  const nextThreshold = level >= 30 ? null : getLevelThreshold(level + 1);

  return {
    currentLevelXp: currentThreshold,
    level,
    nextLevelXp: nextThreshold,
    progressXp: xp - currentThreshold,
    remainingXp: nextThreshold === null ? 0 : Math.max(nextThreshold - xp, 0),
    xpForNextLevel: nextThreshold === null ? 0 : nextThreshold - currentThreshold,
  };
}

function formatAchievement(achievement) {
  const meta = achievementMeta[achievement.code] || {
    title: achievement.code,
    description: '',
  };

  return meta.description ? `${meta.title} - ${meta.description}` : meta.title;
}

function buildAchievementLines(achievements) {
  if (achievements.length === 0) {
    return [];
  }

  return [
    '',
    'Новые достижения:',
    ...achievements.map((achievement) => formatAchievement(achievement)),
  ];
}

function formatAchievementUnlocks(achievements) {
  return buildAchievementLines(achievements).join('\n');
}

async function unlockAchievements(userId, codes) {
  const unlocked = [];

  for (const code of codes) {
    const result = await unlockAchievement({ userId, code });

    if (result.created) {
      unlocked.push({ code });
    }
  }

  return unlocked;
}

function calculateStreak(trackedDateKeys, startDateKey) {
  const trackedDates = new Set(trackedDateKeys);
  let dateKey = startDateKey;
  let streak = 0;

  while (trackedDates.has(dateKey)) {
    streak += 1;
    dateKey = shiftDateKey(dateKey, -1);
  }

  return streak;
}

async function recomputeProgress({ userId, dateKey }) {
  const profile = await ensureGamification(userId);
  const trackedDays = await findTrackedDays({ userId });
  const trackedDateKeys = trackedDays.map((day) => day.dateKey);
  const latestDateKey = trackedDateKeys[0] || null;
  const currentStreak = latestDateKey ? calculateStreak(trackedDateKeys, latestDateKey) : 0;
  const bestStreak = Math.max(profile.bestStreak, currentStreak);

  return updateGamification({
    userId,
    data: {
      bestStreak,
      currentStreak,
      lastTrackedDate: latestDateKey,
    },
  });
}

async function recordTrackedDay({ userId, source, dateKey = getMoscowDateKey() }) {
  const existing = await findTrackedDay({ userId, dateKey });

  if (existing) {
    const profile = await ensureGamification(userId);
    return {
      achievements: [],
      alreadyTracked: true,
      day: existing,
      profile,
      xpAwarded: 0,
    };
  }

  const baseXp = XP_BY_SOURCE[source] || 0;
  const day = await createTrackedDay({
    userId,
    dateKey,
    source,
    xpAwarded: baseXp,
  });
  const profileBefore = await recomputeProgress({ userId, dateKey });
  const { start, end } = getMonthRangeKeys(dateKey);
  const monthTrackedDays = await countTrackedDays({ userId, startDateKey: start, endDateKey: end });
  const achievementCodes = [];
  let bonusXp = 0;

  if (source === 'TRANSACTION') {
    achievementCodes.push('FIRST_TRANSACTION');
  }

  if (source === 'MANUAL_DONE') {
    achievementCodes.push('FIRST_NO_EXPENSE_DAY');
  }

  if (profileBefore.currentStreak === 7) {
    achievementCodes.push('STREAK_7');
    bonusXp += BONUS_XP.STREAK_7;
  }

  if (profileBefore.currentStreak === 30) {
    achievementCodes.push('STREAK_30');
    bonusXp += BONUS_XP.STREAK_30;
  }

  if (monthTrackedDays === 25) {
    achievementCodes.push('MONTH_25');
    bonusXp += BONUS_XP.MONTH_25;
  }

  const achievements = await unlockAchievements(userId, achievementCodes);
  const xpAwarded = baseXp + bonusXp;
  await updateTrackedDayXp({ id: day.id, xpAwarded });
  const profile = await updateGamification({
    userId,
    data: {
      xp: {
        increment: xpAwarded,
      },
    },
  });

  return {
    achievements,
    alreadyTracked: false,
    day,
    monthTrackedDays,
    profile,
    xpAwarded,
  };
}

async function markNoExpenseDay({ userId, dateKey }) {
  return recordTrackedDay({ userId, source: 'MANUAL_DONE', dateKey });
}

async function recordTransactionDay(userId) {
  return recordTrackedDay({ userId, source: 'TRANSACTION' });
}

async function unlockFeatureAchievement(userId, code) {
  const achievements = await unlockAchievements(userId, [code]);
  return { achievements };
}

async function getProfile(userId) {
  const [profile, achievements] = await Promise.all([
    ensureGamification(userId),
    findAchievements(userId),
  ]);

  return {
    achievements,
    levelInfo: getLevelInfo(profile.xp),
    profile,
  };
}

async function getTrackedDaysCountForRange({ userId, startDateKey, endDateKey }) {
  return countTrackedDays({ userId, startDateKey, endDateKey });
}

async function getTrackedDaysForRange({ userId, startDateKey, endDateKey }) {
  return findTrackedDays({ userId, startDateKey, endDateKey });
}

function isDateKeyTodayOrYesterday(dateKey) {
  const today = getMoscowDateKey();
  const yesterday = shiftDateKey(today, -1);

  return dateKey === today || dateKey === yesterday;
}

function formatGamificationResult(result) {
  if (!result || result.alreadyTracked) {
    return '';
  }

  const levelInfo = getLevelInfo(result.profile.xp);
  const lines = [
    '',
    `Прогресс учета: +${result.xpAwarded} XP, серия ${result.profile.currentStreak} дн., уровень ${levelInfo.level}/30.`,
    ...buildAchievementLines(result.achievements),
  ];

  return lines.join('\n');
}

module.exports = {
  achievementMeta,
  formatAchievement,
  formatAchievementUnlocks,
  formatGamificationResult,
  getLevelInfo,
  getMoscowDateKey,
  getProfile,
  getTrackedDaysForRange,
  getTrackedDaysCountForRange,
  isDateKeyTodayOrYesterday,
  markNoExpenseDay,
  recordTransactionDay,
  shiftDateKey,
  unlockFeatureAchievement,
};
