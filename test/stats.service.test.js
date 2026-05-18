const assert = require('node:assert/strict');
const test = require('node:test');

function loadStatsServiceWithExpenses(expenses, calls = []) {
  const repositoryPath = require.resolve('../src/repositories/expense.repository');
  const statsServicePath = require.resolve('../src/services/stats.service');

  delete require.cache[repositoryPath];
  delete require.cache[statsServicePath];

  require.cache[repositoryPath] = {
    exports: {
      aggregateExpensesByCategory: async () => [],
      aggregateTransactionsByCategory: async () => [],
      findRecentExpenses: async () => [],
      findExpensesInRange: async (query) => {
        calls.push(query);
        return expenses;
      },
    },
  };

  return require('../src/services/stats.service');
}

test('getDailyExpenseTotals returns 10 Moscow day buckets with expense totals only', async () => {
  const calls = [];
  const { getDailyExpenseTotals } = loadStatsServiceWithExpenses(
    [
      {
        amount: '100',
        currency: 'RUB',
        expenseDate: new Date('2026-05-18T08:00:00.000Z'),
      },
      {
        amount: '250.50',
        currency: 'RUB',
        expenseDate: new Date('2026-05-17T22:30:00.000Z'),
      },
      {
        amount: '5',
        currency: 'USD',
        expenseDate: new Date('2026-05-16T09:00:00.000Z'),
      },
    ],
    calls
  );

  const rows = await getDailyExpenseTotals(42, {
    now: new Date('2026-05-18T12:00:00.000Z'),
  });

  assert.equal(rows.length, 10);
  assert.deepEqual(rows[0], {
    dateKey: '2026-05-18',
    totals: [{ amount: 350.5, currency: 'RUB' }],
  });
  assert.deepEqual(rows[2], {
    dateKey: '2026-05-16',
    totals: [{ amount: 5, currency: 'USD' }],
  });
  assert.deepEqual(rows[9], {
    dateKey: '2026-05-09',
    totals: [{ amount: 0, currency: 'RUB' }],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, 42);
  assert.equal(calls[0].start.toISOString(), '2026-05-08T21:00:00.000Z');
  assert.equal(calls[0].end.toISOString(), '2026-05-18T21:00:00.000Z');
});

test('getDailyExpenseTotals uses offset to move to older 10-day windows', async () => {
  const calls = [];
  const { getDailyExpenseTotals } = loadStatsServiceWithExpenses([], calls);

  const rows = await getDailyExpenseTotals(42, {
    now: new Date('2026-05-18T12:00:00.000Z'),
    offset: 10,
  });

  assert.equal(rows[0].dateKey, '2026-05-08');
  assert.equal(rows[9].dateKey, '2026-04-29');
  assert.equal(calls[0].start.toISOString(), '2026-04-28T21:00:00.000Z');
  assert.equal(calls[0].end.toISOString(), '2026-05-08T21:00:00.000Z');
});
