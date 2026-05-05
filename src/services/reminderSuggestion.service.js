const {
  findActiveTelegramUserIdsInRange,
} = require('../repositories/botEvent.repository');
const {
  findReminderSuggestionCandidates,
  markReminderSuggestionPromptSent,
} = require('../repositories/reminderSuggestion.repository');

const DEFAULT_TIMEZONE = 'Europe/Moscow';
const SUGGESTION_TIME_OF_DAY = '21:00';

function getZonedDateParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
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
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getMoscowDayStartUtc(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

function getReminderSuggestionDueInfo(date = new Date()) {
  const current = getZonedDateParts(date);
  const yesterdayDate = shiftDateKey(current.date, -1);
  const tomorrowDate = shiftDateKey(current.date, 1);

  return {
    currentDate: current.date,
    currentTime: current.time,
    isDue: current.time >= SUGGESTION_TIME_OF_DAY,
    suggestionTime: SUGGESTION_TIME_OF_DAY,
    todayEnd: getMoscowDayStartUtc(tomorrowDate),
    todayStart: getMoscowDayStartUtc(current.date),
    timezone: DEFAULT_TIMEZONE,
    yesterdayDate,
    yesterdayStart: getMoscowDayStartUtc(yesterdayDate),
  };
}

async function getUsersForReminderSuggestion(date = new Date()) {
  const dueInfo = getReminderSuggestionDueInfo(date);

  if (!dueInfo.isDue) {
    return { dueInfo, users: [] };
  }

  const [activeYesterday, activeToday] = await Promise.all([
    findActiveTelegramUserIdsInRange({
      start: dueInfo.yesterdayStart,
      end: dueInfo.todayStart,
    }),
    findActiveTelegramUserIdsInRange({
      start: dueInfo.todayStart,
      end: dueInfo.todayEnd,
    }),
  ]);
  const activeTodaySet = new Set(activeToday.map((telegramUserId) => String(telegramUserId)));
  const inactiveToday = activeYesterday.filter((telegramUserId) => {
    return !activeTodaySet.has(String(telegramUserId));
  });
  const users = await findReminderSuggestionCandidates({
    telegramUserIds: inactiveToday,
  });

  return { dueInfo, users };
}

function buildReminderSuggestionMessage() {
  return [
    'Похоже, вчера вы пользовались ботом, а сегодня еще ничего не внесли.',
    '',
    'Чтобы не забывать учет, можно включить ежедневное напоминание:',
    '/reminder 20:00',
    '',
    'Время можно выбрать любое, например /reminder 21:30.',
  ].join('\n');
}

async function markReminderSuggestionSent(userId) {
  return markReminderSuggestionPromptSent(userId);
}

module.exports = {
  buildReminderSuggestionMessage,
  getReminderSuggestionDueInfo,
  getUsersForReminderSuggestion,
  markReminderSuggestionSent,
};
