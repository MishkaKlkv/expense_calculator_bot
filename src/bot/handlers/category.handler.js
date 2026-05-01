const { actions, categoriesManageKeyboard, categoryTypeKeyboard } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addUserCategory,
  deleteUserCategory,
  getUserCategoryNames,
  normalizeCategoryType,
} = require('../../services/category.service');
const {
  getDialogState,
  resetDialogState,
  setDialogState,
} = require('../../services/dialogState.service');
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

async function startCategoryAdd(ctx) {
  const user = await upsertTelegramUser(ctx.from);

  await setDialogState(user.id, 'CATEGORY_ADD_WAITING_FOR_TYPE');
  await ctx.reply('Для чего добавить категорию?', categoryTypeKeyboard('CATEGORY_ADD_TYPE'));
}

async function startCategoryDelete(ctx) {
  const user = await upsertTelegramUser(ctx.from);

  await setDialogState(user.id, 'CATEGORY_DELETE_WAITING_FOR_TYPE');
  await ctx.reply('Какую категорию удалить?', categoryTypeKeyboard('CATEGORY_DELETE_TYPE'));
}

async function saveCategoryAdd(ctx, user, type, name) {
  const result = await addUserCategory({ userId: user.id, type: type || '', name });

  if (!result.ok) {
    await ctx.reply(`${getCategoryErrorText(result.reason)} Напишите другое название или отмените: /cancel`);
    return;
  }

  const progress = await unlockFeatureAchievement(user.id, 'FIRST_CATEGORY');

  await resetDialogState(user.id);
  await ctx.reply(
    `Категория ${getTypeLabel(result.category.type)} добавлена: ${
      result.category.name
    }${formatAchievementUnlocks(progress.achievements)}`
  );
}

async function saveCategoryDelete(ctx, user, type, name) {
  const result = await deleteUserCategory({ userId: user.id, type: type || '', name });

  if (!result.ok) {
    await ctx.reply(
      result.reason
        ? `${getCategoryErrorText(result.reason)} Напишите другое название или отмените: /cancel`
        : 'Категория не найдена. Напишите название еще раз или отмените: /cancel'
    );
    return;
  }

  await resetDialogState(user.id);
  await ctx.reply('Категория удалена.');
}

async function handleCategoryDialog(ctx, user, dialogState) {
  const text = ctx.message.text.trim();

  if (dialogState.state === 'CATEGORY_ADD_WAITING_FOR_TYPE') {
    await ctx.reply('Выберите тип категории кнопкой или отмените действие: /cancel');
    return true;
  }

  if (dialogState.state === 'CATEGORY_DELETE_WAITING_FOR_TYPE') {
    await ctx.reply('Выберите тип категории кнопкой или отмените действие: /cancel');
    return true;
  }

  if (dialogState.state === 'CATEGORY_ADD_WAITING_FOR_NAME') {
    await saveCategoryAdd(ctx, user, dialogState.payload?.type, text);
    return true;
  }

  if (dialogState.state === 'CATEGORY_DELETE_WAITING_FOR_NAME') {
    await saveCategoryDelete(ctx, user, dialogState.payload?.type, text);
    return true;
  }

  return false;
}

function registerCategoryHandlers(bot) {
  bot.command('categories', sendCategories);

  bot.command('category_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const { type, name } = parseCategoryCommand(ctx.message.text, '/category_add');

    if (!type && !name) {
      await startCategoryAdd(ctx);
      return;
    }

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

    if (!type && !name) {
      await startCategoryDelete(ctx);
      return;
    }

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
    const user = await upsertTelegramUser(ctx.from);

    await setDialogState(user.id, 'CATEGORY_ADD_WAITING_FOR_NAME', { type: 'EXPENSE' });
    await ctx.reply('Как назвать новую категорию расходов? Например: Животные\nОтмена: /cancel');
  });

  bot.action(actions.CATEGORY_ADD_INCOME_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);

    await setDialogState(user.id, 'CATEGORY_ADD_WAITING_FOR_NAME', { type: 'INCOME' });
    await ctx.reply('Как назвать новую категорию доходов? Например: Подработка\nОтмена: /cancel');
  });

  bot.action(actions.CATEGORY_DELETE_EXPENSE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'EXPENSE' });

    await setDialogState(user.id, 'CATEGORY_DELETE_WAITING_FOR_NAME', { type: 'EXPENSE' });
    await ctx.reply(
      `Какую категорию расходов удалить?\n\n${categories.join(', ')}\n\nОтмена: /cancel`
    );
  });

  bot.action(actions.CATEGORY_DELETE_INCOME_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);
    const categories = await getUserCategoryNames({ userId: user.id, type: 'INCOME' });

    await setDialogState(user.id, 'CATEGORY_DELETE_WAITING_FOR_NAME', { type: 'INCOME' });
    await ctx.reply(
      `Какую категорию доходов удалить?\n\n${categories.join(', ')}\n\nОтмена: /cancel`
    );
  });

  bot.action(/^CATEGORY_ADD_TYPE:(EXPENSE|INCOME)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const type = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'CATEGORY_ADD_WAITING_FOR_NAME', { type });
    await ctx.reply(
      `Как назвать новую категорию ${getTypeLabel(type)}? Например: ${
        type === 'INCOME' ? 'Подработка' : 'Животные'
      }\nОтмена: /cancel`
    );
  });

  bot.action(/^CATEGORY_DELETE_TYPE:(EXPENSE|INCOME)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const type = ctx.match[1];
    const categories = await getUserCategoryNames({ userId: user.id, type });

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'CATEGORY_DELETE_WAITING_FOR_NAME', { type });
    await ctx.reply(
      `Какую категорию ${getTypeLabel(type)} удалить?\n\n${categories.join(', ')}\n\nОтмена: /cancel`
    );
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);
    const handled = await handleCategoryDialog(ctx, user, dialogState);

    if (!handled) {
      return next();
    }
  });
}

module.exports = { registerCategoryHandlers };
