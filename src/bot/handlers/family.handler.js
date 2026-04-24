const { actions, replyLabels } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  createFamily,
  getFamilyContext,
  joinFamilyByCode,
} = require('../../services/family.service');
const {
  getCurrentMonthStatsForUsers,
  getRecentExpensesForUsers,
} = require('../../services/stats.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');

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

  return [
    `Семейный счет: ${context.family.name}`,
    `Инвайт-код: ${context.family.inviteCode}`,
    '',
    'Участники:',
    ...memberLines,
    '',
    'Семейная статистика: /family_stats',
    'Последние семейные траты: /family_recent',
  ].join('\n');
}

function formatStats(rows) {
  if (rows.length === 0) {
    return 'В семейном счете за текущий месяц расходов пока нет.';
  }

  const totalsByCurrency = new Map();
  const lines = rows.map((row) => {
    const amount = Number(row._sum.amount || 0);
    const cashback = Number(row._sum.cashback || 0);
    const netAmount = amount - cashback;
    const total = totalsByCurrency.get(row.currency) || {
      amount: 0,
      cashback: 0,
      netAmount: 0,
    };

    total.amount += amount;
    total.cashback += cashback;
    total.netAmount += netAmount;
    totalsByCurrency.set(row.currency, total);

    return `${row.category}: ${formatMoney(netAmount, row.currency)} (расходы ${formatMoney(
      amount,
      row.currency
    )}, кешбек ${formatMoney(cashback, row.currency)})`;
  });

  const totalLines = Array.from(totalsByCurrency.entries()).map(([currency, total]) => {
    return `${formatMoney(total.netAmount, currency)} = ${formatMoney(
      total.amount,
      currency
    )} - кешбек ${formatMoney(total.cashback, currency)}`;
  });

  return `Семейные расходы за текущий месяц:\n\n${lines.join(
    '\n'
  )}\n\nИтого:\n${totalLines.join('\n')}`;
}

function formatRecentExpenses(expenses) {
  if (expenses.length === 0) {
    return 'Последних семейных трат пока нет.';
  }

  const lines = expenses.map((expense) => {
    const cashback = Number(expense.cashback || 0);
    const cashbackText = cashback > 0 ? ` | кешбек ${formatMoney(cashback, expense.currency)}` : '';

    return `${formatDateTime(expense.expenseDate)} | ${getDisplayName(expense.user)} | ${
      expense.category
    } | ${expense.description} | ${formatMoney(expense.amount, expense.currency)}${cashbackText}`;
  });

  return `Последние семейные траты:\n\n${lines.join('\n')}`;
}

async function sendFamilyInfo(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  await ctx.reply(formatFamilyInfo(context));
}

async function sendFamilyStats(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  const stats = await getCurrentMonthStatsForUsers(context.memberUserIds);
  await ctx.reply(formatStats(stats));
}

async function sendFamilyRecent(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const context = await getFamilyContext(user.id);

  if (!context) {
    await ctx.reply('Сначала создайте семейный счет через /family_create или присоединитесь через /family_join КОД.');
    return;
  }

  const expenses = await getRecentExpensesForUsers(context.memberUserIds);
  await ctx.reply(formatRecentExpenses(expenses));
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

    await ctx.reply(
      [
        `Семейный счет "${result.family.name}" создан.`,
        `Инвайт-код для второго участника: ${result.family.inviteCode}`,
        '',
        `Жена может отправить боту: /family_join ${result.family.inviteCode}`,
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

    await ctx.reply(`Готово, вы присоединились к семейному счету "${result.family.name}".`);
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
}

module.exports = { registerFamilyHandlers };
