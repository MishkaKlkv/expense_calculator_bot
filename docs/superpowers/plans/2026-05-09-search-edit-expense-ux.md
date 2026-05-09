# Search Edit Expense UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the misleading product-category shortcut after expense creation and make `/search` results directly editable.

**Architecture:** Keep the existing expense edit flow as the single editing path. Add a search-results keyboard that emits the existing `EDIT_EXPENSE_SELECT:<id>` callback, and simplify the after-expense keyboard by removing the special `Это продукты` row.

**Tech Stack:** CommonJS Node.js, Telegraf inline keyboards, existing handler/service/repository structure, Prisma-backed expense data.

---

## File Structure

- Modify `src/bot/keyboards.js`
  - Remove the special `Это продукты` shortcut from `afterExpenseKeyboard`.
  - Add `searchResultsKeyboard(expenses)` that returns buttons pointing to `EDIT_EXPENSE_SELECT:<id>`.
  - Export `searchResultsKeyboard`.
- Modify `src/bot/handlers/search.handler.js`
  - Import `searchResultsKeyboard`.
  - Reply with the keyboard when search results exist.
  - Keep the no-results response without a keyboard.
- No Prisma schema changes.
- No new files.

## Task 1: Simplify Post-Save Expense Keyboard

**Files:**
- Modify: `src/bot/keyboards.js`

- [ ] **Step 1: Edit `afterExpenseKeyboard`**

Replace the current `afterExpenseKeyboard` implementation in `src/bot/keyboards.js` with:

```js
function afterExpenseKeyboard(category, transactionId) {
  return Markup.inlineKeyboard([
    ...quickEditRows(transactionId),
    ...(transactionId
      ? [[Markup.button.callback('Другая категория', `QUICK_EDIT_CATEGORY:${transactionId}`)]]
      : []),
    [Markup.button.callback(`Добавить еще в ${category}`, `${actions.REPEAT_CATEGORY}:${category}`)],
    [Markup.button.callback('Добавить в другую категорию', actions.CHANGE_EXPENSE_CATEGORY)],
    [Markup.button.callback('Главное меню', 'SHOW_MENU')],
  ]);
}
```

- [ ] **Step 2: Verify imports still load**

Run:

```bash
node -e "require('./src/bot/keyboards'); console.log('keyboards ok')"
```

Expected output:

```text
keyboards ok
```

## Task 2: Add Search Results Keyboard

**Files:**
- Modify: `src/bot/keyboards.js`

- [ ] **Step 1: Add a small label helper**

Add this helper near `getUserButtonName` in `src/bot/keyboards.js`:

```js
function truncateButtonText(value, maxLength = 48) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}
```

- [ ] **Step 2: Add `searchResultsKeyboard`**

Add this function near `editExpenseListKeyboard` in `src/bot/keyboards.js`:

```js
function searchResultsKeyboard(expenses) {
  const rows = expenses.map((expense, index) => {
    const label = truncateButtonText(`${index + 1}. ${expense.category} - ${expense.description}`);

    return [Markup.button.callback(label, `EDIT_EXPENSE_SELECT:${expense.id}`)];
  });

  rows.push([Markup.button.callback('Отмена', actions.CANCEL)]);

  return Markup.inlineKeyboard(rows);
}
```

- [ ] **Step 3: Export the new keyboard**

Add `searchResultsKeyboard` to `module.exports` in `src/bot/keyboards.js`.

- [ ] **Step 4: Verify keyboard module loads**

Run:

```bash
node -e "const { searchResultsKeyboard } = require('./src/bot/keyboards'); if (typeof searchResultsKeyboard !== 'function') process.exit(1); console.log('search keyboard ok')"
```

Expected output:

```text
search keyboard ok
```

## Task 3: Attach Keyboard to `/search`

**Files:**
- Modify: `src/bot/handlers/search.handler.js`

- [ ] **Step 1: Import the keyboard**

Change the first lines of `src/bot/handlers/search.handler.js` to include:

```js
const { searchResultsKeyboard } = require('../keyboards');
```

- [ ] **Step 2: Reply with keyboard when matches exist**

Replace the final reply in `handleSearchCommand`:

```js
await ctx.reply(formatSearchResults(expenses, query));
```

with:

```js
await ctx.reply(
  formatSearchResults(expenses, query),
  expenses.length > 0 ? searchResultsKeyboard(expenses) : undefined
);
```

- [ ] **Step 3: Verify handler imports**

Run:

```bash
node -e "require('./src/bot/handlers/search.handler'); require('./src/bot/handlers/editExpense.handler'); console.log('search/edit handlers ok')"
```

Expected output:

```text
search/edit handlers ok
```

## Task 4: Full Verification

**Files:**
- Verify: `src/bot/keyboards.js`
- Verify: `src/bot/handlers/search.handler.js`
- Verify: `src/bot/handlers/editExpense.handler.js`

- [ ] **Step 1: Run import smoke check**

Run:

```bash
node -e "require('./src/bot/keyboards'); require('./src/bot/handlers/search.handler'); require('./src/bot/handlers/editExpense.handler'); require('./src/bot/registerBot'); console.log('imports ok')"
```

Expected output:

```text
imports ok
```

- [ ] **Step 2: Run whitespace check**

Run:

```bash
git diff --check
```

Expected output: no output and exit code 0.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git diff -- src/bot/keyboards.js src/bot/handlers/search.handler.js
```

Expected:

- `Это продукты` no longer appears in `afterExpenseKeyboard`.
- `searchResultsKeyboard` is exported.
- `/search` uses `searchResultsKeyboard(expenses)` only when results exist.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/bot/keyboards.js src/bot/handlers/search.handler.js
git commit -m "Improve search edit UX"
```

Expected: commit succeeds with only the implementation files staged.

## Manual QA

- Save a new expense and confirm the post-save keyboard does not contain `Это продукты`.
- Confirm `Другая категория` still opens the category picker for the saved expense.
- Run `/search <known expense text>` and confirm result buttons are shown.
- Tap a result button and confirm the existing edit menu opens.
- From the edit menu, update amount, description, and category to confirm existing edit flows still work.

## Self-Review

- Spec coverage: both approved requirements are covered by Tasks 1-3.
- Scope: no changes to automatic category inference and no changes to last-category behavior.
- No schema changes or migrations are required.
- No placeholders remain.
