const {
  findDailyReminderByUserId,
  findDueDailyReminders,
  markDailyReminderSent,
  setDailyReminderEnabled,
  upsertDailyReminder,
} = require('../repositories/reminder.repository');

const DEFAULT_TIMEZONE = 'Europe/Moscow';

function normalizeReminderTime(value) {
  const input = value.trim();
  const match = input.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/u);

  if (!match) {
    return null;
  }

  const hours = match[1].padStart(2, '0');
  const minutes = match[2];

  return `${hours}:${minutes}`;
}

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

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

async function setDailyReminder({ userId, timeText, timezone = DEFAULT_TIMEZONE }) {
  const timeOfDay = normalizeReminderTime(timeText);

  if (!timeOfDay) {
    return { ok: false, reason: 'INVALID_TIME' };
  }

  const reminder = await upsertDailyReminder({
    userId,
    timeOfDay,
    timezone,
  });

  return { ok: true, reminder };
}

async function getDailyReminder(userId) {
  return findDailyReminderByUserId(userId);
}

async function disableDailyReminder(userId) {
  const result = await setDailyReminderEnabled({ userId, enabled: false });

  return { ok: result.count === 1 };
}

async function enableDailyReminder(userId) {
  const result = await setDailyReminderEnabled({ userId, enabled: true });

  return { ok: result.count === 1 };
}

async function getDueDailyReminders(date = new Date()) {
  const { time } = getZonedDateParts(date, DEFAULT_TIMEZONE);
  const reminders = await findDueDailyReminders({ timeOfDay: time });

  return reminders.filter((reminder) => {
    const { date: today } = getZonedDateParts(date, reminder.timezone);

    return reminder.lastSentDate !== today;
  });
}

async function markReminderSentForToday(reminder, date = new Date()) {
  const { date: today } = getZonedDateParts(date, reminder.timezone);

  return markDailyReminderSent({ id: reminder.id, sentDate: today });
}

module.exports = {
  DEFAULT_TIMEZONE,
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminder,
  getDueDailyReminders,
  markReminderSentForToday,
  normalizeReminderTime,
  setDailyReminder,
};
