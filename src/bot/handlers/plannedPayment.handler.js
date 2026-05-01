const { Markup } = require('telegraf');
const {
  actions,
  categoryNamesKeyboard,
  plannedPaymentListKeyboard,
  plannedPaymentsManageKeyboard,
} = require('../keyboards');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addPlannedPayment,
  deletePlannedPayment,
  disablePlannedPaymentReminder,
  enablePlannedPaymentReminder,
  getPlannedPayments,
} = require('../../services/plannedPayment.service');
const { getUserCategoryNames } = require('../../services/category.service');
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

function findPaymentByIdPrefix(payments, idPrefix) {
  if (!idPrefix) {
    return null;
  }

  return payments.find((item) => item.id === idPrefix || item.id.startsWith(idPrefix)) || null;
}

function plannedPaymentReminderOfferKeyboard(paymentId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Напомнить в день платежа', `PLANNED_REMINDER_ON:${paymentId}`),
    ],
    [
      Markup.button.callback('Не нужно', `PLANNED_REMINDER_SKIP:${paymentId}`),
    ],
  ]);
}

function formatPlannedPayments(payments) {
  if (payments.length === 0) {
    return [
      'Плановых платежей пока нет.',
      '',
      'Нажмите кнопку ниже, чтобы добавить первый платеж.',
    ].join('\n');
  }

  const lines = payments.map((payment, index) => {
    const status = payment.enabled ? '' : ' выключен';
    const reminder = payment.reminderEnabled ? ', напоминание включено' : ', без напоминания';

    return `${index + 1}. ${getShortId(payment.id)} | ${payment.dayOfMonth} число | ${
      payment.category
    } | ${payment.description} | ${formatMoney(payment.amount, payment.currency)}${status}${reminder}`;
  });

  return [
    'Плановые платежи:',
    '',
    lines.join('\n'),
    '',
    'Действия доступны кнопками ниже.',
  ].join('\n');
}

function getPlannedPaymentErrorText(reason) {
  const errors = {
    INVALID_FORMAT: 'Не понял формат.',
    INVALID_DAY: 'День месяца должен быть числом от 1 до 31.',
    INVALID_AMOUNT: 'Не понял сумму.',
    UNKNOWN_CATEGORY: 'Не знаю такую категорию расходов.',
  };

  return errors[reason] || 'Не получилось сохранить плановый платеж.';
}

async function startPlannedAdd(ctx) {
  const user = await upsertTelegramUser(ctx.from);

  await setDialogState(user.id, 'PLANNED_ADD_WAITING_FOR_DAY');
  await ctx.reply('В какой день месяца платеж? Напишите число от 1 до 31.\nОтмена: /cancel');
}

async function askPlannedPaymentForAction(ctx, state, actionPrefix, emptyText) {
  const user = await upsertTelegramUser(ctx.from);
  const payments = await getPlannedPayments(user.id);

  if (payments.length === 0) {
    await ctx.reply(emptyText);
    return;
  }

  await setDialogState(user.id, state);
  await ctx.reply('Выберите плановый платеж:', plannedPaymentListKeyboard(payments, actionPrefix));
}

async function savePlannedPaymentFromDialog(ctx, user, payload, amountText) {
  if (!payload.dayOfMonth || !payload.category || !payload.description) {
    await resetDialogState(user.id);
    await ctx.reply('Данные планового платежа потерялись, начнем заново через /planned.');
    return;
  }

  const result = await addPlannedPayment({
    userId: user.id,
    input: `${payload.dayOfMonth} | ${payload.category} | ${payload.description} | ${amountText}`,
  });

  if (!result.ok) {
    await ctx.reply(
      `${getPlannedPaymentErrorText(result.reason)} Напишите сумму, например: 700 или 10 usd. Отмена: /cancel`
    );
    return;
  }

  const progress = await unlockFeatureAchievement(user.id, 'FIRST_PLANNED_PAYMENT');

  await resetDialogState(user.id);
  await ctx.reply(
    `Плановый платеж добавлен: ${result.payment.dayOfMonth} число, ${
      result.payment.category
    }, ${result.payment.description}, ${formatMoney(
      result.payment.amount,
      result.payment.currency
    )}${formatAchievementUnlocks(progress.achievements)}`
  );

  await ctx.replyTemporary(
    'Создать напоминание об этом платеже? Оно придет в день платежа в 10:00.',
    plannedPaymentReminderOfferKeyboard(result.payment.id)
  );
}

