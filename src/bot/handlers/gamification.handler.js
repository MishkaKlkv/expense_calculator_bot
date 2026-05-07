const { doneNoExpenseConfirmKeyboard } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  achievementMeta,
  formatAchievement,
  getMoscowDateKey,
  getProfile,
  hasExpensesOnDate,
  isDateKeyTodayOrYesterday,
  markNoExpenseDay,
} = require('../../services/gamification.service');

function parseDoneDate(text) {
  const input = text.replace('/done', '').trim().toLowerCase();

  if (!input || input === 'сегодня') {
    return getMoscowDateKey();
  }

  if (input === 'вчера') {
    const today = getMoscowDateKey();
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);

    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  if (/^\d{4}-\d{2}-\d{2}$/u.test(input)) {
    return input;
  }

  return null;
}

function formatProfile({ achievements, levelInfo, profile }) {
  const nextLine =
    levelInfo.level >= 30
      ? 'Максимальный уровень достигнут.'
      : `До следующего уровня: ${levelInfo.remainingXp} XP`;
  const achievementLines =
    achievements.length === 0
      ? ['Пока нет достижений.']
      : achievements.map((achievement) => formatAchievement(achievement));

  return [
    'Профиль учета',
    '',
    `Уровень: ${levelInfo.level}/30`,
    `XP: ${profile.xp}`,
    nextLine,
    `Текущая серия: ${profile.currentStreak} дн.`,
    `Лучшая серия: ${profile.bestStreak} дн.`,
    `Последний учтенный день: ${profile.lastTrackedDate || 'пока нет'}`,
    '',
    'Достижения:',
    ...achievementLines,
  ].join('\n');
}

function formatStreak({ levelInfo, profile }) {
  return [
    'Серия учета',
    '',
    `Текущая серия: ${profile.currentStreak} дн.`,
    `Лучшая серия: ${profile.bestStreak} дн.`,
    `Уровень: ${levelInfo.level}/30`,
    `XP: ${profile.xp}`,
    '',
    'Чтобы сохранить серию, внесите операцию сегодня или отметьте день без расходов: /done',
  ].join('\n');
}

function buildDoneReply(result, dateKey) {
  if (result.alreadyTracked) {
    return `День ${dateKey} уже учтен. Серия сохранена.`;
  }

  const achievementLines =
    result.achievements.length === 0
      ? []
      : ['', 'Новые достижения:', ...result.achievements.map((achievement) => {
          const meta = achievementMeta[achievement.code];
          return meta ? `${meta.title} - ${meta.description}` : achievement.code;
        })];

  return [
    `Отлично. День ${dateKey} отмечен как день без расходов.`,
    'Это честный учет, и он тоже сохраняет серию.',
    '',
    `+${result.xpAwarded} XP`,
    `Серия: ${result.profile.currentStreak} дн.`,
    ...achievementLines,
  ].join('\n');
}

async function sendDoneConfirmation(ctx, user, dateKey) {
  const hasExpenses = await hasExpensesOnDate({ userId: user.id, dateKey });

  if (hasExpenses) {
    await ctx.reply(
      `За ${dateKey} уже есть расходы, поэтому отметить этот день как день без расходов нельзя.`
    );
    return;
  }

  await ctx.reply(
    [
      `Подтвердите: ${dateKey} действительно был днем без расходов?`,
      '',
      'После подтверждения день будет учтен в серии.',
    ].join('\n'),
    doneNoExpenseConfirmKeyboard(dateKey)
  );
}

async function confirmNoExpenseDay(ctx, dateKey) {
  const user = await upsertTelegramUser(ctx.from);

  if (!isDateKeyTodayOrYesterday(dateKey)) {
    await ctx.reply('Эту отметку уже нельзя подтвердить. Можно отметить только сегодня или вчера.');
    return;
  }

  const hasExpenses = await hasExpensesOnDate({ userId: user.id, dateKey });

  if (hasExpenses) {
    await ctx.reply(
      `За ${dateKey} уже есть расходы, поэтому отметить этот день как день без расходов нельзя.`
    );
    return;
  }

  const result = await markNoExpenseDay({ userId: user.id, dateKey });

  await ctx.reply(buildDoneReply(result, dateKey));
}

function registerGamificationHandlers(bot) {
  bot.command('profile', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfile(user.id);

    await ctx.reply(formatProfile(profile));
  });

  bot.command('streak', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfile(user.id);

    await ctx.reply(formatStreak(profile));
  });

  bot.command('done', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const dateKey = parseDoneDate(ctx.message.text);

    if (!dateKey || !isDateKeyTodayOrYesterday(dateKey)) {
      await ctx.reply('Можно отметить только сегодня или вчера: /done или /done вчера');
      return;
    }

    await sendDoneConfirmation(ctx, user, dateKey);
  });

  bot.action(/^DONE_NO_EXPENSE_CONFIRM:(\d{4}-\d{2}-\d{2})$/u, async (ctx) => {
    await ctx.answerCbQuery();
    await confirmNoExpenseDay(ctx, ctx.match[1]);
  });
}

module.exports = { registerGamificationHandlers };
