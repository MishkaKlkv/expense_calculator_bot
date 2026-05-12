const { Markup } = require('telegraf');

const actions = {
  ADD_EXPENSE: 'ADD_EXPENSE',
  ADD_INCOME: 'ADD_INCOME',
  STATS_MONTH: 'STATS_MONTH',
  STATS_PREVIOUS_MONTH: 'STATS_PREVIOUS_MONTH',
  STATS_TODAY: 'STATS_TODAY',
  STATS_WEEK: 'STATS_WEEK',
  STATS_COMPARE: 'STATS_COMPARE',
  STATS_TOP: 'STATS_TOP',
  STATS_CHART: 'STATS_CHART',
  STATS_CATEGORY_EXPENSES: 'STATS_CATEGORY_EXPENSES',
  STATS_CATEGORY_EXPENSES_NEXT: 'STATS_CATEGORY_EXPENSES_NEXT',
  STATS_EXPORT_CSV: 'STATS_EXPORT_CSV',
  STATS_EXPORT_XLSX: 'STATS_EXPORT_XLSX',
  STATS_FAMILY_MONTH: 'STATS_FAMILY_MONTH',
  STATS_FAMILY_TODAY: 'STATS_FAMILY_TODAY',
  STATS_FAMILY_WEEK: 'STATS_FAMILY_WEEK',
  STATS_FAMILY_PREVIOUS_MONTH: 'STATS_FAMILY_PREVIOUS_MONTH',
  STATS_FAMILY_COMPARE: 'STATS_FAMILY_COMPARE',
  STATS_FAMILY_TOP: 'STATS_FAMILY_TOP',
  STATS_FAMILY_CHART: 'STATS_FAMILY_CHART',
  STATS_FAMILY_CATEGORY_EXPENSES: 'STATS_FAMILY_CATEGORY_EXPENSES',
  STATS_FAMILY_CATEGORY_EXPENSES_NEXT: 'STATS_FAMILY_CATEGORY_EXPENSES_NEXT',
  STATS_FAMILY_EXPORT_CSV: 'STATS_FAMILY_EXPORT_CSV',
  STATS_FAMILY_EXPORT_XLSX: 'STATS_FAMILY_EXPORT_XLSX',
  RECENT_EXPENSES: 'RECENT_EXPENSES',
  RECENT_EXPENSES_NEXT: 'RECENT_EXPENSES_NEXT',
  EDIT_EXPENSE_NEXT: 'EDIT_EXPENSE_NEXT',
  DELETE_EXPENSE_NEXT: 'DELETE_EXPENSE_NEXT',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
  EDIT_EXPENSE: 'EDIT_EXPENSE',
  FAMILY_INFO: 'FAMILY_INFO',
  FAMILY_STATS: 'FAMILY_STATS',
  FAMILY_RECENT: 'FAMILY_RECENT',
  FAMILY_RECENT_NEXT: 'FAMILY_RECENT_NEXT',
  CLEAR_MONTH_EXPENSES: 'CLEAR_MONTH_EXPENSES',
  CLEAR_ALL_EXPENSES: 'CLEAR_ALL_EXPENSES',
  CHANGE_EXPENSE_CATEGORY: 'CHANGE_EXPENSE_CATEGORY',
  CHANGE_INCOME_CATEGORY: 'CHANGE_INCOME_CATEGORY',
  ACCOUNT_ADD_HELP: 'ACCOUNT_ADD_HELP',
  ACCOUNT_SET_HELP: 'ACCOUNT_SET_HELP',
  ACCOUNT_DELETE_HELP: 'ACCOUNT_DELETE_HELP',
  CATEGORY_ADD_EXPENSE_HELP: 'CATEGORY_ADD_EXPENSE_HELP',
  CATEGORY_ADD_INCOME_HELP: 'CATEGORY_ADD_INCOME_HELP',
  CATEGORY_DELETE_EXPENSE_HELP: 'CATEGORY_DELETE_EXPENSE_HELP',
  CATEGORY_DELETE_INCOME_HELP: 'CATEGORY_DELETE_INCOME_HELP',
  PLANNED_ADD_HELP: 'PLANNED_ADD_HELP',
  PLANNED_DELETE_HELP: 'PLANNED_DELETE_HELP',
  PLANNED_REMINDER_ON_HELP: 'PLANNED_REMINDER_ON_HELP',
  PLANNED_REMINDER_OFF_HELP: 'PLANNED_REMINDER_OFF_HELP',
  REMINDER_CHANGE_HELP: 'REMINDER_CHANGE_HELP',
  REMINDER_OFF: 'REMINDER_OFF',
  REMINDER_ON: 'REMINDER_ON',
  REMINDER_TEST: 'REMINDER_TEST',
  REMINDER_CHECK: 'REMINDER_CHECK',
  REMINDER_RUN: 'REMINDER_RUN',
  REPEAT_CATEGORY: 'REPEAT_CATEGORY',
  DONE_NO_EXPENSE_CONFIRM: 'DONE_NO_EXPENSE_CONFIRM',
  DELETE_ACCOUNT_CONFIRM: 'DELETE_ACCOUNT_CONFIRM',
  CANCEL: 'CANCEL',
};

