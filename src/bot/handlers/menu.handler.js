const {
  actions,
  categoryKeyboard,
  incomeCategoryKeyboard,
  mainMenuKeyboard,
  mainMenuReplyKeyboard,
  replyLabels,
} = require('../keyboards');
const { resetDialogState, setDialogState } = require('../../services/dialogState.service');
const { getUserCategoryNames } = require('../../services/category.service');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { isAdminTelegramUser } = require('../../services/admin.service');

async function showMainMenu(ctx, message = 'Выберите действие:') {
  return ctx.reply(message, mainMenuReplyKeyboard());
}

function getHelpText() {
  return [
    'Основные команды:',
    '',
    '/add - добавить расход',
    '/add_income - добавить доход',
    '/stats - статистика за текущий месяц',
    '/balance - баланс и деньги сейчас',
    '/exchange_rate - курсы валют и рынков',
    '/accounts - счета и накопления',
    '/planned - платежи и напоминания',
    '/reminder - ежедневное напоминание',
    '/categories - добавить/удалить категории',
    '/family - семейный счет и участники',
    '/profile - уровень, XP и достижения',
    '/done - отметить день без расходов',
    '/menu - главное меню',
    '/cancel - отменить текущее действие',
    '',
    'Формат расхода:',
    'перекресток 580',
    'продукты перекресток 580',
    'coffee 10 usd',
    '',
    'Подробные действия доступны кнопками внутри разделов.',
  ].join('\n');
}

function getWelcomeTestText() {
  return [
    'Привет! Я помогу вести учет денег без таблиц.',
    '',
    'Что умею:',
    '- быстро добавлять расходы и доходы;',
    '- показывать статистику, баланс и курсы;',
    '- вести личные и семейные категории;',
    '- учитывать счета, накопления и плановые платежи;',
    '- напоминать внести траты;',
    '- поддерживать привычку учета через XP, уровни и серии.',
    '',
    'Начните с кнопки «Добавить расход» или команды /add.',
  ].join('\n');
}

function registerMenuHandlers(bot) {
  bot.start(async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(ctx);
  });

  bot.command('menu', async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(ctx);
  });

  bot.hears(replyLabels.MENU, async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(ctx);
  });

  bot.command('cancel', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);

    await resetDialogState(user.id);
    await showMainMenu(ctx, 'Действие отменено.');
  });

  bot.command('help', async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await ctx.replyTemporary(getHelpText());
  });

  bot.command('welcome_test', async (ctx) => {
    await upsertTelegramUser(ctx.from);

    if (!isAdminTelegramUser(ctx)) {
      await ctx.reply('Команда недоступна.');
      return;
    }

    await ctx.reply(getWelcomeTestText());
  });

  bot.hears(replyLabels.HELP, async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await ctx.replyTemporary(getHelpText());
  });

  async function startAddExpense(ctx) {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'EXPENSE' });
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию расхода:', categoryKeyboard(categories));
  }

  bot.command('add', startAddExpense);
  bot.hears(replyLabels.ADD_EXPENSE, startAddExpense);

  bot.action(actions.ADD_EXPENSE, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'EXPENSE' });

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию расхода:', categoryKeyboard(categories));
  });

  bot.action(actions.CHANGE_EXPENSE_CATEGORY, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'EXPENSE' });

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию расхода:', categoryKeyboard(categories));
  });

  async function startAddIncome(ctx) {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'INCOME' });
    await setDialogState(user.id, 'ADD_INCOME_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию дохода:', incomeCategoryKeyboard(categories));
  }

  bot.command('add_income', startAddIncome);
  bot.hears(replyLabels.ADD_INCOME, startAddIncome);

  bot.action(actions.ADD_INCOME, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'INCOME' });

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_INCOME_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию дохода:', incomeCategoryKeyboard(categories));
  });

  bot.action(actions.CHANGE_INCOME_CATEGORY, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'INCOME' });

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_INCOME_WAITING_FOR_CATEGORY');
    await ctx.replyTemporary('Выберите категорию дохода:', incomeCategoryKeyboard(categories));
  });

  bot.action(/^REPEAT_CATEGORY:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_DETAILS', { category });
    await ctx.replyTemporary(
      `Категория: ${category}\nОтправьте покупку в формате: овощи 500 или coffee 10 usd\nОтмена: /cancel`
    );
  });

  bot.action(/^ADD_INCOME:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_INCOME_WAITING_FOR_DETAILS', { category });
    await ctx.replyTemporary(
      `Категория: ${category}\nОтправьте доход в формате: зарплата 150000, кешбек 250 или project 500 usd\nОтмена: /cancel`
    );
  });

  bot.action('SHOW_MENU', async (ctx) => {
    await ctx.answerCbQuery();
    await showMainMenu(ctx);
  });

  bot.action(actions.CANCEL, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await showMainMenu(ctx, 'Действие отменено.');
  });
}

module.exports = { registerMenuHandlers, showMainMenu };
