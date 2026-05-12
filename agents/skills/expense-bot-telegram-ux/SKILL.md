---
name: expense-bot-telegram-ux
description: Telegram UX rules for the expense calculator bot: Russian UI text, concise help, command grouping, inline keyboards, cleanup behavior, confirmations, and low-friction expense/income flows. Use when changing commands, buttons, menus, callbacks, messages, onboarding, reminders, stats UX, or multi-step dialogs.
---

# Expense Bot Telegram UX

Use this skill when changing how users interact with the bot.

## UX Principles

- Keep user-facing text in Russian and short.
- Prefer one clear next action over long command lists.
- Keep `/help` compact. Detailed actions should live inside section commands with inline buttons.
- Use inline keyboards for choices and reply keyboard buttons for top-level frequent actions.
- Remove inline keyboards after callback clicks when possible so old buttons do not clutter the chat.
- Keep confirmation messages for destructive actions and irreversible operations.
- Leave useful result messages in chat, such as saved expense, saved income, export, report, or account deletion result.
- Avoid advertising voice input while API billing is not enabled, but keep transcription code and dependencies.

## Command And Menu Rules

- `/add` adds expenses.
- `/income` shows income stats.
- `/add_income` adds income.
- `/stats` shows current-month stats.
- `/prev_month` shows previous-month stats.
- `/balance` shows month balance and account summary.
- `/cancel` resets current dialog state.
- Admin diagnostics such as reminder tests must be guarded by `ADMIN_TELEGRAM_IDS`.
- Keep Telegram command suggestions in sync with `src/bot/botCommands.js`.
- Keep the Telegram menu button available after commands that send main or section menus.

## Expense Flow Rules

- Quick text like `магазин 600` may add an expense automatically only when parser/category confidence is sufficient.
- If a user sends another expense immediately after adding one, the bot may reuse the last category when that flow is active.
- After saving an expense, offer useful follow-up actions such as adding another expense in the same category or choosing another category.
- Do not encourage fake expenses for gamification. Use `/done` for days with no expenses.

## Statistics UX Rules

- Personal stats should default to the user's own data.
- Family stats should clearly say when they include family data.
- Charts should be sent as visible photos, not documents, unless a document format is specifically requested.
- Exports can remain files, but column names should be Russian.
- When lists can be long, paginate with `Следующие 10`.
- For category drilldown, show only categories that have expenses in the selected period.

## Dialog And Callback Rules

- Store multi-step state in `DialogState`.
- Reset dialog state after success, cancellation, or a flow-changing command.
- Add callback constants to `src/bot/keyboards.js`.
- Register callback handlers in the owner handler file.
- Include `ctx.answerCbQuery()` for callback actions.
- For destructive flows, use confirmation buttons and clear cancellation messages.

## Message Tone

- Be direct and calm.
- Praise regular tracking, not spending.
- Avoid wording that implies the user should spend money to maintain streaks.
- Use neutral family wording such as `другой член семьи`, not role-specific wording like `жена`.
