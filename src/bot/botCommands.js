const botCommands = [
  { command: 'menu', description: 'Главное меню' },
  { command: 'help', description: 'Справка по командам' },
  { command: 'cancel', description: 'Отменить текущее действие' },
  { command: 'add', description: 'Добавить расход' },
  { command: 'add_income', description: 'Добавить доход' },
  { command: 'stats', description: 'Статистика за текущий месяц' },
  { command: 'prev_month', description: 'Статистика за прошлый месяц' },
  { command: 'balance', description: 'Баланс и деньги сейчас' },
  { command: 'income', description: 'Доходы за текущий месяц' },
  { command: 'accounts', description: 'Счета, накопления и доступные деньги' },
  { command: 'account_add', description: 'Добавить счет' },
  { command: 'account_set', description: 'Изменить сумму счета' },
  { command: 'account_delete', description: 'Удалить счет' },
  { command: 'planned', description: 'Плановые платежи' },
  { command: 'planned_add', description: 'Добавить плановый платеж' },
  { command: 'planned_delete', description: 'Удалить плановый платеж' },
  { command: 'weekly_report', description: 'Отчет за прошлую неделю' },
  { command: 'reminder', description: 'Ежедневное напоминание' },
  { command: 'reminder_off', description: 'Выключить напоминание' },
  { command: 'reminder_on', description: 'Включить напоминание снова' },
  { command: 'recent', description: 'Последние траты' },
  { command: 'today', description: 'Расходы за сегодня' },
  { command: 'week', description: 'Расходы за неделю' },
  { command: 'compare', description: 'Сравнение с прошлым месяцем' },
  { command: 'top', description: 'Топ трат месяца' },
  { command: 'chart', description: 'График расходов за месяц' },
  { command: 'export_csv', description: 'Экспорт CSV' },
  { command: 'export_xlsx', description: 'Экспорт XLSX' },
  { command: 'categories', description: 'Список категорий' },
  { command: 'category_add', description: 'Добавить категорию' },
  { command: 'category_delete', description: 'Удалить категорию' },
  { command: 'edit', description: 'Редактировать операцию' },
  { command: 'delete', description: 'Удалить операцию' },
  { command: 'family', description: 'Семейный счет' },
  { command: 'family_create', description: 'Создать семейный счет' },
  { command: 'family_join', description: 'Присоединиться к семейному счету' },
  { command: 'family_stats', description: 'Семейная статистика' },
  { command: 'family_recent', description: 'Последние семейные траты' },
  { command: 'family_by_user', description: 'Кто сколько потратил в семье' },
];

async function configureBotCommands(bot) {
  await bot.telegram.setMyCommands(botCommands);
  await bot.telegram.setChatMenuButton({
    menuButton: {
      type: 'commands',
    },
  });
}

module.exports = {
  botCommands,
  configureBotCommands,
};
