const botCommands = [
  { command: 'menu', description: 'Главное меню' },
  { command: 'help', description: 'Справка по командам' },
  { command: 'cancel', description: 'Отменить текущее действие' },
  { command: 'add', description: 'Добавить расход' },
  { command: 'add_income', description: 'Добавить доход' },
  { command: 'stats', description: 'Статистика за текущий месяц' },
  { command: 'balance', description: 'Баланс и деньги сейчас' },
  { command: 'accounts', description: 'Счета и накопления' },
  { command: 'planned', description: 'Платежи и напоминания' },
  { command: 'reminder', description: 'Настроить напоминание' },
  { command: 'categories', description: 'Добавить/удалить категории' },
  { command: 'family', description: 'Семейный счет и участники' },
  { command: 'profile', description: 'Уровень, XP и достижения' },
  { command: 'streak', description: 'Серия учета' },
  { command: 'done', description: 'Отметить день без расходов' },
  { command: 'recent', description: 'Последние траты' },
  { command: 'edit', description: 'Редактировать операцию' },
  { command: 'delete', description: 'Удалить операцию' },
];

async function configureBotCommands(bot) {
  await bot.telegram.setMyCommands(botCommands);
  await configureChatMenuButton(bot.telegram);
}

async function configureChatMenuButton(telegram, chatId) {
  await telegram.setChatMenuButton({
    ...(chatId ? { chatId } : {}),
    menuButton: {
      type: 'commands',
    },
  });
}

module.exports = {
  botCommands,
  configureChatMenuButton,
  configureBotCommands,
};
