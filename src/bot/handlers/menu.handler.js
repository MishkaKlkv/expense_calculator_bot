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

async function showMainMenu(ctx, message = 'Выберите действие:') {
  await ctx.replyTemporary(message, mainMenuReplyKeyboard());
  return ctx.replyTemporary('Быстрые кнопки:', mainMenuKeyboard());
}

function getWelcomeText() {
  return [
    'Привет! Я помогу вести личный и семейный учет денег без сложных таблиц и ручных расчетов.',
    '',
    'Что я умею:',
    '',
    '• Быстро записывать расходы',
    'Например: продукты перекресток 580 или такси 1200',
    '',
    '• Учитывать доходы',
    'Зарплата, кешбек, подработка и другие поступления',
    '',
    '• Показывать статистику',
    'Расходы, доходы, остаток за месяц, прошлый месяц и недельные отчеты',
    '',
    '• Следить за балансом',
    'Можно разделить деньги на доступные и накопления: карта, вклад, инвестиции, черный день',
    '',
    '• Работать с плановыми платежами',
    'Аренда, интернет, подписки и другие регулярные платежи с напоминаниями',
    '',
    '• Напоминать внести траты',
    'Можно настроить ежедневное напоминание в удобное время',
    '',
    '• Вести семейный учет',
    'Создайте семейный счет и смотрите общие расходы',
    '',
    '• Поддерживать привычку учета',
    'Есть серии дней, уровни, XP и достижения. Если расходов сегодня не было, отметьте день командой /done',
    '',
    'Начать проще всего с кнопки «Добавить расход» или команды /add.',
    'Главное меню всегда доступно через /menu.',
  ].join('\n');
}

function getHelpText() {
  return [
    'Основные команды:',
    '',
    '/add - добавить расход',
    '/add_income - добавить доход',
    '/stats - статистика за текущий месяц',
    '/balance - баланс и деньги сейчас',
    '/accounts - счета и накопления',
    '/planned - плановые платежи',
    '/reminder - напоминания',
    '/categories - категории',
    '/family - семейный счет',
    '/profile - прогресс учета',
    '/done - отметить день без расходов',
    '/menu - главное меню',
    '',
    'Формат расхода:',
    'перекресток 580',
    'продукты перекресток 580',
    'coffee 10 usd',
    '',
    'Подробные действия доступны кнопками внутри разделов.',
  ].join('\n');
}

function registerMenuHandlers(bot) {
  bot.start(async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);

    await showMainMenu(
      ctx,
      user.isNewUser
        ? getWelcomeText()
        : 'Привет! Я помогу учитывать расходы и доходы по категориям. Начните с добавления операции.'
    );
  });

  bot.command('menu', async (ctx) => {
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

  bot.action(/^REPEAT_CATEGORY:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_DETAILS', { category });
    await ctx.replyTemporary(
      `Категория: ${category}\nОтправьте покупку в формате: овощи 500 или coffee 10 usd`
    );
  });

  bot.action(/^ADD_INCOME:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_INCOME_WAITING_FOR_DETAILS', { category });
    await ctx.replyTemporary(
      `Категория: ${category}\nОтправьте доход в формате: зарплата 150000, кешбек 250 или project 500 usd`
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
