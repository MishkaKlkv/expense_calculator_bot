const {
  getDuePlannedPaymentReminders,
  markPlannedPaymentReminderSent,
} = require('./plannedPayment.service');
const { formatMoney } = require('../utils/money');

const PLANNED_PAYMENT_REMINDER_INTERVAL_MS = 60 * 1000;
const PLANNED_PAYMENT_REMINDER_IDLE_LOG_INTERVAL_MS = 60 * 60 * 1000;

function buildPlannedPaymentReminderMessage(payment) {
  return [
    'Напоминание о плановом платеже',
    '',
    `${payment.category}: ${payment.description}`,
    `Сумма: ${formatMoney(payment.amount, payment.currency)}`,
    '',
    'После оплаты можно добавить расход: /add',
  ].join('\n');
}

function getMoscowMonthKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}`;
}

async function runPlannedPaymentReminderTick(bot, options = {}) {
  const { forceLog = false } = options;
  const payments = await getDuePlannedPaymentReminders();

  if (forceLog || payments.length > 0) {
    console.log(`[planned-payment-reminder] due payments found: ${payments.length}`);
  }

  let sent = 0;
  let failed = 0;
  const sentMonth = getMoscowMonthKey();

  for (const payment of payments) {
    try {
      await bot.telegram.sendMessage(
        Number(payment.user.telegramUserId),
        buildPlannedPaymentReminderMessage(payment)
      );
      await markPlannedPaymentReminderSent({ id: payment.id, sentMonth });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[planned-payment-reminder] failed user=${payment.user.telegramUserId} payment=${payment.id}`,
        error
      );
    }
  }

  return {
    due: payments.length,
    failed,
    sent,
  };
}

function startPlannedPaymentReminderScheduler(bot) {
  let isRunning = false;
  let lastIdleLogAt = 0;
  console.log('[planned-payment-reminder] scheduler started');

  async function tick() {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const result = await runPlannedPaymentReminderTick(bot);
      const now = Date.now();

      if (result.due === 0 && now - lastIdleLogAt >= PLANNED_PAYMENT_REMINDER_IDLE_LOG_INTERVAL_MS) {
        console.log('[planned-payment-reminder] tick checked: due=0');
        lastIdleLogAt = now;
      }
    } catch (error) {
      console.error('[planned-payment-reminder] scheduler tick failed', error);
    } finally {
      isRunning = false;
    }
  }

  const interval = setInterval(tick, PLANNED_PAYMENT_REMINDER_INTERVAL_MS);
  tick();

  return {
    stop() {
      clearInterval(interval);
    },
  };
}

module.exports = {
  buildPlannedPaymentReminderMessage,
  runPlannedPaymentReminderTick,
  startPlannedPaymentReminderScheduler,
};
