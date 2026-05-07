const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
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

const CHART_FONT_FAMILY = 'DejaVu Sans, Arial, sans-serif';
const EXPORT_COLUMNS = [
  { header: 'Дата', key: 'date', width: 24 },
  { header: 'Пользователь', key: 'user', width: 20 },
  { header: 'Категория', key: 'category', width: 18 },
  { header: 'Описание', key: 'description', width: 32 },
  { header: 'Сумма', key: 'amount', width: 12 },
  { header: 'Валюта', key: 'currency', width: 10 },
];

function getNetAmount(row) {
  return Number(row._sum.amount || 0);
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
    const sheet = workbook.addWorksheet('Расходы');

    sheet.columns = EXPORT_COLUMNS;
    sheet.addRows(rows);
    await workbook.xlsx.writeFile(filePath);
  } else {
    const keys = EXPORT_COLUMNS.map((column) => column.key);
    const csvRows = [
      EXPORT_COLUMNS.map((column) => column.header).join(','),
      ...rows.map((row) =>
        keys
          .map((key) => {
            const value = row[key] instanceof Date ? row[key].toISOString() : row[key];
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

function formatChartAmount(value) {
  return `${new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} ₽`;
}

function formatChartPercent(value) {
  return `${new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: value < 10 ? 1 : 0,
  }).format(value)}%`;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describePieSlice({ centerX, centerY, radius, startAngle, endAngle }) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function groupChartRows(rows) {
  const visibleRows = rows.slice(0, 7);
  const otherRows = rows.slice(7);
  const otherValue = otherRows.reduce((sum, row) => sum + row.value, 0);

  if (otherValue <= 0) {
    return visibleRows;
  }

  return [...visibleRows, { category: 'Другое', value: otherValue }];
}

function buildMonthChartSvgContent(rows) {
  const chartRows = groupChartRows(rows);
  const total = chartRows.reduce((sum, row) => sum + row.value, 0);
  const colors = [
    '#2f80ed',
    '#27ae60',
    '#f2994a',
    '#eb5757',
    '#9b51e0',
    '#00a6a6',
    '#f2c94c',
    '#6fcf97',
  ];
  const width = 1100;
  const height = 720;
  const centerX = 330;
  const centerY = 380;
  const radius = 230;

  if (chartRows.length === 0) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${CHART_FONT_FAMILY}">`,
      '<rect width="100%" height="100%" fill="#ffffff" />',
      '<text x="60" y="82" font-size="36" font-weight="700" fill="#111">Расходы за месяц</text>',
      '<text x="60" y="140" font-size="24" fill="#555">Нет расходов в RUB за текущий месяц</text>',
      '</svg>',
    ].join('\n');
  }

  let currentAngle = 0;
  const slices = chartRows
    .map((row, index) => {
      const sliceAngle = (row.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = index === chartRows.length - 1 ? 360 : currentAngle + sliceAngle;
      currentAngle = endAngle;

      if (chartRows.length === 1) {
        return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${colors[index]}" />`;
      }

      return `<path d="${describePieSlice({
        centerX,
        centerY,
        endAngle,
        radius,
        startAngle,
      })}" fill="${colors[index]}" stroke="#ffffff" stroke-width="4" />`;
    })
    .join('\n');

  const legend = chartRows
    .map((row, index) => {
      const y = 190 + index * 58;
      const percent = (row.value / total) * 100;

      return [
        `<rect x="650" y="${y - 22}" width="28" height="28" rx="6" fill="${colors[index]}" />`,
        `<text x="696" y="${y}" font-size="24" font-weight="700" fill="#111">${escapeXml(row.category)}</text>`,
        `<text x="696" y="${y + 30}" font-size="20" fill="#555">${escapeXml(formatChartAmount(row.value))} · ${formatChartPercent(percent)}</text>`,
      ].join('\n');
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${CHART_FONT_FAMILY}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    '<text x="60" y="82" font-size="36" font-weight="700" fill="#111">Расходы за месяц</text>',
    '<text x="60" y="122" font-size="21" fill="#555">По категориям, RUB</text>',
    slices,
    `<circle cx="${centerX}" cy="${centerY}" r="96" fill="#ffffff" />`,
    `<text x="${centerX}" y="${centerY - 8}" font-size="24" text-anchor="middle" fill="#555">Итого</text>`,
    `<text x="${centerX}" y="${centerY + 34}" font-size="30" font-weight="700" text-anchor="middle" fill="#111">${escapeXml(formatChartAmount(total))}</text>`,
    legend,
    '</svg>',
  ].join('\n');
}

async function buildMonthChartPng(userId) {
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
    .sort((a, b) => b.value - a.value);
  const svg = buildMonthChartSvgContent(rubRows);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expense-chart-'));
  const filePath = path.join(tempDir, `chart-${Date.now()}.png`);

  await sharp(Buffer.from(svg)).png().toFile(filePath);

  return { filePath, tempDir };
}

module.exports = {
  buildMonthChartPng,
  exportMonthExpenses,
  getFamilySpendingByUser,
  getMonthComparison,
  getTodayStats,
  getTopMonthExpenses,
  getWeekStats,
};
