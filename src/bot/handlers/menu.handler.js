const {
  actions,
  categoryKeyboard,
  mainMenuKeyboard,
  mainMenuReplyKeyboard,
  replyLabels,
} = require('../keyboards');
const { resetDialogState, setDialogState } = require('../../services/dialogState.service');
const { upsertTelegramUser } = require('../../repositories/user.repository');

async function showMainMenu(ctx, message = 'Выберите действие:') {
  await ctx.reply(message, mainMenuReplyKeyboard());
  return ctx.reply('Быстрые кнопки:', mainMenuKeyboard());
}

function getHelpText() {
  return [
    'Команды бота:',
    '',
    '/menu - показать главное меню с кнопками',
    '/add - добавить расход',
    '/edit - редактировать свою трату',
    '/delete - удалить свою трату',
    '/stats - статистика за текущий месяц',
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
    '/family_stats - семейная статистика за месяц',
    '/family_recent - последние семейные траты',
    '/family_by_user - кто сколько потратил',
    '',
    'Формат расхода:',
    'перекресток 580',
    'продукты перекресток 580',
    'coffee 10 usd',
    'Можно отправить голосовое после выбора категории.',
    '',
    'После расхода бот спросит кешбек: ответьте "нет", суммой, процентом 5% или голосом.',
  ].join('\n');
}

function registerMenuHandlers(bot) {
  bot.start(async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(
      ctx,
      'Привет! Я помогу учитывать расходы по категориям. Начните с добавления расхода.'
    );
  });

  bot.command('menu', async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await showMainMenu(ctx);
  });

  bot.command('help', async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await ctx.reply(getHelpText());
  });

  bot.hears(replyLabels.HELP, async (ctx) => {
    await upsertTelegramUser(ctx.from);
    await ctx.reply(getHelpText());
  });

  async function startAddExpense(ctx) {
    const user = await upsertTelegramUser(ctx.from);
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CATEGORY');
    await ctx.reply('Выберите категорию расхода:', categoryKeyboard());
  }

  bot.command('add', startAddExpense);
  bot.hears(replyLabels.ADD_EXPENSE, startAddExpense);

  bot.action(actions.ADD_EXPENSE, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CATEGORY');
    await ctx.reply('Выберите категорию расхода:', categoryKeyboard());
  });

  bot.action(/^REPEAT_CATEGORY:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_DETAILS', { category });
    await ctx.reply(
      `Категория: ${category}\nОтправьте покупку в формате: овощи 500 или coffee 10 usd`
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