const replyLabels = {
  MENU: 'Меню',
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

function truncateButtonText(value, maxLength = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
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

function deleteExpenseListKeyboard(expenses, options = {}) {
  const { nextOffset = null, startIndex = 0 } = options;
  const rows = expenses.map((expense, index) => {
    return [
      Markup.button.callback(
        `${startIndex + index + 1}. ${expense.category} - ${expense.description}`,
        `DELETE_EXPENSE_SELECT:${expense.id}`
      ),
    ];
  });

  if (nextOffset !== null) {
    rows.push([Markup.button.callback('Следующие 10', `${actions.DELETE_EXPENSE_NEXT}:${nextOffset}`)]);
  }
  rows.push([
    Markup.button.callback('Очистить расходы месяца', actions.CLEAR_MONTH_EXPENSES),
  ]);
  rows.push([Markup.button.callback('Очистить все расходы', actions.CLEAR_ALL_EXPENSES)]);
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

function doneNoExpenseConfirmKeyboard(dateKey) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        'Да, день без расходов',
        `${actions.DONE_NO_EXPENSE_CONFIRM}:${dateKey}`
      ),
    ],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function deleteAccountConfirmKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Удалить аккаунт', actions.DELETE_ACCOUNT_CONFIRM)],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function deleteAccountNumberKeyboard(target, options) {
  return Markup.inlineKeyboard(
    options.map((option) => [
      Markup.button.callback(String(option), `DELETE_ACCOUNT_NUMBER:${target}:${option}`),
    ])
  );
}

