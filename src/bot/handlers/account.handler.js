const {
  accountKindKeyboard,
  accountListKeyboard,
  accountsManageKeyboard,
  actions,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addAccount,
  deleteAccount,
  getAccounts,
  setAccountBalance,
  summarizeAccounts,
} = require('../../services/account.service');
const {
  getDialogState,
  resetDialogState,
  setDialogState,
} = require('../../services/dialogState.service');
const {
  formatAchievementUnlocks,
  unlockFeatureAchievement,
} = require('../../services/gamification.service');
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
      'Нажмите кнопку ниже, чтобы добавить первый счет.',
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
    'Действия доступны кнопками ниже.',
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

async function startAccountAdd(ctx) {
  const user = await upsertTelegramUser(ctx.from);

  await setDialogState(user.id, 'ACCOUNT_ADD_WAITING_FOR_NAME');
  await ctx.reply('Как назвать счет? Например: Карта, Наличные, Вклад.\nОтмена: /cancel');
}

async function askAccountForAction(ctx, state, actionPrefix, emptyText) {
  const user = await upsertTelegramUser(ctx.from);
  const accounts = await getAccounts(user.id);

  if (accounts.length === 0) {
    await ctx.reply(emptyText);
    return;
  }

  await setDialogState(user.id, state);
  await ctx.reply('Выберите счет:', accountListKeyboard(accounts, actionPrefix));
}

async function saveAccountFromDialog(ctx, user, payload, balanceText) {
  if (!payload.name || !payload.kind) {
    await resetDialogState(user.id);
    await ctx.reply('Данные счета потерялись, начнем заново через /accounts.');
    return;
  }

  const result = await addAccount({
    userId: user.id,
    input: `${payload.name} | ${payload.kind} | ${balanceText}`,
  });

  if (!result.ok) {
    await ctx.reply(
      `${getAccountErrorText(result.reason)} Напишите сумму, например: 150000 или 500 usd. Отмена: /cancel`
    );
    return;
  }

  const progress = await unlockFeatureAchievement(user.id, 'FIRST_ACCOUNT');

  await resetDialogState(user.id);
  await ctx.reply(
    `Счет добавлен: ${result.account.name}, ${getKindLabel(
      result.account.kind
    )}, ${formatMoney(result.account.balance, result.account.currency)}${formatAchievementUnlocks(
      progress.achievements
    )}`
  );
}

async function handleAccountDialog(ctx, user, dialogState) {
  const text = ctx.message.text.trim();

  if (dialogState.state === 'ACCOUNT_ADD_WAITING_FOR_NAME') {
    if (!text) {
      await ctx.reply('Название счета не должно быть пустым. Например: Карта\nОтмена: /cancel');
      return true;
    }

    await setDialogState(user.id, 'ACCOUNT_ADD_WAITING_FOR_KIND', { name: text });
    await ctx.reply('Что это за деньги?', accountKindKeyboard());
    return true;
  }

  if (dialogState.state === 'ACCOUNT_ADD_WAITING_FOR_BALANCE') {
    await saveAccountFromDialog(ctx, user, dialogState.payload || {}, text);
    return true;
  }

  if (
    dialogState.state === 'ACCOUNT_SET_WAITING_FOR_ACCOUNT' ||
    dialogState.state === 'ACCOUNT_DELETE_WAITING_FOR_ACCOUNT'
  ) {
    await ctx.reply('Выберите счет кнопкой из списка или отмените действие: /cancel');
    return true;
  }

  if (dialogState.state === 'ACCOUNT_SET_WAITING_FOR_BALANCE') {
    const { accountId } = dialogState.payload || {};
    const result = await setAccountBalance({ userId: user.id, id: accountId, amountText: text });

    if (!result.ok) {
      await ctx.reply(
        `${getAccountErrorText(result.reason)} Напишите сумму, например: 175000 или 500 usd. Отмена: /cancel`
      );
      return true;
    }

    await resetDialogState(user.id);
    await ctx.reply('Сумма счета обновлена.');
    return true;
  }

  return false;
}

