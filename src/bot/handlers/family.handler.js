const {
  actions,
  familyInfoKeyboard,
  familyStatsManageKeyboard,
  recentExpensesKeyboard,
  replyLabels,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  createFamily,
  getFamilyContext,
  joinFamilyByCode,
  removeFamilyMember,
  renameFamily,
} = require('../../services/family.service');
const {
  getCurrentMonthStatsForUsers,
  getRecentExpensesForUsers,
} = require('../../services/stats.service');
const {
  getDialogState,
  resetDialogState,
  setDialogState,
} = require('../../services/dialogState.service');
const {
  formatAchievementUnlocks,
  unlockFeatureAchievement,
} = require('../../services/gamification.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');

const FAMILY_RECENT_PAGE_SIZE = 10;

function normalizeOffset(value) {
  const offset = Number(value);

  if (!Number.isInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
}

function getDisplayName(user) {
  if (user.firstName) {
    return user.firstName;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return `ID ${user.telegramUserId}`;
}

function formatFamilyInfo(context) {
  if (!context) {
    return [
      'Семейный счет пока не создан.',
      '',
      'Создать: /family_create',
      'Присоединиться: /family_join КОД',
    ].join('\n');
  }

  const memberLines = context.members.map((member) => {
    return `- ${getDisplayName(member.user)} (${member.role === 'OWNER' ? 'владелец' : 'участник'})`;
  });
  const ownerLines =
    context.currentMember.role === 'OWNER'
      ? [
          '',
          'Управление для владельца:',
          'Удалить участника: кнопкой ниже',
        ]
      : [];

  return [
    `Семейный счет: ${context.family.name}`,
    `Инвайт-код: ${context.family.inviteCode}`,
    '',
    'Участники:',
    ...memberLines,
    '',
    'Действия доступны кнопками ниже.',
    ...ownerLines,
  ].join('\n');
}

function formatStats(rows) {
  if (rows.length === 0) {
    return 'В семейном счете за текущий месяц расходов пока нет.';
  }

  const totalsByCurrency = new Map();
  const lines = rows.map((row) => {
    const amount = Number(row._sum.amount || 0);
    const total = totalsByCurrency.get(row.currency) || 0;

    totalsByCurrency.set(row.currency, total + amount);

    return `${row.category}: ${formatMoney(amount, row.currency)}`;
  });

  const totalLines = Array.from(totalsByCurrency.entries()).map(([currency, amount]) => {
    return formatMoney(amount, currency);
  });

  return `Семейные расходы за текущий месяц:\n\n${lines.join(
    '\n'
  )}\n\nИтого:\n${totalLines.join('\n')}`;
}

function formatRecentExpenses(expenses, offset = 0) {
  if (expenses.length === 0) {
    return offset > 0 ? 'Больше семейных трат пока нет.' : 'Последних семейных трат пока нет.';
  }

  const lines = expenses.map((expense) => {
    return `${formatDateTime(expense.expenseDate)} | ${getDisplayName(expense.user)} | ${
      expense.category
    } | ${expense.description} | ${formatMoney(expense.amount, expense.currency)}`;
  });

  return `Последние семейные траты:\n\n${lines.join('\n')}`;
}

async function sendFamilyInfo(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (context) {
    await ctx.reply(formatFamilyInfo(context), familyInfoKeyboard(context, user.id));
    return;
  }

  await ctx.reply(formatFamilyInfo(context));
}

async function startFamilyRename(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  if (context.currentMember.role !== 'OWNER') {
    await ctx.reply('Переименовать семейный счет может только владелец.');
    return;
  }

  await setDialogState(user.id, 'FAMILY_RENAME_WAITING_FOR_NAME');
  await ctx.reply('Отправьте новое название семейного счета.\nОтмена: /cancel');
}

async function saveFamilyRename(ctx, user, name) {
  const result = await renameFamily({ userId: user.id, name });

  if (!result.ok && result.reason === 'EMPTY_NAME') {
    await ctx.reply('Название не должно быть пустым. Отправьте новое название или отмените: /cancel');
    return;
  }

  await resetDialogState(user.id);

  if (!result.ok && result.reason === 'NOT_IN_FAMILY') {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  if (!result.ok && result.reason === 'NOT_OWNER') {
    await ctx.reply('Переименовать семейный счет может только владелец.');
    return;
  }

  await ctx.reply(`Семейный счет переименован: ${result.family.name}`);
}

async function sendFamilyStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  const stats = await getCurrentMonthStatsForUsers(context.memberUserIds);
  await ctx.reply(formatStats(stats), familyStatsManageKeyboard());
}

async function sendFamilyRecent(ctx, offset = 0) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  const requestedOffset = normalizeOffset(offset);
  const expenses = await getRecentExpensesForUsers(
    context.memberUserIds,
    FAMILY_RECENT_PAGE_SIZE + 1,
    requestedOffset
  );
  const hasNextPage = expenses.length > FAMILY_RECENT_PAGE_SIZE;
  const pageExpenses = expenses.slice(0, FAMILY_RECENT_PAGE_SIZE);
  const keyboard = hasNextPage
    ? recentExpensesKeyboard(requestedOffset + FAMILY_RECENT_PAGE_SIZE, { family: true })
    : undefined;

  await ctx.reply(formatRecentExpenses(pageExpenses, requestedOffset), keyboard);
}

function registerFamilyHandlers(bot) {
  bot.command('family', sendFamilyInfo);
  bot.hears(replyLabels.FAMILY_INFO, sendFamilyInfo);

  bot.command('family_create', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const name = ctx.message.text.replace('/family_create', '').trim();
    const result = await createFamily({ user, name });

    if (!result.ok && result.reason === 'ALREADY_IN_FAMILY') {
      await ctx.reply(`Вы уже в семейном счете "${result.family.name}". Инвайт-код: ${result.family.inviteCode}`);
      return;
    }

    const progress = await unlockFeatureAchievement(user.id, 'FIRST_FAMILY_ACCOUNT');

    await ctx.reply(
      [
        `Семейный счет "${result.family.name}" создан.`,
        `Инвайт-код для второго участника: ${result.family.inviteCode}`,
        '',
        `Другой член семьи может отправить боту: /family_join ${result.family.inviteCode}`,
        formatAchievementUnlocks(progress.achievements),
      ].join('\n')
    );
  });

  bot.command('family_join', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const inviteCode = ctx.message.text.replace('/family_join', '').trim();

    if (!inviteCode) {
      await ctx.reply('Отправьте код так: /family_join ABCD1234');
      return;
    }

    const result = await joinFamilyByCode({ user, inviteCode });

    if (!result.ok && result.reason === 'ALREADY_IN_FAMILY') {
      await ctx.reply(`Вы уже в семейном счете "${result.family.name}".`);
      return;
    }

    if (!result.ok && result.reason === 'NOT_FOUND') {
      await ctx.reply('Семейный счет с таким кодом не найден.');
      return;
    }

    const progress = await unlockFeatureAchievement(user.id, 'FIRST_FAMILY_ACCOUNT');

    await ctx.reply(
      `Готово, вы присоединились к семейному счету "${
        result.family.name
      }".${formatAchievementUnlocks(progress.achievements)}`
    );
  });

  bot.command('family_rename', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const name = ctx.message.text.replace('/family_rename', '').trim();

    if (!name) {
      await startFamilyRename(ctx);
      return;
    }

    const result = await renameFamily({ userId: user.id, name });

    if (!result.ok && result.reason === 'EMPTY_NAME') {
      await ctx.reply('Отправьте новое название так: /family_rename Дом');
      return;
    }

    if (!result.ok && result.reason === 'NOT_IN_FAMILY') {
      await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
      return;
    }

    if (!result.ok && result.reason === 'NOT_OWNER') {
      await ctx.reply('Переименовать семейный счет может только владелец.');
      return;
    }

    await ctx.reply(`Семейный счет переименован: ${result.family.name}`);
  });

  bot.command('family_stats', sendFamilyStats);
  bot.command('family_recent', sendFamilyRecent);

  bot.action(actions.FAMILY_INFO, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyInfo(ctx);
  });

  bot.action(actions.FAMILY_STATS, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyStats(ctx);
  });

  bot.action(actions.FAMILY_RECENT, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyRecent(ctx);
  });

  bot.action(actions.FAMILY_RENAME, async (ctx) => {
    await ctx.answerCbQuery();
    await startFamilyRename(ctx);
  });

  bot.action(/^FAMILY_RECENT_NEXT:(\d+)$/u, async (ctx) => {
    await ctx.answerCbQuery();
    await sendFamilyRecent(ctx, ctx.match[1]);
  });

  bot.action(/^FAMILY_REMOVE:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const familyMemberId = ctx.match[1];
    const result = await removeFamilyMember({ userId: user.id, familyMemberId });

    await ctx.answerCbQuery();

    if (!result.ok && result.reason === 'NOT_OWNER') {
      await ctx.reply('Удалять участников может только владелец семейного счета.');
      return;
    }

    if (!result.ok && result.reason === 'NOT_IN_FAMILY') {
      await ctx.reply('Семейный счет не найден.');
      return;
    }

    if (!result.ok && result.reason === 'CANNOT_REMOVE_OWNER') {
      await ctx.reply('Владельца нельзя удалить из семейного счета.');
      return;
    }

    if (!result.ok) {
      await ctx.reply('Не получилось удалить участника: он уже удален или недоступен.');
      return;
    }

    await ctx.reply(`Участник удален: ${getDisplayName(result.member.user)}`);
    await sendFamilyInfo(ctx);
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);

    if (dialogState.state !== 'FAMILY_RENAME_WAITING_FOR_NAME') {
      return next();
    }

    await saveFamilyRename(ctx, user, ctx.message.text.trim());
  });
}

module.exports = { registerFamilyHandlers };
