const { upsertTelegramUser } = require('../../repositories/user.repository');
const {
  addPlannedPayment,
  deletePlannedPayment,
  getPlannedPayments,
} = require('../../services/plannedPayment.service');
const { formatMoney } = require('../../utils/money');

function getShortId(id) {
  return id.slice(0, 8);
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

    return `${index + 1}. ${getShortId(payment.id)} | ${payment.dayOfMonth} число | ${
      payment.category
    } | ${payment.description} | ${formatMoney(payment.amount, payment.currency)}${status}`;
  });

  return [
    'Плановые платежи:',
    '',
    lines.join('\n'),
    '',
    'Добавить: /planned_add 5 | Интернет | Домашний интернет | 700',
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
  });

  bot.command('planned_delete', async (ctx) => {
    const user = await upsertTelegramUser(ctx.from);
    const idPrefix = ctx.message.text.replace('/planned_delete', '').trim();
    const payments = await getPlannedPayments(user.id);
    const payment = payments.find((item) => item.id === idPrefix || item.id.startsWith(idPrefix));

    if (!payment) {
      await ctx.reply('Плановый платеж не найден. Посмотреть список: /planned');
      return;
    }

    const result = await deletePlannedPayment({ userId: user.id, id: payment.id });

    await ctx.reply(result.ok ? 'Плановый платеж удален.' : 'Плановый платеж не найден.');
  });
}

module.exports = { registerPlannedPaymentHandlers };
