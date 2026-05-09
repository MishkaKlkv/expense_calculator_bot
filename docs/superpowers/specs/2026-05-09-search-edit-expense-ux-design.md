# Search Edit Expense UX Design

## Context

The bot already supports expense creation, quick post-save editing, deletion, category correction, and `/search` for finding expenses by description or category. The current post-save keyboard includes a special `Это продукты` category-fix button, which is confusing after the user manually saved an expense in a specific category.

## Goals

- Remove the misleading `Это продукты` button after saving an expense.
- Keep the existing manual expense flow and "remember last category" behavior unchanged.
- Let users edit expenses found through `/search` without re-running `/edit` separately.
- Reuse the existing transaction edit flow instead of adding another editing mechanism.

## Non-Goals

- Do not change automatic category inference behavior.
- Do not change the "save next message to the last expense category" behavior.
- Do not add bulk editing, search pagination, or delete buttons to search results in this iteration.

## User Experience

After saving an expense, the bot should still show quick action buttons, but no longer show `Это продукты`. The post-save keyboard should keep:

- `Изм. сумму`
- `Изм. описание`
- `Удалить`
- `Другая категория`
- `Добавить еще в <категория>`
- `Добавить в другую категорию`
- `Главное меню`

When a user runs `/search вкусвилл`, the bot should show the current text result list and add inline buttons for the found expenses. Each button should identify the expense by list number and short category/description text. Pressing a search result button should open the existing edit menu for that operation with `Категория`, `Описание`, `Сумма`, and `Отмена`.

## Architecture

The implementation should stay within existing boundaries:

- `src/bot/keyboards.js`: remove the special `Это продукты` button and add a reusable search-results keyboard.
- `src/bot/handlers/search.handler.js`: include the search-results keyboard when matches exist.
- `src/bot/handlers/editExpense.handler.js`: reuse the existing `EDIT_EXPENSE_SELECT:<id>` action. If needed, extract the current select-action body into a helper so search and edit flows share the same presentation.

No Prisma schema changes are required.

## Error Handling

- If a search result button references an operation that no longer exists or is not owned by the user, show the existing "not found or no rights" message.
- If `/search` finds no rows, keep the current plain text response with no keyboard.
- If Telegram cannot remove old inline keyboards, keep the existing middleware behavior and ignore the cleanup failure.

## Verification

Run:

```bash
node -e "require('./src/bot/keyboards'); require('./src/bot/handlers/search.handler'); require('./src/bot/handlers/editExpense.handler'); console.log('imports ok')"
git diff --check
```

Manual checks:

- Save an expense and confirm `Это продукты` is absent.
- Run `/search <known text>`, press a found expense button, and confirm the edit menu opens.
- Press `Категория`, `Описание`, and `Сумма` from that edit menu and confirm the existing edit flow still works.