function editExpenseListKeyboard(expenses, options = {}) {
  const { nextOffset = null, startIndex = 0 } = options;
  const rows = expenses.map((expense, index) => {
    return [
      Markup.button.callback(
        `${startIndex + index + 1}. ${expense.category} - ${expense.description}`,
        `EDIT_EXPENSE_SELECT:${expense.id}`
      ),
    ];
  });

  if (nextOffset !== null) {
    rows.push([Markup.button.callback('Следующие 10', `${actions.EDIT_EXPENSE_NEXT}:${nextOffset}`)]);
  }
  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function searchResultsKeyboard(expenses) {
  const rows = expenses.map((expense, index) => {
    const label = truncateButtonText(`${index + 1}. ${expense.category} - ${expense.description}`);

    return [Markup.button.callback(label, `EDIT_EXPENSE_SELECT:${expense.id}`)];
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
    [Markup.button.callback('Удалить', `DELETE_EXPENSE_SELECT:${expenseId}`)],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function quickEditRows(transactionId) {
  if (!transactionId) {
    return [];
  }

  return [
    [
      Markup.button.callback('Изм. сумму', `QUICK_EDIT_FIELD:${transactionId}:amount`),
      Markup.button.callback('Изм. описание', `QUICK_EDIT_FIELD:${transactionId}:description`),
    ],
    [Markup.button.callback('Удалить', `QUICK_DELETE:${transactionId}`)],
  ];
}

function afterExpenseKeyboard(category, transactionId) {
  return Markup.inlineKeyboard([
    ...quickEditRows(transactionId),
    ...(transactionId
      ? [[Markup.button.callback('Другая категория', `QUICK_EDIT_CATEGORY:${transactionId}`)]]
      : []),
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.REPEAT_CATEGORY}:${category}`)],
    [Markup.button.callback('Добавить в другую категорию', actions.CHANGE_EXPENSE_CATEGORY)],
    [Markup.button.callback('Главное меню', 'SHOW_MENU')],
  ]);
}

function afterIncomeKeyboard(category, transactionId) {
  return Markup.inlineKeyboard([
    ...quickEditRows(transactionId),
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.ADD_INCOME}:${category}`)],
    [Markup.button.callback('Другая категория', actions.CHANGE_INCOME_CATEGORY)],
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

function categoryNamesKeyboard(categories, actionPrefix) {
  const buttons = categories.map((category) =>
    Markup.button.callback(category, `${actionPrefix}:${category}`)
  );
  const rows = [];

  for (let index = 0; index < buttons.length; index += 2) {
    rows.push(buttons.slice(index, index + 2));
  }

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function categoryTypeKeyboard(actionPrefix) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Расходы', `${actionPrefix}:EXPENSE`),
      Markup.button.callback('Доходы', `${actionPrefix}:INCOME`),
    ],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function accountKindKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Доступные деньги', 'ACCOUNT_KIND:AVAILABLE'),
      Markup.button.callback('Накопления', 'ACCOUNT_KIND:SAVINGS'),
    ],
    [Markup.button.callback('Отмена', actions.CANCEL)],
  ]);
}

function accountListKeyboard(accounts, actionPrefix) {
  const rows = accounts.map((account) => [
    Markup.button.callback(account.name, `${actionPrefix}:${account.id}`),
  ]);

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}

function plannedPaymentListKeyboard(payments, actionPrefix) {
  const rows = payments.map((payment) => [
    Markup.button.callback(
      `${payment.dayOfMonth} число - ${payment.description}`,
      `${actionPrefix}:${payment.id}`
    ),
  ]);

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

function accountsManageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить счет', actions.ACCOUNT_ADD_HELP)],
    [
      Markup.button.callback('Изменить сумму', actions.ACCOUNT_SET_HELP),
      Markup.button.callback('Удалить счет', actions.ACCOUNT_DELETE_HELP),
    ],
  ]);
}

function categoriesManageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Добавить расход', actions.CATEGORY_ADD_EXPENSE_HELP),
      Markup.button.callback('Добавить доход', actions.CATEGORY_ADD_INCOME_HELP),
    ],
    [
      Markup.button.callback('Удалить расход', actions.CATEGORY_DELETE_EXPENSE_HELP),
      Markup.button.callback('Удалить доход', actions.CATEGORY_DELETE_INCOME_HELP),
    ],
  ]);
}

function plannedPaymentsManageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить платеж', actions.PLANNED_ADD_HELP)],
    [
      Markup.button.callback('Напоминание вкл.', actions.PLANNED_REMINDER_ON_HELP),
      Markup.button.callback('Напоминание выкл.', actions.PLANNED_REMINDER_OFF_HELP),
    ],
    [Markup.button.callback('Удалить платеж', actions.PLANNED_DELETE_HELP)],
  ]);
}

function reminderManageKeyboard(options = {}) {
  const { enabled = false, isAdmin = false } = options;
  const rows = [
    [Markup.button.callback('Изменить время', actions.REMINDER_CHANGE_HELP)],
    [
      enabled
        ? Markup.button.callback('Выключить', actions.REMINDER_OFF)
        : Markup.button.callback('Включить', actions.REMINDER_ON),
    ],
  ];

  if (isAdmin) {
    rows.push([
      Markup.button.callback('Тест', actions.REMINDER_TEST),
      Markup.button.callback('Расписание', actions.REMINDER_CHECK),
    ]);
    rows.push([Markup.button.callback('Запустить проверку', actions.REMINDER_RUN)]);
  }

  return Markup.inlineKeyboard(rows);
}

