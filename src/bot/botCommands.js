const botCommands = [
  { command: 'menu', description: 'Главное меню' },
  { command: 'help', description: 'Справка по командам' },
  { command: 'cancel', description: 'Отменить текущее действие' },
  { command: 'add', description: 'Добавить расход' },
  { command: 'add_income', description: 'Добавить доход' },
  { command: 'stats', description: 'Статистика за текущий месяц' },
  { command: 'balance', description: 'Баланс и деньги сейчас' },
  { command: 'accounts', description: 'Счета, накопления и доступные деньги' },
  { command: 'planned', description: 'Плановые платежи' },
  { command: 'reminder', description: 'Ежедневное напоминание' },
  { command: 'categories', description: 'Категории' },
  { command: 'family', description: 'Семейный счет' },
  { command: 'profile', description: 'Профиль учета и достижения' },
  { command: 'streak', description: 'Серия учета' },
  { command: 'done', description: 'Отметить день без расходов' },
  { command: 'recent', description: 'Последние траты' },
  { command: 'edit', description: 'Редактировать операцию' },
  { command: 'delete', description: 'Удалить операцию' },
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
