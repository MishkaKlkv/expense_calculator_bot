const {
  findDailyReminderByUserId,
  findEnabledDailyReminders,
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
  const hour = parts.hour === '24' ? '00' : parts.hour;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

async function setDailyReminder({ userId, timeText, timezone = DEFAULT_TIMEZONE }) {
  const timeOfDay = normalizeReminderTime(timeText);

  if (!timeOfDay) {
    return { ok: false, reason: 'INVALID_TIME' };
  }

  const { date: today, time } = getZonedDateParts(new Date(), timezone);
  const lastSentDate = timeOfDay <= time ? today : null;
  const reminder = await upsertDailyReminder({
    userId,
    timeOfDay,
    timezone,
    lastSentDate,
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
  const reminders = await findEnabledDailyReminders();

  return reminders.filter((reminder) => getReminderDueInfo(reminder, date).isDue);
}

function getReminderDueInfo(reminder, date = new Date()) {
  const { date: today, time } = getZonedDateParts(date, reminder.timezone);

  return {
    currentDate: today,
    currentTime: time,
    isDue: reminder.enabled && reminder.lastSentDate !== today && reminder.timeOfDay <= time,
    lastSentDate: reminder.lastSentDate,
    reminderTime: reminder.timeOfDay,
    timezone: reminder.timezone,
  };
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
  getReminderDueInfo,
  markReminderSentForToday,
  normalizeReminderTime,
  setDailyReminder,
};