async function handlePlannedPaymentDialog(ctx, user, dialogState) {
  const text = ctx.message.text.trim();

  if (dialogState.state === 'PLANNED_ADD_WAITING_FOR_DAY') {
    const dayOfMonth = Number(text);

    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      await ctx.reply('День месяца должен быть числом от 1 до 31. Например: 5\nОтмена: /cancel');
      return true;
    }

    const categories = await getUserCategoryNames({ userId: user.id, type: 'EXPENSE' });

    await setDialogState(user.id, 'PLANNED_ADD_WAITING_FOR_CATEGORY', { dayOfMonth });
    await ctx.reply('Выберите категорию платежа:', categoryNamesKeyboard(categories, 'PLANNED_CATEGORY'));
    return true;
  }

  if (dialogState.state === 'PLANNED_ADD_WAITING_FOR_CATEGORY') {
    await ctx.reply('Выберите категорию кнопкой или отмените действие: /cancel');
    return true;
  }

  if (dialogState.state === 'PLANNED_ADD_WAITING_FOR_DESCRIPTION') {
    if (!text) {
      await ctx.reply('Описание не должно быть пустым. Например: Домашний интернет\nОтмена: /cancel');
      return true;
    }

    await setDialogState(user.id, 'PLANNED_ADD_WAITING_FOR_AMOUNT', {
      ...(dialogState.payload || {}),
      description: text,
    });
    await ctx.reply('Какая сумма платежа? Например: 700 или 10 usd\nОтмена: /cancel');
    return true;
  }

  if (dialogState.state === 'PLANNED_ADD_WAITING_FOR_AMOUNT') {
    await savePlannedPaymentFromDialog(ctx, user, dialogState.payload || {}, text);
    return true;
  }

  if (
    dialogState.state === 'PLANNED_DELETE_WAITING_FOR_PAYMENT' ||
    dialogState.state === 'PLANNED_REMINDER_ON_WAITING_FOR_PAYMENT' ||
    dialogState.state === 'PLANNED_REMINDER_OFF_WAITING_FOR_PAYMENT'
  ) {
    await ctx.reply('Выберите платеж кнопкой из списка или отмените действие: /cancel');
    return true;
  }

  return false;
}

