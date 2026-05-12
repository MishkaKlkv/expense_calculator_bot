---
name: expense-bot-architecture
description: Expense calculator bot architecture, module boundaries, Prisma data ownership, and cross-feature change workflow. Use when planning or implementing changes that touch handlers, services, repositories, Prisma models, schedulers, family accounts, categories, stats, or gamification.
---

# Expense Bot Architecture

Use this skill to place changes in the right layer and keep bot behavior consistent.

## Module Map

- `src/index.js`: process entrypoint, bot startup, scheduler startup, shutdown handling.
- `src/bot/registerBot.js`: handler registration and shared Telegraf middleware.
- `src/bot/handlers/`: Telegram commands, messages, callback flows, and thin UI orchestration.
- `src/bot/keyboards.js`: inline/reply keyboards and callback action constants.
- `src/bot/botCommands.js`: Telegram slash-command suggestions and menu button setup.
- `src/services/`: business logic, parsing, reports, reminders, gamification, accounts, and schedulers.
- `src/repositories/`: Prisma query wrappers. Prefer adding query helpers here over querying Prisma directly from handlers.
- `src/constants/`: default categories, currencies, and shared static values.
- `src/utils/`: formatting and date helpers.
- `prisma/schema.prisma`: database models.
- `prisma/migrations/`: database migrations that must match schema changes.

## Boundary Rules

- Keep handlers thin: parse Telegram intent, load user/context, call services, reply to the user.
- Keep business rules in `src/services/`.
- Keep database access in `src/repositories/` unless an existing local pattern clearly uses a service-level Prisma call.
- Keep callback action names in `src/bot/keyboards.js`; avoid scattering raw callback strings across handlers.
- Keep Telegram UI text in Russian unless the surrounding text is already English.
- Keep date/time behavior explicit. User-facing bot schedules default to `Europe/Moscow`.
- Do not rename the Prisma `Expense` model or `expenses` table unless the task explicitly asks for a migration.

## Transaction Model Rules

The Prisma model `Expense` stores both expenses and incomes:

- Expense rows use `type: 'EXPENSE'`.
- Income rows use `type: 'INCOME'`.
- Expense reports, recent expenses, edit/delete expense flows, and cleanup flows must keep filtering by `type: 'EXPENSE'`.
- Income reports and income editing must keep filtering by `type: 'INCOME'`.
- Cashback is user-facing income in the `Кешбек` income category, not a per-expense field in current flows.

## Feature Ownership

- Expenses and quick parsing: `expense.handler.js`, `expense.service.js`, `parser.service.js`, `autoCategory.service.js`.
- Income: `income.service.js` plus income branches in handlers and keyboards.
- Stats/reports/export/charts: `stats.handler.js`, `report.handler.js`, `stats.service.js`, `report.service.js`.
- Family account behavior: `family.handler.js`, `family.service.js`, `family.repository.js`.
- Categories: `category.handler.js`, `category.service.js`, `category.repository.js`.
- Reminders and scheduled messages: `reminder*.service.js`, `plannedPaymentReminderScheduler.service.js`, `weeklyReportScheduler.service.js`.
- Gamification: `gamification.handler.js`, `gamification.service.js`, `gamification.repository.js`.
- Account deletion: `deleteAccount.handler.js`, `deleteAccount.service.js`.

## Cross-Feature Workflow

When a task is ambiguous:

1. Identify the user entrypoint: command, reply keyboard label, inline callback, scheduled job, or text parser.
2. Trace the flow from handler to service to repository.
3. Change the owner service/repository first, then adapt handlers and keyboards.
4. Preserve personal vs family scope intentionally. Use `userId` for personal views and `userIds` for family views.
5. Reset `DialogState` after completed, canceled, or interrupted multi-step flows.
6. Update `AGENTS.MD` or skill files if the task changes architecture or workflow rules.

