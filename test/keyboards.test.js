const assert = require('node:assert/strict');
const test = require('node:test');

const {
  actions,
  dailyExpensesKeyboard,
  familyStatsManageKeyboard,
} = require('../src/bot/keyboards');

function flattenButtons(keyboard) {
  return keyboard.reply_markup.inline_keyboard.flat();
}

test('familyStatsManageKeyboard includes daily expenses action', () => {
  const callbackData = flattenButtons(familyStatsManageKeyboard()).map((button) => button.callback_data);

  assert.ok(callbackData.includes('STATS_FAMILY_DAILY_EXPENSES'));
  assert.equal(actions.STATS_FAMILY_DAILY_EXPENSES, 'STATS_FAMILY_DAILY_EXPENSES');
});

test('dailyExpensesKeyboard can paginate family daily expenses', () => {
  const buttons = flattenButtons(dailyExpensesKeyboard(10, { family: true }));

  assert.equal(buttons[0].text, 'Следующие 10');
  assert.equal(buttons[0].callback_data, 'STATS_FAMILY_DAILY_EXPENSES_NEXT:10');
});
