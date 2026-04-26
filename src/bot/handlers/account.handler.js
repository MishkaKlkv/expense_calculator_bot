const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addAccount,
  deleteAccount,
  getAccounts,
  setAccountBalance,
  summarizeAccounts,
} = require('../../services/account.service');
const { formatMoney } = require('../../utils/money');

function getShortId(id) {
  return id.slice(0, 8);
}

function getKindLabel(kind) {
  return kind === 'SAVINGS' ? 'накопления' : 'доступно';
}

function formatTotals(totals) {
  const entries = Array.from(totals.entries());

  if (entries.length === 0) {
    return formatMoney(0, 'RUB');
  }

  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(', ');
}

function findAccountByIdPrefix(accounts, idPrefix) {
  if (!idPrefix) {
    return null;
  }

  return accounts.find((account) => account.id === idPrefix || account.id.startsWith(idPrefix)) || null;
}

function formatAccounts(accounts) {
  if (accounts.length === 0) {
    return [
      'Счетов пока нет.',
      '',
      'Добавить доступные деньги: /account_add Карта | доступно | 150000',
      'Добавить накопления: /account_add Вклад | накопления | 200000',
    ].join('\n');
  }

  const summary = summarizeAccounts(accounts);
  const accountLines = accounts.map((account, index) => {
    return `${index + 1}. ${getShortId(account.id)} | ${account.name} | ${getKindLabel(
      account.kind
    )} | ${formatMoney(account.balance, account.currency)}`;
  });

  return [
    'Счета:',
    '',
    `Всего: ${formatTotals(summary.TOTAL)}`,
    `Накоплено: ${formatTotals(summary.SAVINGS)}`,
    `Доступно: ${formatTotals(summary.AVAILABLE)}`,
    '',
    accountLines.join('\n'),
    '',
    'Добавить: /account_add Карта | доступно | 150000',
    'Изменить сумму: /account_set ID 175000',
    'Удалить: /account_delete ID',
  ].join('\n');
}

function getAccountErrorText(reason) {
  const errors = {
    ALREADY_EXISTS: 'Счет с таким названием уже есть.',
    EMPTY_NAME: 'Название счета не должно быть пустым.',
    INVALID_AMOUNT: 'Не понял сумму.',
    INVALID_FORMAT: 'Не понял формат.',
    UNKNOWN_KIND: 'Укажите тип: доступно или накопления.',
  };

  return errors[reason] || 'Не получилось изменить счета.';
}

function registerAccountHandlers(bot) {
  bot.command('accounts', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const accounts = await getAccounts(user.id);

    await ctx.reply(formatAccounts(accounts));
  });

  bot.command('account_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const input = ctx.message.text.replace('/account_add', '').trim();
    const result = await addAccount({ userId: user.id, input });

    if (!result.ok) {
      await ctx.reply(
        `${getAccountErrorText(result.reason)} Пример: /account_add Карта | доступно | 150000`
      );
      return;
    }

    await ctx.reply(
      `Счет добавлен: ${result.account.name}, ${getKindLabel(
        result.account.kind
      )}, ${formatMoney(result.account.balance, result.account.currency)}`
    );
  });

  bot.command('account_set', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const [, idPrefix, ...amountParts] = ctx.message.text.trim().split(/\s+/u);
    const accounts = await getAccounts(user.id);
    const account = findAccountByIdPrefix(accounts, idPrefix);

    if (!account) {
      await ctx.reply('Счет не найден. Посмотреть список: /accounts');
      return;
    }

    const result = await setAccountBalance({
      userId: user.id,
      id: account.id,
      amountText: amountParts.join(' '),
    });

    await ctx.reply(result.ok ? 'Сумма счета обновлена.' : getAccountErrorText(result.reason));
  });

  bot.command('account_delete', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/account_delete', '').trim();
    const accounts = await getAccounts(user.id);
    const account = findAccountByIdPrefix(accounts, idPrefix);

    if (!account) {
      await ctx.reply('Счет не найден. Посмотреть список: /accounts');
      return;
    }

    const result = await deleteAccount({ userId: user.id, id: account.id });

    await ctx.reply(result.ok ? 'Счет удален.' : 'Счет не найден.');
  });
}

module.exports = {
  formatAccounts,
  registerAccountHandlers,
};