function registerAccountHandlers(bot) {
  bot.command('accounts', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const accounts = await getAccounts(user.id);

    await ctx.reply(formatAccounts(accounts), accountsManageKeyboard());
  });

  bot.command('account_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const input = ctx.message.text.replace('/account_add', '').trim();

    if (!input) {
      await startAccountAdd(ctx);
      return;
    }

    const result = await addAccount({ userId: user.id, input });

    if (!result.ok) {
      await ctx.reply(
        `${getAccountErrorText(result.reason)} Пример: /account_add Карта | доступно | 150000`
      );
      return;
    }

    const progress = await unlockFeatureAchievement(user.id, 'FIRST_ACCOUNT');

    await ctx.reply(
      `Счет добавлен: ${result.account.name}, ${getKindLabel(
        result.account.kind
      )}, ${formatMoney(result.account.balance, result.account.currency)}${formatAchievementUnlocks(
        progress.achievements
      )}`
    );
  });

  bot.command('account_set', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const [, idPrefix, ...amountParts] = ctx.message.text.trim().split(/\s+/u);

    if (!idPrefix) {
      await askAccountForAction(
        ctx,
        'ACCOUNT_SET_WAITING_FOR_ACCOUNT',
        'ACCOUNT_SET_SELECT',
        'Счетов пока нет. Добавить счет можно через /accounts.'
      );
      return;
    }

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

    if (!idPrefix) {
      await askAccountForAction(
        ctx,
        'ACCOUNT_DELETE_WAITING_FOR_ACCOUNT',
        'ACCOUNT_DELETE_SELECT',
        'Счетов пока нет.'
      );
      return;
    }

    const accounts = await getAccounts(user.id);
    const account = findAccountByIdPrefix(accounts, idPrefix);

    if (!account) {
      await ctx.reply('Счет не найден. Посмотреть список: /accounts');
      return;
    }

    const result = await deleteAccount({ userId: user.id, id: account.id });

    await ctx.reply(result.ok ? 'Счет удален.' : 'Счет не найден.');
  });

  bot.action(actions.ACCOUNT_ADD_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await startAccountAdd(ctx);
  });

  bot.action(actions.ACCOUNT_SET_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await askAccountForAction(
      ctx,
      'ACCOUNT_SET_WAITING_FOR_ACCOUNT',
      'ACCOUNT_SET_SELECT',
      'Счетов пока нет. Добавить счет можно через /accounts.'
    );
  });

  bot.action(actions.ACCOUNT_DELETE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await askAccountForAction(
      ctx,
      'ACCOUNT_DELETE_WAITING_FOR_ACCOUNT',
      'ACCOUNT_DELETE_SELECT',
      'Счетов пока нет.'
    );
  });

  bot.action(/^ACCOUNT_KIND:(AVAILABLE|SAVINGS)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);

    await ctx.answerCbQuery();

    if (dialogState.state !== 'ACCOUNT_ADD_WAITING_FOR_KIND') {
      await ctx.reply('Начните добавление счета через /accounts.');
      return;
    }

    await setDialogState(user.id, 'ACCOUNT_ADD_WAITING_FOR_BALANCE', {
      ...(dialogState.payload || {}),
      kind: ctx.match[1],
    });
    await ctx.reply('Какая сейчас сумма на счете? Например: 150000 или 500 usd\nОтмена: /cancel');
  });

  bot.action(/^ACCOUNT_SET_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);

    await ctx.answerCbQuery();
    await setDialogState(user.id, 'ACCOUNT_SET_WAITING_FOR_BALANCE', { accountId: ctx.match[1] });
    await ctx.reply('Отправьте новую сумму счета. Например: 175000 или 500 usd\nОтмена: /cancel');
  });

  bot.action(/^ACCOUNT_DELETE_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await deleteAccount({ userId: user.id, id: ctx.match[1] });

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await ctx.reply(result.ok ? 'Счет удален.' : 'Счет не найден.');
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);
    const handled = await handleAccountDialog(ctx, user, dialogState);

    if (!handled) {
      return next();
    }
  });
}

module.exports = {
  formatAccounts,
  registerAccountHandlers,
};
