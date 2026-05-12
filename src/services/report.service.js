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
const { getUsdToRubRate } = require('./exchangeRate.service');
const {
  formatDateTime,
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
const ALL_CATEGORIES_BAR_COLORS = ['#2f80ed', '#27ae60', '#f2994a', '#eb5757', '#9b51e0'];
const CATEGORY_EXPENSES_PAGE_SIZE = 10;

function normalizeUserScope(scope) {
  if (typeof scope === 'object' && scope !== null) {
    return {
      userId: scope.userId,
      userIds: scope.userIds,
    };
  }

  return { userId: scope };
}

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

async function getTodayStats(scope) {
  return getCategoryStatsForRange({ ...normalizeUserScope(scope), range: getTodayRange() });
}

async function getWeekStats(scope) {
  return getCategoryStatsForRange({ ...normalizeUserScope(scope), range: getCurrentWeekRange() });
}

async function getMonthComparison(scope) {
  const userScope = normalizeUserScope(scope);
  const current = await getCategoryStatsForRange({
    ...userScope,
    range: getCurrentMonthRange(),
  });
  const previous = await getCategoryStatsForRange({
    ...userScope,
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

async function getTopMonthExpenses(scope, limit = 5) {
  const range = getCurrentMonthRange();
  return findTopExpenses({ ...normalizeUserScope(scope), start: range.start, end: range.end, limit });
}

async function getCurrentMonthExpenseCategories(scope) {
  const rows = await getCategoryStatsForRange({
    ...normalizeUserScope(scope),
    range: getCurrentMonthRange(),
  });
  const categories = Array.from(new Set(rows.map((row) => row.category)));

  return categories.sort((left, right) => left.localeCompare(right, 'ru'));
}

async function getCurrentMonthExpensesByCategory(scope, category, options = {}) {
  const range = getCurrentMonthRange();
  const limit = options.limit || CATEGORY_EXPENSES_PAGE_SIZE;
  const offset = options.offset || 0;

  return findExpensesInRange({
    ...normalizeUserScope(scope),
    start: range.start,
    end: range.end,
    category,
    limit,
    offset,
  });
}

async function getFamilySpendingByUser({ userIds, start, end }) {
  return aggregateExpensesByUser({ userIds, start, end });
}

function buildExportRows(expenses) {
  return expenses.map((expense) => ({
    date: formatDateTime(expense.expenseDate),
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
            return `"${String(row[key] ?? '').replace(/"/g, '""')}"`;
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

function truncateChartText(value, maxLength = 26) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

async function buildRubCategoryRows(rows) {
  const hasUsd = rows.some((row) => row.currency === 'USD');
  let usdRate = null;
  let skippedCurrency = false;

  if (hasUsd) {
    try {
      usdRate = await getUsdToRubRate();
    } catch (error) {
      console.error('[report:all-categories-chart] failed to fetch USD rate', error);
      skippedCurrency = true;
    }
  }

  const totals = new Map();

  rows.forEach((row) => {
    const amount = getNetAmount(row);
    let rubAmount = amount;

    if (row.currency === 'USD') {
      if (!usdRate) {
        return;
      }

      rubAmount = amount * usdRate.value;
    } else if (row.currency !== 'RUB') {
      skippedCurrency = true;
      return;
    }

    totals.set(row.category, (totals.get(row.category) || 0) + rubAmount);
  });

  const chartRows = Array.from(totals.entries())
    .map(([category, value]) => ({ category, value }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
  const notes = [];

  if (usdRate) {
    notes.push(
      `USD пересчитан по курсу ${formatChartAmount(usdRate.value)}${usdRate.date ? ` (${usdRate.date}, ${usdRate.source})` : ''}`
    );
  } else if (skippedCurrency || hasUsd) {
    notes.push('Часть валютных расходов не учтена: не удалось получить курс USD.');
  }

  return { chartRows, notes };
}

function buildAllCategoriesChartSvgContent(rows, options = {}) {
  const { notes = [], title = 'Все категории за месяц' } = options;
  const width = 1100;
  const rowHeight = 56;
  const topOffset = 160;
  const bottomOffset = notes.length > 0 ? 92 : 48;
  const height = Math.max(520, topOffset + rows.length * rowHeight + bottomOffset);
  const labelX = 60;
  const barX = 330;
  const barMaxWidth = 490;
  const amountX = 850;
  const maxValue = rows.length > 0 ? Math.max(...rows.map((row) => row.value)) : 0;
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (rows.length === 0) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${CHART_FONT_FAMILY}">`,
      '<rect width="100%" height="100%" fill="#ffffff" />',
      `<text x="60" y="82" font-size="36" font-weight="700" fill="#111">${escapeXml(title)}</text>`,
      '<text x="60" y="140" font-size="24" fill="#555">Нет расходов за текущий месяц</text>',
      '</svg>',
    ].join('\n');
  }

  const rowElements = rows
    .map((row, index) => {
      const y = topOffset + index * rowHeight;
      const barWidth = Math.max(6, (row.value / maxValue) * barMaxWidth);
      const percent = total > 0 ? (row.value / total) * 100 : 0;
      const color = ALL_CATEGORIES_BAR_COLORS[index % ALL_CATEGORIES_BAR_COLORS.length];

      return [
        `<text x="${labelX}" y="${y + 24}" font-size="22" font-weight="700" fill="#111">${escapeXml(truncateChartText(row.category))}</text>`,
        `<rect x="${barX}" y="${y + 2}" width="${barWidth.toFixed(1)}" height="28" rx="6" fill="${color}" />`,
        `<text x="${amountX}" y="${y + 24}" font-size="21" fill="#111">${escapeXml(formatChartAmount(row.value))} · ${formatChartPercent(percent)}</text>`,
      ].join('\n');
    })
    .join('\n');
  const noteElements = notes
    .map((note, index) => {
      return `<text x="60" y="${height - 42 + index * 26}" font-size="18" fill="#666">${escapeXml(note)}</text>`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${CHART_FONT_FAMILY}">`,
    '<rect width="100%" height="100%" fill="#ffffff" />',
    `<text x="60" y="82" font-size="36" font-weight="700" fill="#111">${escapeXml(title)}</text>`,
    '<text x="60" y="122" font-size="21" fill="#555">Все категории, RUB</text>',
    rowElements,
    `<text x="60" y="${height - 16}" font-size="21" font-weight="700" fill="#111">Итого: ${escapeXml(formatChartAmount(total))}</text>`,
    noteElements,
    '</svg>',
  ].join('\n');
}

async function buildMonthChartPng(scope, options = {}) {
  const rows = await getCategoryStatsForRange({
    ...normalizeUserScope(scope),
    range: getCurrentMonthRange(),
  });
  const { chartRows, notes } = await buildRubCategoryRows(rows);
  const svg = buildAllCategoriesChartSvgContent(chartRows, {
    notes,
    title: options.title,
  });
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expense-all-categories-'));
  const filePath = path.join(tempDir, `all-categories-${Date.now()}.png`);

  await sharp(Buffer.from(svg)).png().toFile(filePath);

  return { filePath, tempDir };
}

module.exports = {
  CATEGORY_EXPENSES_PAGE_SIZE,
  buildMonthChartPng,
  exportMonthExpenses,
  getCurrentMonthExpenseCategories,
  getCurrentMonthExpensesByCategory,
  getFamilySpendingByUser,
  getMonthComparison,
  getTodayStats,
  getTopMonthExpenses,
  getWeekStats,
};
