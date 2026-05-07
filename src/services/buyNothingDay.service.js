const { findActiveTelegramUserIdsInRange } = require('../repositories/botEvent.repository');
const {
  findUsersWithoutBuyNothingDayDelivery,
  markBuyNothingDaySent,
} = require('../repositories/buyNothingDay.repository');

const BUY_NOTHING_DAY_TIMEZONE = 'Europe/Moscow';
const BUY_NOTHING_DAY_NOTIFICATION_TIME = '10:00';
const ACTIVE_WINDOW_DAYS = 7;

function getZonedParts(date = new Date(), timezone = BUY_NOTHING_DAY_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    day: Number(parts.day),
    hour: Number(hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    time: `${hour}:${parts.minute}`,
    year: Number(parts.year),
  };
}

function formatDateKeyFromUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMoscowDateStartUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

function getLastSaturdayOfNovemberDateKey(year) {
  const date = new Date(Date.UTC(year, 10, 30, 0, 0, 0, 0));

  while (date.getUTCDay() !== 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return formatDateKeyFromUtcDate(date);
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateKeyFromUtcDate(date);
}

function getBuyNothingDayDueInfo(date = new Date()) {
  const parts = getZonedParts(date);
  const eventDate = getLastSaturdayOfNovemberDateKey(parts.year);
  const notificationDate = shiftDateKey(eventDate, -1);
  const activeSinceDate = shiftDateKey(parts.dateKey, -ACTIVE_WINDOW_DAYS);

  return {
    activeSince: getMoscowDateStartUtc(activeSinceDate),
    currentDate: parts.dateKey,
    currentTime: parts.time,
    eventDate,
    eventYear: parts.year,
    isDue: parts.dateKey === notificationDate && parts.time >= BUY_NOTHING_DAY_NOTIFICATION_TIME,
    notificationDate,
    notificationTime: BUY_NOTHING_DAY_NOTIFICATION_TIME,
    timezone: BUY_NOTHING_DAY_TIMEZONE,
  };
}

function buildBuyNothingDayMessage() {
  return [
    'Завтра Buy Nothing Day — день без покупок.',
    '',
    'Идея простая: на один день поставить покупки на паузу и посмотреть, что из привычных трат правда нужно, а что появляется просто потому, что вокруг скидки, реклама и “надо успеть”.',
    '',
    'Можно попробовать мягкий челлендж: завтра не покупать лишнего. А если расходов правда не будет — отметить день через /done.',
  ].join('\n');
}

async function getUsersForBuyNothingDayNotification(date = new Date()) {
  const dueInfo = getBuyNothingDayDueInfo(date);

  if (!dueInfo.isDue) {
    return { dueInfo, users: [] };
  }

  const telegramUserIds = await findActiveTelegramUserIdsInRange({
    start: dueInfo.activeSince,
    end: date,
  });
  const users = await findUsersWithoutBuyNothingDayDelivery({
    eventYear: dueInfo.eventYear,
    telegramUserIds,
  });

  return { dueInfo, users };
}

async function markBuyNothingDayNotificationSent({ userId, eventYear }) {
  return markBuyNothingDaySent({ userId, eventYear });
}

module.exports = {
  BUY_NOTHING_DAY_NOTIFICATION_TIME,
  BUY_NOTHING_DAY_TIMEZONE,
  buildBuyNothingDayMessage,
  getBuyNothingDayDueInfo,
  getLastSaturdayOfNovemberDateKey,
  getUsersForBuyNothingDayNotification,
  markBuyNothingDayNotificationSent,
};
