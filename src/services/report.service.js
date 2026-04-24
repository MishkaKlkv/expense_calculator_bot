const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  aggregateExpensesByCategory,
  aggregateExpensesByUser,
  findExpensesInRange,
  findTopExpenses,
} = require('../repositories/expense.repository');
const {
  getCurrentMonthRange,
  getCurrentWeekRange,
  getPreviousMonthRange,
  getTodayRange,
} = require('../utils/date');

function getNetAmount(row) {
  return Number(row._sum.amount || 0) - Number(row._sum.cashback || 0);
}

async function getCategoryStatsForRange({ userId, userIds, range }) {
  return aggregateExpensesByCategory({
    userId,
    userIds,
    start: range.start,
    end: range.end,
  });
}

async function getTodayStats(userId) {
  return getCategoryStatsForRange({ userId, range: getTodayRange() });
}

async function getWeekStats(userId) {
  return getCategoryStatsForRange({ userId, range: getCurrentWeekRange() });
}

async function getMonthComparison(userId) {
  const current = await getCategoryStatsForRange({
    userId,
    range: getCurrentMonthRange(),
  });
  const previous = await getCategoryStatsForRange({
    userId,
    range: getPreviousMonthRange(),
  });
  const map = new Map();

  for (const row of previous) {
    map.set(`${row.category}:${row.currency}`, {
      category: row.category,
      currency: row.currency,
      current: 0,
      previous: getNetAmount(row),
    });
  }

  for (const row of current) {
    const key = `${row.category}:${row.currency}`;
    const existing = map.get(key) || {
      category: row.category,
      currency: row.currency,
      current: 0,
      previous: 0,
    };

    existing.current = getNetAmount(row);
    map.set(key, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.current - a.current);
}

async function getTopMonthExpenses(userId, limit = 5) {
  const range = getCurrentMonthRange();
  return findTopExpenses({ userId, start: range.start, end: range.end, limit });
}

async function getFamilySpendingByUser({ userIds, start, end }) {
  return aggregateExpensesByUser({ userIds, start, end });
}

function buildExportRows(expenses) {
  return expenses.map((expense) => ({
    date: expense.expenseDate,
    user: expense.user?.firstName || expense.user?.username || String(expense.telegramUserId),
    category: expense.category,
    description: expense.description,
    amount: Number(expense.amount),
    cashback: Number(expense.cashback || 0),
    net_amount: Number(expense.amount) - Number(expense.cashback || 0),
    currency: expense.currency,
  }));
}

async function exportMonthExpenses({ userId, userIds, format = 'csv' }) {
  const range = getCurrentMonthRange();
  const expenses = await findExpensesInRange({
    userId,
    userIds,
    start: range.start,
    end: range.end,
  });
  const rows = buildExportRows(expenses);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expense-export-'));
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';
  const filePath = path.join(tempDir, `expenses-${Date.now()}.${extension}`);

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');

    sheet.columns = [
      { header: 'date', key: 'date', width: 24 },
      { header: 'user', key: 'user', width: 20 },
      { header: 'category', key: 'category', width: 18 },
      { header: 'description', key: 'description', width: 32 },
      { header: 'amount', key: 'amount', width: 12 },
      { header: 'cashback', key: 'cashback', width: 12 },
      { header: 'net_amount', key: 'net_amount', width: 14 },
      { header: 'currency', key: 'currency', width: 10 },
    ];
    sheet.addRows(rows);
    await workbook.xlsx.writeFile(filePath);
  } else {
    const headers = ['date', 'user', 'category', 'description', 'amount', 'cashback', 'net_amount', 'currency'];
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] instanceof Date ? row[header].toISOString() : row[header];
            return `"${String(value ?? '').replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const csv = csvRows.join('\n');

    await fs.promises.writeFile(filePath, csv);
  }

  return { filePath, tempDir, rowsCount: rows.length };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function buildMonthChartSvg(userId) {
  const rows = await getCategoryStatsForRange({
    userId,
    range: getCurrentMonthRange(),
  });
  const rubRows = rows
    .filter((row) => row.currency === 'RUB')
    .map((row) => ({
      category: row.category,
      value: getNetAmount(row),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const max = Math.max(...rubRows.map((row) => row.value), 1);
  const width = 900;
  const rowHeight = 56;
  const height = 120 + rubRows.length * rowHeight;
  const bars = rubRows
    .map((row, index) => {
      const y = 80 + index * rowHeight;
      const barWidth = Math.round((row.value / max) * 560);

      return [
        `<text x="40" y="${y + 24}" font-size="22" fill="#222">${escapeXml(row.category)}</text>`,
        `<rect x="230" y="${y}" width="${barWidth}" height="32" fill="#2f80ed" rx="6" />`,
        `<text x="${240 + barWidth}" y="${y + 24}" font-size="20" fill="#222">${Math.round(row.value)} RUB</text>`,
      ].join('\n');
    })
    .join('\n');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    '<text x="40" y="44" font-size="28" font-weight="700" fill="#111">Расходы за месяц по категориям</text>',
    bars || '<text x="40" y="92" font-size="22" fill="#555">Нет расходов в RUB за текущий месяц</text>',
    '</svg>',
  ].join('\n');
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expense-chart-'));
  const filePath = path.join(tempDir, `chart-${Date.now()}.svg`);

  await fs.promises.writeFile(filePath, svg);

  return { filePath, tempDir };
}

module.exports = {
  buildMonthChartSvg,
  exportMonthExpenses,
  getFamilySpendingByUser,
  getMonthComparison,
  getTodayStats,
  getTopMonthExpenses,
  getWeekStats,
};
