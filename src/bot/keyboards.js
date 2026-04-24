const { Markup } = require('telegraf');
const { EXPENSE_CATEGORIES } = require('../constants/categories');

const actions = {
  ADD_EXPENSE: 'ADD_EXPENSE',
  STATS_MONTH: 'STATS_MONTH',
  RECENT_EXPENSES: 'RECENT_EXPENSES',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  EDIT_EXPENSE: 'EDIT_EXPENSE',
  FAMILY_INFO: 'FAMILY_INFO',
  FAMILY_STATS: 'FAMILY_STATS',
  FAMILY_RECENT: 'FAMILY_RECENT',
  REPEAT_CATEGORY: 'REPEAT_CATEGORY',
  CANCEL: 'CANCEL',
};

const replyLabels = {
  ADD_EXPENSE: 'Добавить расход',
  STATS_MONTH: 'Статистика',
  RECENT_EXPENSES: 'Последние',
  DELETE_EXPENSE: 'Удалить',
  EDIT_EXPENSE: 'Редактировать',
  FAMILY_INFO: 'Семья',
  HELP: 'Помощь',
};

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить расход', actions.ADD_EXPENSE)],
    [
      Markup.button.callback('Статистика за месяц', actions.STATS_MONTH),
      Markup.button.callback('Последние траты', actions.RECENT_EXPENSES),
    ],
    [
      Markup.button.callback('Редактировать', actions.EDIT_EXPENSE),
      Markup.button.callback('Удалить трату', actions.DELETE_EXPENSE),
    ],
    [
      Markup.button.callback('Семейный счет', actions.FAMILY_INFO),
      Markup.button.callback('Семейная статистика', actions.FAMILY_STATS),
    ],
  ]);
}

function mainMenuReplyKeyboard() {
  return Markup.keyboard([
    [replyLabels.ADD_EXPENSE, replyLabels.STATS_MONTH],
    [replyLabels.RECENT_EXPENSES, replyLabels.DELETE_EXPENSE],
    [replyLabels.EDIT_EXPENSE, replyLabels.FAMILY_INFO],
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
    [
      Markup.button.callback('Сумма', `EDIT_EXPENSE_FIELD:${expenseId}:amount`),
      Markup.button.callback('Кешбек', `EDIT_EXPENSE_FIELD:${expenseId}:cashback`),
    ],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function afterExpenseKeyboard(category) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.REPEAT_CATEGORY}:${category}`)],
    [Markup.button.callback('Главное меню', 'SHOW_MENU')],
  ]);
}

function categoryKeyboard() {
  const buttons = EXPENSE_CATEGORIES.map((category) =>
    Markup.button.callback(category, `CATEGORY:${category}`)
  );
  const rows = [];

  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

module.exports = {
  actions,
  afterExpenseKeyboard,
  categoryKeyboard,
  deleteExpenseConfirmKeyboard,
  deleteExpenseListKeyboard,
  editExpenseFieldKeyboard,
  editExpenseListKeyboard,
  mainMenuKeyboard,
  mainMenuReplyKeyboard,
  replyLabels,
};
