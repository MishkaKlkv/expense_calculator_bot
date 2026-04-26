const { actions, categoriesManageKeyboard } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addUserCategory,
  deleteUserCategory,
  getUserCategoryNames,
  normalizeCategoryType,
} = require('../../services/category.service');
const {
  formatAchievementUnlocks,
  unlockFeatureAchievement,
} = require('../../services/gamification.service');

function getTypeLabel(type) {
  return type === 'INCOME' ? 'доходов' : 'расходов';
}

function parseCategoryCommand(text, command) {
  const input = text.replace(command, '').trim();
  const [typeText, ...nameParts] = input.split(/\s+/u);
  const type = typeText ? normalizeCategoryType(typeText) : null;
  const name = nameParts.join(' ').trim();

  return { type, name };
}

async function sendCategories(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const [expenses, incomes] = await Promise.all([
    getUserCategoryNames({ userId: user.id, type: 'EXPENSE' }),
    getUserCategoryNames({ userId: user.id, type: 'INCOME' }),
  ]);

  await ctx.reply(
    [
      'Категории расходов:',
      expenses.join(', '),
      '',
      'Категории доходов:',
      incomes.join(', '),
    ].join('\n'),
    categoriesManageKeyboard()
  );
}

function getCategoryErrorText(reason) {
  const errors = {
    ALREADY_EXISTS: 'Такая категория уже есть.',
    EMPTY_NAME: 'Название категории не должно быть пустым.',
    UNKNOWN_TYPE: 'Укажите тип: расход или доход.',
    LAST_CATEGORY: 'Нельзя удалить последнюю категорию этого типа.',
  };

  return errors[reason] || 'Не получилось изменить категории.';
}

function registerCategoryHandlers(bot) {
  bot.command('categories', sendCategories);

  bot.command('category_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const { type, name } = parseCategoryCommand(ctx.message.text, '/category_add');
    const result = await addUserCategory({ userId: user.id, type: type || '', name });

    if (!result.ok) {
      await ctx.reply(`${getCategoryErrorText(result.reason)} Пример: /category_add расход Хобби`);
      return;
    }

    const progress = await unlockFeatureAchievement(user.id, 'FIRST_CATEGORY');

    await ctx.reply(
      `Категория ${getTypeLabel(result.category.type)} добавлена: ${
        result.category.name
      }${formatAchievementUnlocks(progress.achievements)}`
    );
  });

  bot.command('category_delete', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const { type, name } = parseCategoryCommand(ctx.message.text, '/category_delete');
    const result = await deleteUserCategory({ userId: user.id, type: type || '', name });

    if (!result.ok) {
      await ctx.reply(
        result.reason
          ? `${getCategoryErrorText(result.reason)} Пример: /category_delete расход Хобби`
          : 'Категория не найдена.'
      );
      return;
    }

    await ctx.reply('Категория удалена.');
  });

  bot.action(actions.CATEGORY_ADD_EXPENSE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyTemporary('Добавить категорию расходов: /category_add расход Животные');
  });

  bot.action(actions.CATEGORY_ADD_INCOME_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyTemporary('Добавить категорию доходов: /category_add доход Подработка');
  });

  bot.action(actions.CATEGORY_DELETE_EXPENSE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyTemporary('Удалить категорию расходов: /category_delete расход Животные');
  });

  bot.action(actions.CATEGORY_DELETE_INCOME_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyTemporary('Удалить категорию доходов: /category_delete доход Подработка');
  });
}

module.exports = { registerCategoryHandlers };
