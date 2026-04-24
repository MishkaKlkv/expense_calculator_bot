const { afterExpenseKeyboard, categoryKeyboard } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const { inferCategory } = require('../../services/autoCategory.service');
const {
  buildPendingExpenseFromMessage,
  createExpenseFromPending,
  parseCashbackForExpense,
} = require('../../services/expense.service');
const {
  getDialogState,
  resetDialogState,
  setDialogState,
} = require('../../services/dialogState.service');
const { transcribeTelegramVoice } = require('../../services/transcription.service');
const { formatMoney } = require('../../utils/money');
const { showMainMenu } = require('./menu.handler');

async function handleExpenseInput(ctx, inputText) {
  const user = await upsertTelegramUser(ctx.from);
  const dialogState = await getDialogState(user.id);

  console.log(`[expense:input] user=${ctx.from.id} state=${dialogState.state} text="${inputText}"`);

  if (dialogState.state === 'ADD_EXPENSE_WAITING_FOR_CATEGORY') {
    await ctx.reply('Сначала выберите категорию кнопкой:', categoryKeyboard());
    return;
  }

  if (
    dialogState.state !== 'ADD_EXPENSE_WAITING_FOR_DETAILS' &&
    dialogState.state !== 'ADD_EXPENSE_WAITING_FOR_CASHBACK'
  ) {
    const inferred = inferCategory(inputText);

    if (!inferred) {
      await showMainMenu(
        ctx,
        'Я не понял сообщение. Можно выбрать категорию или отправить: продукты перекресток 580'
      );
      return;
    }

    const result = buildPendingExpenseFromMessage({
      category: inferred.category,
      messageText: inferred.textWithoutCategory,
    });

    if (!result.ok) {
      await ctx.reply(
        'Не получилось распознать расход. Пример: продукты перекресток 580 или такси 1200'
      );
      return;
    }

    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CASHBACK', {
      pendingExpense: result.pendingExpense,
    });
    await ctx.reply(
      `Категория определена: ${result.pendingExpense.category}\nБыл ли кешбек? Отправьте "нет", сумму или процент, например: 5%`
    );
    return;
  }

  if (dialogState.state === 'ADD_EXPENSE_WAITING_FOR_CASHBACK') {
    const pendingExpense = dialogState.payload?.pendingExpense;

    if (!pendingExpense) {
      await resetDialogState(user.id);
      await showMainMenu(ctx, 'Данные расхода потерялись, начнем заново.');
      return;
    }

    const cashbackResult = parseCashbackForExpense({
      messageText: inputText,
      currency: pendingExpense.currency,
      amount: pendingExpense.amount,
    });

    if (!cashbackResult.ok) {
      if (cashbackResult.reason === 'CURRENCY_MISMATCH') {
        await ctx.reply('Кешбек должен быть в той же валюте, что и расход.');
        return;
      }

      if (cashbackResult.reason === 'CASHBACK_TOO_HIGH') {
        await ctx.reply('Кешбек не может быть больше суммы расхода.');
        return;
      }

      await ctx.reply('Отправьте "нет" или сумму кешбека, например: 250');
      return;
    }

    const result = await createExpenseFromPending({
      user,
      pendingExpense,
      cashback: cashbackResult.cashback,
    });

    await resetDialogState(user.id);
    await ctx.reply(
      `Сохранил: ${result.expense.description}, ${formatMoney(
        result.expense.amount,
        result.expense.currency
      )}, кешбек ${formatMoney(result.expense.cashback, result.expense.currency)}, ${
        result.expense.category
      }`,
      afterExpenseKeyboard(result.expense.category)
    );
    return;
  }

  const category = dialogState.payload?.category;

  if (!category) {
    await resetDialogState(user.id);
    await showMainMenu(ctx, 'Категория потерялась, начнем заново.');
    return;
  }

  const result = buildPendingExpenseFromMessage({
    category,
    messageText: inputText,
  });

  if (!result.ok) {
    await ctx.reply('Не получилось распознать расход. Пример: овощи 500 или coffee 10 usd');
    return;
  }

  await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_CASHBACK', {
    pendingExpense: result.pendingExpense,
  });
  await ctx.reply('Был ли кешбек? Отправьте "нет", сумму или процент, например: 5%');
}

function registerExpenseHandlers(bot) {
  bot.action(/^CATEGORY:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const category = ctx.match[1];

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ADD_EXPENSE_WAITING_FOR_DETAILS', { category });
    await ctx.reply(
      `Категория: ${category}\nОтправьте покупку в формате: овощи 500 или coffee 10 usd`
    );
  });

  bot.on('text', async (ctx, next) => {
    try {
      if (ctx.message.text.startsWith('/')) {
        return next();
      }

      await handleExpenseInput(ctx, ctx.message.text);
    } catch (error) {
      console.error('[expense:text] failed', error);
      await ctx.reply('Что-то пошло не так при обработке расхода. Попробуйте еще раз.');
    }
  });

  bot.on('voice', async (ctx) => {
    try {
      await ctx.reply('Распознаю голосовое...');

      const transcription = await transcribeTelegramVoice(ctx, ctx.message.voice.file_id);

      if (!transcription.ok && transcription.reason === 'OPENAI_API_KEY_MISSING') {
        await ctx.reply('Голосовой ввод пока не настроен: добавьте OPENAI_API_KEY в .env.');
        return;
      }

      if (!transcription.ok && transcription.reason === 'OPENAI_INSUFFICIENT_QUOTA') {
        await ctx.reply(
          'Голосовой ввод не сработал: у OpenAI API-ключа закончилась квота или не настроен API billing. ChatGPT Pro/Codex Cloud лимиты тут не используются.'
        );
        return;
      }

      if (!transcription.ok && transcription.reason === 'OPENAI_RATE_LIMIT') {
        await ctx.reply('OpenAI API временно ограничил запросы. Попробуйте голосом позже или отправьте текстом.');
        return;
      }

      if (!transcription.ok) {
        await ctx.reply('Не получилось распознать голосовое. Попробуйте текстом.');
        return;
      }

      await ctx.reply(`Распознал: ${transcription.text}`);
      await handleExpenseInput(ctx, transcription.text);
    } catch (error) {
      console.error('[expense:voice] failed', error);
      await ctx.reply('Не получилось обработать голосовое. Попробуйте текстом.');
    }
  });
}

module.exports = { registerExpenseHandlers };
