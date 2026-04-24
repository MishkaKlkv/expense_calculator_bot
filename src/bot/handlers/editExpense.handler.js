const {
  actions,
  editExpenseFieldKeyboard,
  editExpenseListKeyboard,
  replyLabels,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  getEditableExpenses,
  getExpenseForEdit,
  updateExpenseField,
} = require('../../services/editExpense.service');
const {
  getDialogState,
  resetDialogState,
  setDialogState,
} = require('../../services/dialogState.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');
const { showMainMenu } = require('./menu.handler');

function formatExpenseLine(expense, index) {
  const typeText = expense.type === 'INCOME' ? 'доход' : 'расход';

  return `${index + 1}. ${typeText} | ${formatDateTime(expense.expenseDate)} | ${expense.category} | ${
    expense.description
  } | ${formatMoney(expense.amount, expense.currency)}`;
}

async function showEditExpenseList(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const expenses = await getEditableExpenses(user.id);

  if (expenses.length === 0) {
    await showMainMenu(ctx, 'Редактировать пока нечего: последних операций нет.');
    return;
  }

  await ctx.reply(
    `Выберите операцию для редактирования:\n\n${expenses.map(formatExpenseLine).join('\n')}`,
    editExpenseListKeyboard(expenses)
  );
}

function getFieldPrompt(field, type = 'EXPENSE') {
  const categoryExample = type === 'INCOME' ? 'Зарплата' : 'Дети';
  const prompts = {
    category: `Отправьте новую категорию текстом, например: ${categoryExample}`,
    description: 'Отправьте новое описание.',
    amount: 'Отправьте новую сумму, например: 580 или 10 usd',
  };

  return prompts[field] || 'Отправьте новое значение.';
}

function getEditErrorText(reason) {
  const errors = {
    UNKNOWN_CATEGORY: 'Не знаю такую категорию. Отправьте название одной из категорий.',
    EMPTY_DESCRIPTION: 'Описание не должно быть пустым.',
    INVALID_AMOUNT: 'Не понял сумму. Пример: 580 или 10 usd',
    PARSE_ERROR: 'Не понял значение. Попробуйте еще раз.',
    NOT_FOUND: 'Не нашел эту операцию или у вас нет прав ее редактировать.',
  };

  return errors[reason] || 'Не получилось обновить операцию.';
}

function registerEditExpenseHandlers(bot) {
  bot.command('edit', showEditExpenseList);
  bot.hears(replyLabels.EDIT_EXPENSE, showEditExpenseList);

  bot.action(actions.EDIT_EXPENSE, async (ctx) => {
    await ctx.answerCbQuery();
    await showEditExpenseList(ctx);
  });

  bot.action(/^EDIT_EXPENSE_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const expenseId = ctx.match[1];
    const expense = await getExpenseForEdit({ expenseId, userId: user.id });

    await ctx.answerCbQuery();

    if (!expense) {
      await showMainMenu(ctx, 'Не нашел эту операцию или у вас нет прав ее редактировать.');
      return;
    }

    const typeText = expense.type === 'INCOME' ? 'доход' : 'расход';

    await ctx.reply(
      [
        'Что изменить?',
        '',
        `${typeText} | ${formatDateTime(expense.expenseDate)} | ${expense.category}`,
        `${expense.description} | ${formatMoney(expense.amount, expense.currency)}`,
      ].join('\n'),
      editExpenseFieldKeyboard(expense.id)
    );
  });

  bot.action(/^EDIT_EXPENSE_FIELD:(.+):(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const expenseId = ctx.match[1];
    const field = ctx.match[2];

    await ctx.answerCbQuery();
    const expense = await getExpenseForEdit({ expenseId, userId: user.id });

    if (!expense) {
      await showMainMenu(ctx, 'Не нашел эту операцию или у вас нет прав ее редактировать.');
      return;
    }

    await setDialogState(user.id, 'EDIT_TRANSACTION_WAITING_FOR_FIELD', {
      expenseId,
      field,
    });
    await ctx.reply(getFieldPrompt(field, expense.type));
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);

    if (dialogState.state !== 'EDIT_TRANSACTION_WAITING_FOR_FIELD') {
      return next();
    }

    const { expenseId, field } = dialogState.payload || {};

    if (!expenseId || !field) {
      await resetDialogState(user.id);
      await showMainMenu(ctx, 'Данные редактирования потерялись, начнем заново.');
      return;
    }

    const result = await updateExpenseField({
      expenseId,
      userId: user.id,
      field,
      value: ctx.message.text,
    });

    if (!result.ok) {
      await ctx.reply(getEditErrorText(result.reason));
      return;
    }

    await resetDialogState(user.id);
    await showMainMenu(ctx, 'Операция обновлена.');
  });
}

module.exports = { registerEditExpenseHandlers };