function recentExpensesKeyboard(nextOffset, options = {}) {
  const { family = false } = options;
  const action = family ? actions.FAMILY_RECENT_NEXT : actions.RECENT_EXPENSES_NEXT;

  return Markup.inlineKeyboard([
    [Markup.button.callback('Следующие 10', `${action}:${nextOffset}`)],
  ]);
}

function categoryExpensesNextKeyboard(nextOffset, category, options = {}) {
  const action = options.family
    ? actions.STATS_FAMILY_CATEGORY_EXPENSES_NEXT
    : actions.STATS_CATEGORY_EXPENSES_NEXT;

  return Markup.inlineKeyboard([
    [Markup.button.callback('Следующие 10', `${action}:${nextOffset}:${category}`)],
  ]);
}

function statsManageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Семейная статистика', actions.STATS_FAMILY_MONTH)],
    [
      Markup.button.callback('Сегодня', actions.STATS_TODAY),
      Markup.button.callback('Неделя', actions.STATS_WEEK),
    ],
    [
      Markup.button.callback('Прошлый месяц', actions.STATS_PREVIOUS_MONTH),
      Markup.button.callback('Сравнение', actions.STATS_COMPARE),
    ],
    [
      Markup.button.callback('Топ трат', actions.STATS_TOP),
      Markup.button.callback('График расходов', actions.STATS_CHART),
    ],
    [Markup.button.callback('Траты по категории', actions.STATS_CATEGORY_EXPENSES)],
    [
      Markup.button.callback('CSV', actions.STATS_EXPORT_CSV),
      Markup.button.callback('XLSX', actions.STATS_EXPORT_XLSX),
    ],
  ]);
}

function familyStatsManageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Личная статистика', actions.STATS_MONTH)],
    [
      Markup.button.callback('Сегодня', actions.STATS_FAMILY_TODAY),
      Markup.button.callback('Неделя', actions.STATS_FAMILY_WEEK),
    ],
    [
      Markup.button.callback('Прошлый месяц', actions.STATS_FAMILY_PREVIOUS_MONTH),
      Markup.button.callback('Сравнение', actions.STATS_FAMILY_COMPARE),
    ],
    [
      Markup.button.callback('Топ трат', actions.STATS_FAMILY_TOP),
      Markup.button.callback('График расходов', actions.STATS_FAMILY_CHART),
    ],
    [Markup.button.callback('Траты по категории', actions.STATS_FAMILY_CATEGORY_EXPENSES)],
    [
      Markup.button.callback('CSV', actions.STATS_FAMILY_EXPORT_CSV),
      Markup.button.callback('XLSX', actions.STATS_FAMILY_EXPORT_XLSX),
    ],
  ]);
}

module.exports = {
  actions,
  accountsManageKeyboard,
  accountKindKeyboard,
  accountListKeyboard,
  afterExpenseKeyboard,
  afterIncomeKeyboard,
  categoriesManageKeyboard,
  categoryExpensesNextKeyboard,
  categoryTypeKeyboard,
  categoryKeyboard,
  categoryNamesKeyboard,
  clearExpensesConfirmKeyboard,
  deleteAccountConfirmKeyboard,
  deleteAccountNumberKeyboard,
  deleteExpenseConfirmKeyboard,
  deleteExpenseListKeyboard,
  doneNoExpenseConfirmKeyboard,
  editExpenseFieldKeyboard,
  editExpenseListKeyboard,
  familyStatsManageKeyboard,
  familyOwnerKeyboard,
  incomeCategoryKeyboard,
  mainMenuKeyboard,
  mainMenuReplyKeyboard,
  plannedPaymentListKeyboard,
  plannedPaymentsManageKeyboard,
  recentExpensesKeyboard,
  reminderManageKeyboard,
  replyLabels,
  searchResultsKeyboard,
  statsManageKeyboard,
};