function registerPlannedPaymentHandlers(bot) {
  bot.command('planned', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const payments = await getPlannedPayments(user.id);

    await ctx.reply(formatPlannedPayments(payments), plannedPaymentsManageKeyboard());
  });

  bot.command('planned_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const input = ctx.message.text.replace('/planned_add', '').trim();

    if (!input) {
      await startPlannedAdd(ctx);
      return;
    }

    const result = await addPlannedPayment({ userId: user.id, input });

    if (!result.ok) {
      await ctx.reply(
        `${getPlannedPaymentErrorText(
          result.reason
        )} Пример: /planned_add 5 | Интернет | Домашний интернет | 700`
      );
      return;
    }

    const progress = await unlockFeatureAchievement(user.id, 'FIRST_PLANNED_PAYMENT');

    await ctx.reply(
      `Плановый платеж добавлен: ${result.payment.dayOfMonth} число, ${
        result.payment.category
      }, ${result.payment.description}, ${formatMoney(
        result.payment.amount,
        result.payment.currency
      )}${formatAchievementUnlocks(progress.achievements)}`
    );

    await ctx.replyTemporary(
      'Создать напоминание об этом платеже? Оно придет в день платежа в 10:00.',
      plannedPaymentReminderOfferKeyboard(result.payment.id)
    );
  });

  bot.command('planned_delete', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/planned_delete', '').trim();

    if (!idPrefix) {
      await askPlannedPaymentForAction(
        ctx,
        'PLANNED_DELETE_WAITING_FOR_PAYMENT',
        'PLANNED_DELETE_SELECT',
        'Плановых платежей пока нет.'
      );
      return;
    }

    const payments = await getPlannedPayments(user.id);
    const payment = findPaymentByIdPrefix(payments, idPrefix);

    if (!payment) {
      await ctx.reply('Плановый платеж не найден. Посмотреть список: /planned');
      return;
    }

    const result = await deletePlannedPayment({ userId: user.id, id: payment.id });

    await ctx.reply(result.ok ? 'Плановый платеж удален.' : 'Плановый платеж не найден.');
  });

  bot.command('planned_reminder_on', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/planned_reminder_on', '').trim();

    if (!idPrefix) {
      await askPlannedPaymentForAction(
        ctx,
        'PLANNED_REMINDER_ON_WAITING_FOR_PAYMENT',
        'PLANNED_REMINDER_ON_SELECT',
        'Плановых платежей пока нет.'
      );
      return;
    }

    const payments = await getPlannedPayments(user.id);
    const payment = findPaymentByIdPrefix(payments, idPrefix);

    if (!payment) {
      await ctx.reply('Плановый платеж не найден. Посмотреть список: /planned');
      return;
    }

    const result = await enablePlannedPaymentReminder({ userId: user.id, id: payment.id });

    await ctx.reply(
      result.ok
        ? 'Напоминание включено. Оно придет в день платежа в 10:00.'
        : 'Плановый платеж не найден.'
    );
  });

  bot.command('planned_reminder_off', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/planned_reminder_off', '').trim();

    if (!idPrefix) {
      await askPlannedPaymentForAction(
        ctx,
        'PLANNED_REMINDER_OFF_WAITING_FOR_PAYMENT',
        'PLANNED_REMINDER_OFF_SELECT',
        'Плановых платежей пока нет.'
      );
      return;
    }

    const payments = await getPlannedPayments(user.id);
    const payment = findPaymentByIdPrefix(payments, idPrefix);

    if (!payment) {
      await ctx.reply('Плановый платеж не найден. Посмотреть список: /planned');
      return;
    }

    const result = await disablePlannedPaymentReminder({ userId: user.id, id: payment.id });

    await ctx.reply(result.ok ? 'Напоминание выключено.' : 'Плановый платеж не найден.');
  });

  bot.action(/^PLANNED_REMINDER_ON:(.+)$/u, async (ctx) => {
    await ctx.answerCbQuery();
    const user = await upsertTelegramUser(ctx.from);
    const result = await enablePlannedPaymentReminder({ userId: user.id, id: ctx.match[1] });

    await ctx.reply(
      result.ok
        ? 'Готово. Напомню об этом платеже в день оплаты в 10:00.'
        : 'Плановый платеж не найден.'
    );
  });

  bot.action(/^PLANNED_REMINDER_SKIP:(.+)$/u, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Ок, напоминание не создаю.');
  });

  bot.action(actions.PLANNED_ADD_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await startPlannedAdd(ctx);
  });

  bot.action(actions.PLANNED_DELETE_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await askPlannedPaymentForAction(
      ctx,
      'PLANNED_DELETE_WAITING_FOR_PAYMENT',
      'PLANNED_DELETE_SELECT',
      'Плановых платежей пока нет.'
    );
  });

  bot.action(actions.PLANNED_REMINDER_ON_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await askPlannedPaymentForAction(
      ctx,
      'PLANNED_REMINDER_ON_WAITING_FOR_PAYMENT',
      'PLANNED_REMINDER_ON_SELECT',
      'Плановых платежей пока нет.'
    );
  });

  bot.action(actions.PLANNED_REMINDER_OFF_HELP, async (ctx) => {
    await ctx.answerCbQuery();
    await askPlannedPaymentForAction(
      ctx,
      'PLANNED_REMINDER_OFF_WAITING_FOR_PAYMENT',
      'PLANNED_REMINDER_OFF_SELECT',
      'Плановых платежей пока нет.'
    );
  });

  bot.action(/^PLANNED_CATEGORY:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);

    await ctx.answerCbQuery();

    if (dialogState.state !== 'PLANNED_ADD_WAITING_FOR_CATEGORY') {
      await ctx.reply('Начните добавление планового платежа через /planned.');
      return;
    }

    await setDialogState(user.id, 'PLANNED_ADD_WAITING_FOR_DESCRIPTION', {
      ...(dialogState.payload || {}),
      category: ctx.match[1],
    });
    await ctx.reply('За что этот платеж? Например: Домашний интернет\nОтмена: /cancel');
  });

  bot.action(/^PLANNED_DELETE_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await deletePlannedPayment({ userId: user.id, id: ctx.match[1] });

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await ctx.reply(result.ok ? 'Плановый платеж удален.' : 'Плановый платеж не найден.');
  });

  bot.action(/^PLANNED_REMINDER_ON_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await enablePlannedPaymentReminder({ userId: user.id, id: ctx.match[1] });

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await ctx.reply(
      result.ok
        ? 'Напоминание включено. Оно придет в день платежа в 10:00.'
        : 'Плановый платеж не найден.'
    );
  });

  bot.action(/^PLANNED_REMINDER_OFF_SELECT:(.+)$/u, async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const result = await disablePlannedPaymentReminder({ userId: user.id, id: ctx.match[1] });

    await ctx.answerCbQuery();
    await resetDialogState(user.id);
    await ctx.reply(result.ok ? 'Напоминание выключено.' : 'Плановый платеж не найден.');
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) {
      return next();
    }

    const user = await upsertTelegramUser(ctx.from);
    const dialogState = await getDialogState(user.id);
    const handled = await handlePlannedPaymentDialog(ctx, user, dialogState);

    if (!handled) {
      return next();
    }
  });
}

module.exports = { registerPlannedPaymentHandlers };
