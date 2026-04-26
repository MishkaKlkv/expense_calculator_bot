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

function getHelpText() {
  return [
    'Команды бота:',
    '',
    '/menu - показать главное меню с кнопками',
    '/cancel - отменить текущее действие',
    '/add - добавить расход',
    '/balance - баланс за текущий месяц',
    '/income - доходы за текущий месяц',
    '/add_income - добавить доход',
    '/accounts - счета и накопления',
    '/account_add Карта | доступно | 150000 - добавить счет',
    '/account_set ID 175000 - изменить сумму счета',
    '/account_delete ID - удалить счет',
    '/weekly_report - отчет за прошлую неделю',
    '/planned - плановые платежи',
    '/planned_add 5 | Интернет | Домашний интернет | 700 - добавить плановый платеж',
    '/planned_reminder_on ID - включить напоминание о плановом платеже',
    '/planned_reminder_off ID - выключить напоминание о плановом платеже',
    '/planned_delete ID - удалить плановый платеж',
    '/categories - показать категории',
    '/category_add расход НАЗВАНИЕ - добавить категорию расходов',
    '/category_add доход НАЗВАНИЕ - добавить категорию доходов',
    '/category_delete расход НАЗВАНИЕ - удалить категорию расходов',
    '/category_delete доход НАЗВАНИЕ - удалить категорию доходов',
    '/reminder 20:00 - ежедневное напоминание о тратах',
    '/reminder - статус напоминания',
    '/reminder_off - выключить напоминание',
    '/reminder_on - включить напоминание снова',
    '/edit - редактировать свою операцию',
    '/delete - удалить свою операцию',
    '/clear_month_expenses - очистить расходы за текущий месяц',
    '/clear_all_expenses - очистить все расходы',
    '/stats - статистика за текущий месяц',
    '/prev_month - статистика за прошлый месяц',
    '/recent - последние траты',
    '/today - расходы за сегодня',
    '/week - расходы за неделю',
    '/compare - сравнение с прошлым месяцем',
    '/top - топ трат месяца',
    '/chart - график расходов за месяц',
    '/export_csv - экспорт CSV',
    '/export_xlsx - экспорт XLSX',
    '',
    'Семейный счет:',
    '/family - информация о семейном счете',
    '/family_create НАЗВАНИЕ - создать семейный счет',
    '/family_join КОД - присоединиться к семейному счету',
    '/family_rename НАЗВАНИЕ - переименовать семейный счет',
    'Удалить участника может владелец через кнопки в /family',
    '/family_stats - семейная статистика за месяц',
    '/family_recent - последние семейные траты',
    '/family_by_user - кто сколько потратил',
    '',
    'Формат расхода:',
    'перекресток 580',
    'продукты перекресток 580',
    'coffee 10 usd',
    '',
    'Формат дохода:',
    'зарплата 150000',
    'кешбек 250',
    'фриланс проект 500 usd',
  ].join('\n');
}

function registerMenuHandlers(bot) {
  bot.start(async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(
      ctx,
      'Привет! Я помогу учитывать расходы и доходы по категориям. Начните с добавления операции.'
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
