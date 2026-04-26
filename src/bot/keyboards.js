const { Markup } = require('telegraf');

const actions = {
  ADD_EXPENSE: 'ADD_EXPENSE',
  ADD_INCOME: 'ADD_INCOME',
  STATS_MONTH: 'STATS_MONTH',
  STATS_PREVIOUS_MONTH: 'STATS_PREVIOUS_MONTH',
  RECENT_EXPENSES: 'RECENT_EXPENSES',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  EDIT_EXPENSE: 'EDIT_EXPENSE',
  FAMILY_INFO: 'FAMILY_INFO',
  FAMILY_STATS: 'FAMILY_STATS',
  FAMILY_RECENT: 'FAMILY_RECENT',
  CLEAR_MONTH_EXPENSES: 'CLEAR_MONTH_EXPENSES',
  CLEAR_ALL_EXPENSES: 'CLEAR_ALL_EXPENSES',
  CHANGE_EXPENSE_CATEGORY: 'CHANGE_EXPENSE_CATEGORY',
  REPEAT_CATEGORY: 'REPEAT_CATEGORY',
  CANCEL: 'CANCEL',
};

const replyLabels = {
  ADD_EXPENSE: 'Добавить расход',
  ADD_INCOME: 'Добавить доход',
  STATS_MONTH: 'Статистика',
  RECENT_EXPENSES: 'Последние',
  DELETE_EXPENSE: 'Удалить',
  EDIT_EXPENSE: 'Редактировать',
  FAMILY_INFO: 'Семья',
  HELP: 'Помощь',
};

function getUserButtonName(user) {
  return user.firstName || user.username || String(user.telegramUserId);
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Добавить расход', actions.ADD_EXPENSE),
      Markup.button.callback('Добавить доход', actions.ADD_INCOME),
    ],
    [
      Markup.button.callback('Статистика за месяц', actions.STATS_MONTH),
      Markup.button.callback('Прошлый месяц', actions.STATS_PREVIOUS_MONTH),
    ],
    [
      Markup.button.callback('Последние траты', actions.RECENT_EXPENSES),
    ],
    [
      Markup.button.callback('Редактировать', actions.EDIT_EXPENSE),
      Markup.button.callback('Удалить операцию', actions.DELETE_EXPENSE),
    ],
    [
      Markup.button.callback('Семейный счет', actions.FAMILY_INFO),
      Markup.button.callback('Семейная статистика', actions.FAMILY_STATS),
    ],
    [
      Markup.button.callback('Очистить расходы месяца', actions.CLEAR_MONTH_EXPENSES),
      Markup.button.callback('Очистить все расходы', actions.CLEAR_ALL_EXPENSES),
    ],
  ]);
}

function mainMenuReplyKeyboard() {
  return Markup.keyboard([
    [replyLabels.ADD_EXPENSE, replyLabels.ADD_INCOME],
    [replyLabels.STATS_MONTH, replyLabels.RECENT_EXPENSES],
    [replyLabels.EDIT_EXPENSE, replyLabels.DELETE_EXPENSE],
    [replyLabels.FAMILY_INFO],
    [replyLabels.HELP],
  ]).resize();
}

function deleteExpenseListKeyboard(expenses) {
  const rows = expenses.map((expense, index) => {
    return [
      Markup.button.callback(
        `${index + 1}. ${expense.category} - ${expense.description}`,
        `DELETE_EXPENSE_SELECT:${expense.id}`
      ),
    ];
  });

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function deleteExpenseConfirmKeyboard(expenseId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Удалить', `DELETE_EXPENSE_CONFIRM:${expenseId}`),
      Markup.button.callback('Отмена', actions.CANCEL),
    ],
  ]);
}

function clearExpensesConfirmKeyboard(scope) {
  const confirmAction =
    scope === 'all' ? 'CLEAR_EXPENSES_CONFIRM:all' : 'CLEAR_EXPENSES_CONFIRM:month';
  const label = scope === 'all' ? 'Очистить все расходы' : 'Очистить расходы месяца';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(label, confirmAction),
      Markup.button.callback('Отмена', actions.CANCEL),
    ],
  ]);
}

function editExpenseListKeyboard(expenses) {
  const rows = expenses.map((expense, index) => {
    return [
      Markup.button.callback(
        `${index + 1}. ${expense.category} - ${expense.description}`,
        `EDIT_EXPENSE_SELECT:${expense.id}`
      ),
    ];
  });

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function editExpenseFieldKeyboard(expenseId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Категория', `EDIT_EXPENSE_FIELD:${expenseId}:category`),
      Markup.button.callback('Описание', `EDIT_EXPENSE_FIELD:${expenseId}:description`),
    ],
    [Markup.button.callback('Сумма', `EDIT_EXPENSE_FIELD:${expenseId}:amount`)],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function afterExpenseKeyboard(category) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.REPEAT_CATEGORY}:${category}`)],
    [Markup.button.callback('Другая категория', actions.CHANGE_EXPENSE_CATEGORY)],
    [Markup.button.callback('Главное меню', 'SHOW_MENU')],
  ]);
}

function afterIncomeKeyboard(category) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.ADD_INCOME}:${category}`)],
    [Markup.button.callback('Главное меню', 'SHOW_MENU')],
  ]);
}

function categoryKeyboard(categories) {
  const buttons = categories.map((category) =>
    Markup.button.callback(category, `CATEGORY:${category}`)
  );
  const rows = [];

  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function incomeCategoryKeyboard(categories) {
  const buttons = categories.map((category) =>
    Markup.button.callback(category, `INCOME_CATEGORY:${category}`)
  );
  const rows = [];

  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function familyOwnerKeyboard(members, ownerUserId) {
  const rows = members
    .filter((member) => member.userId !== ownerUserId && member.role !== 'OWNER')
    .map((member) => {
      return [
        Markup.button.callback(
          `Удалить ${getUserButtonName(member.user)}`,
          `FAMILY_REMOVE:${member.id}`
        ),
      ];
    });

  rows.push([Markup.button.callback('Главное меню', 'SHOW_MENU')]);

  return Markup.inlineKeyboard(rows);
}

module.exports = {
  actions,
  afterExpenseKeyboard,
  afterIncomeKeyboard,
  categoryKeyboard,
  clearExpensesConfirmKeyboard,
  deleteExpenseConfirmKeyboard,
  deleteExpenseListKeyboard,
  editExpenseFieldKeyboard,
  editExpenseListKeyboard,
  familyOwnerKeyboard,
  incomeCategoryKeyboard,
  mainMenuKeyboard,
  mainMenuReplyKeyboard,
  replyLabels,
};
