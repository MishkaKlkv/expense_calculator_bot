function getCurrentMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  return { start, end };
}

function getPreviousMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  return { start, end };
}

function getTodayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

  return { start, end };
}

function getCurrentWeekRange(now = new Date()) {
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);

  return { start, end };
}

function getPreviousWeekRange(now = new Date()) {
  const currentWeek = getCurrentWeekRange(now);
  const start = new Date(currentWeek.start);
  start.setDate(start.getDate() - 7);

  return { start, end: currentWeek.start };
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

module.exports = {
  formatDateTime,
  getCurrentMonthRange,
  getCurrentWeekRange,
  getPreviousMonthRange,
  getPreviousWeekRange,
  getTodayRange,
};
