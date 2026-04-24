const {
  actions,
  deleteExpenseConfirmKeyboard,
  deleteExpenseListKeyboard,
  replyLabels,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  deleteExpense,
  getDeletableExpenses,
  getExpenseForDeletion,
} = require('../../services/deleteExpense.service');
const { resetDialogState, setDialogState } = require('../../services/dialogState.service');
const { formatDateTime } = require('../../utils/date');
const { formatMoney } = require('../../utils/money');
const { showMainMenu } = require('./menu.handler');

function formatExpenseLine(expense, index) {
  const cashback = Number(expense.cashback || 0);
  const cashbackText = cashback > 0 ? `, кешбек ${formatMoney(cashback, expense.currency)}` : '';
  const typeText = expense.type === 'INCOME' ? 'доход' : 'расход';

  return `${index + 1}. ${typeText} | ${formatDateTime(expense.expenseDate)} | ${expense.category} | ${
    expense.description
  } | ${formatMoney(expense.amount, expense.currency)}${cashbackText}`;
}

async function showDeleteExpenseList(ctx) {
  const user = await upsertTelegramUser(ctx.from);
  const expenses = await getDeletableExpenses(user.id);

  if (expenses.length === 0) {
    await showMainMenu(ctx, 'Удалять пока нечего: последних операций нет.');
    return;
  }

  const lines = expenses.map(formatExpenseLine);

  await setDialogState(user.id, 'DELETE_TRANSACTION_CONFIRMATION', {
    expenseIds: expenses.map((expense) => expense.id),
  });
  await ctx.reply(
    `Выберите операцию для удаления:\n\n${lines.join('\n')}`,
    deleteExpenseListKeyboard(expenses)
  );
}

function registerDeleteExpenseHandlers(bot) {
  bot.command('delete', showDeleteExpenseList);
  bot.hears(replyLabels.DELETE_EXPENSE, showDeleteExpenseList);

  bot.action(actions.DELETE_EXPENSE, async (ctx) => {
    await ctx.answerCbQuery();
    await showDeleteExpenseList(ctx);
  });

  bot.action(/^DELETE_EXPENSE_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const expenseId = ctx.match[1];
    const expense = await getExpenseForDeletion({ expenseId, userId: user.id });

    await ctx.answerCbQuery();

    if (!expense) {
      await resetDialogState(user.id);
      await showMainMenu(ctx, 'Не нашел эту операцию или у вас нет прав ее удалить.');
      return;
    }

    const typeText = expense.type === 'INCOME' ? 'доход' : 'расход';

    await setDialogState(user.id, 'DELETE_TRANSACTION_CONFIRMATION', { expenseId });
    await ctx.reply(
      [
        'Удалить эту операцию?',
        '',
        `${typeText} | ${formatDateTime(expense.expenseDate)} | ${expense.category}`,
        `${expense.description} | ${formatMoney(expense.amount, expense.currency)}`,
      ].join('\n'),
      deleteExpenseConfirmKeyboard(expense.id)
    );
  });

  bot.action(/^DELETE_EXPENSE_CONFIRM:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const expenseId = ctx.match[1];
    const result = await deleteExpense({ expenseId, userId: user.id });

    await ctx.answerCbQuery();
    await resetDialogState(user.id);

    if (!result.ok) {
      await showMainMenu(ctx, 'Не получилось удалить операцию: она уже удалена или недоступна.');
      return;
    }

    await showMainMenu(ctx, 'Операция удалена.');
  });
}

module.exports = { registerDeleteExpenseHandlers };
