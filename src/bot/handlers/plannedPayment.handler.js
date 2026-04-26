const { Markup } = require('telegraf');
const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addPlannedPayment,
  deletePlannedPayment,
  disablePlannedPaymentReminder,
  enablePlannedPaymentReminder,
  getPlannedPayments,
} = require('../../services/plannedPayment.service');
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
      'Добавить: /planned_add 5 | Интернет | Домашний интернет | 700',
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
    'Добавить: /planned_add 5 | Интернет | Домашний интернет | 700',
    'Включить напоминание: /planned_reminder_on ID',
    'Выключить напоминание: /planned_reminder_off ID',
    'Удалить: /planned_delete ID',
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

function registerPlannedPaymentHandlers(bot) {
  bot.command('planned', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const payments = await getPlannedPayments(user.id);

    await ctx.reply(formatPlannedPayments(payments));
  });

  bot.command('planned_add', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const input = ctx.message.text.replace('/planned_add', '').trim();
    const result = await addPlannedPayment({ userId: user.id, input });

    if (!result.ok) {
      await ctx.reply(
        `${getPlannedPaymentErrorText(
          result.reason
        )} Пример: /planned_add 5 | Интернет | Домашний интернет | 700`
      );
      return;
    }

    await ctx.reply(
      `Плановый платеж добавлен: ${result.payment.dayOfMonth} число, ${
        result.payment.category
      }, ${result.payment.description}, ${formatMoney(result.payment.amount, result.payment.currency)}`
    );

    await ctx.replyTemporary(
      'Создать напоминание об этом платеже? Оно придет в день платежа в 10:00.',
      plannedPaymentReminderOfferKeyboard(result.payment.id)
    );
  });

  bot.command('planned_delete', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/planned_delete', '').trim();
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
}

module.exports = { registerPlannedPaymentHandlers };
