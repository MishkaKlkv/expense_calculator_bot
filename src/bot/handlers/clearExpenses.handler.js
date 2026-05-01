const { actions, clearExpensesConfirmKeyboard } = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  clearAllExpenses,
  clearCurrentMonthExpenses,
} = require('../../services/clearExpenses.service');
const { resetDialogState } = require('../../services/dialogState.service');
const { showMainMenu } = require('./menu.handler');

function getClearPrompt(scope) {
  if (scope === 'all') {
    return [
      'Вы уверены, что хотите удалить все свои расходы?',
      '',
      'Доходы не будут удалены.',
    ].join('\n');
  }

  return [
    'Вы уверены, что хотите удалить свои расходы за текущий месяц?',
    '',
    'Доходы не будут удалены.',
  ].join('\n');
}

async function askClearConfirmation(ctx, scope) {
  const user = await upsertTelegramUser(ctx.from);

  await resetDialogState(user.id);
  await ctx.reply(getClearPrompt(scope), clearExpensesConfirmKeyboard(scope));
}

function registerClearExpensesHandlers(bot) {
  bot.command('clear_month_expenses', (ctx) => askClearConfirmation(ctx, 'month'));
  bot.command('clear_all_expenses', (ctx) => askClearConfirmation(ctx, 'all'));

  bot.action(actions.CLEAR_MONTH_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await askClearConfirmation(ctx, 'month');
  });

  bot.action(actions.CLEAR_ALL_EXPENSES, async (ctx) => {
    await ctx.answerCbQuery();
    await askClearConfirmation(ctx, 'all');
  });

  bot.action(/^CLEAR_EXPENSES_CONFIRM:(month|all)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const scope = ctx.match[1];
    const result =
      scope === 'all'
        ? await clearAllExpenses(user.id)
        : await clearCurrentMonthExpenses(user.id);

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await showMainMenu(ctx, `Готово. Удалено расходов: ${result.count}.`);
  });
}

module.exports = { registerClearExpensesHandlers };
