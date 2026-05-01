# AGENTS.MD

## Project Overview

This is a CommonJS Node.js Telegram bot for personal and family expense tracking. It uses Telegraf for Telegram polling, Prisma for PostgreSQL access, and Docker Compose for local or server deployment.

The current Prisma model is named `Expense`, but it stores transaction-like rows. Use the `type` field to distinguish `EXPENSE` and `INCOME`. Do not mix income into expense reports unless the task explicitly asks for combined transaction views.

## Repository Layout

- `src/index.js` creates the Telegraf bot, registers handlers, and handles shutdown.
- `src/bot/registerBot.js` wires all bot handlers.
- `src/bot/handlers/` contains command, text, callback, report, family, edit, delete, and stats flows.
- `src/bot/keyboards.js` defines inline and reply keyboards plus callback action constants.
- `src/services/` contains business logic: parsing, expense/income creation, reports, stats, family accounts, dialog state, and transcription.
- `src/repositories/` isolates Prisma queries.
- `src/constants/` contains categories and currency aliases.
- `prisma/schema.prisma` and `prisma/migrations/` define the database schema.

## Important Behavior

- The bot stores per-user state in `DialogState`; always reset state after a flow completes or is canceled.
- Expense reports, recent expenses, edit, and delete flows should keep filtering by `type: 'EXPENSE'`.
- Bulk expense cleanup commands must delete only `type: 'EXPENSE'`; income rows must remain intact.
- Cashback is tracked as regular income in the `Кешбек` income category, not as a per-expense field in user-facing flows.
- Income rows should be saved with `type: 'INCOME'` and `cashback: '0'`.
- `/add` adds expenses.
- `/profile`, `/streak`, and `/done` are gamification commands. `/done` marks today or yesterday as honestly tracked with no expenses; do not encourage fake transactions.
- Gamification state is stored in `user_gamification`, `tracked_days`, and `user_achievements`; transaction days are awarded from the expense/income save flow.
- `/stats` shows current-month expense and income stats by category.
- `/prev_month` shows previous-month expense and income stats by category.
- `/balance` shows current-month income minus expenses by currency, plus RUB totals using the current USD/RUB rate.
- Accounts are stored in `accounts`; `AVAILABLE` means spendable money and `SAVINGS` means savings/investments/emergency money.
- `/accounts`, `/account_add`, `/account_set`, and `/account_delete` manage user accounts.
- USD conversion is fetched in `src/services/exchangeRate.service.js` from the Bank of Russia XML daily endpoint and cached in memory.
- `/income` should show income stats for the current month.
- `/add_income` adds income.
- `/weekly_report` shows the previous-week report; `src/services/weeklyReportScheduler.service.js` sends it every Monday at 10:00 `Europe/Moscow`.
- Planned monthly payments are stored in `planned_payments` and managed by `/planned`, `/planned_add`, and `/planned_delete`.
- Planned payment reminders are opt-in per payment and sent by `src/services/plannedPaymentReminderScheduler.service.js` on the payment day at 10:00 `Europe/Moscow`.
- `/cancel` resets the current dialog state.
- `/reminder HH:MM` configures a persisted daily expense-entry reminder; `/reminder_off` disables it and `/reminder_on` re-enables it.
- Reminder times are stored as `HH:MM` in `Europe/Moscow` by default and delivered by `src/services/reminderScheduler.service.js`.
- `/reminder_test`, `/reminder_check`, and `/reminder_run` are admin-only diagnostics guarded by `ADMIN_TELEGRAM_IDS`.
- Usage events are stored in `bot_events`; `/admin_stats` is restricted to Telegram IDs from `ADMIN_TELEGRAM_IDS`.
- Family account owners can rename the account with `/family_rename` and remove members from the `/family` owner controls.
- User categories are stored in `user_categories`; defaults come from `src/constants/categories.js` and are created lazily for users that do not have categories yet.
- Telegram slash-command suggestions and the default commands menu button are configured in `src/bot/botCommands.js`.
- Keep `/help` short; detailed actions for reminders, planned payments, accounts, and categories should live in inline keyboards inside their section commands.
- Inline keyboards are removed after callback clicks by middleware in `src/bot/registerBot.js`.
- Voice transcription code and dependencies may remain in the project, but user-facing help text should not advertise voice input unless API billing is intentionally enabled again.

## Development Commands

Install dependencies:

```bash
npm install
```

Run PostgreSQL locally with Docker:

```bash
docker compose up -d postgres
```

Apply migrations in development:

```bash
npm run prisma:migrate -- --name <migration_name>
```

Run the bot in development:

```bash
npm run dev
```

Run the production start command:

```bash
npm start
```

Run the full Docker Compose stack:

```bash
docker compose up -d --build
```

Check app logs:

```bash
docker compose logs -f app
```

## Verification

There is no dedicated test script in `package.json` yet. For small code changes, at minimum run import and whitespace checks:

```bash
node -e "require('./src/bot/keyboards'); require('./src/bot/handlers/menu.handler'); require('./src/bot/handlers/expense.handler'); require('./src/bot/handlers/stats.handler'); console.log('imports ok')"
git diff --check
```

When changing Prisma schema or database behavior, also run the relevant Prisma migration command and verify the app can connect to PostgreSQL.

## Docker And Database Notes

`docker-compose.yml` sets the app container `DATABASE_URL` to:

```text
postgresql://postgres:postgres@postgres:5432/telegram_expenses?schema=public
```

PostgreSQL should be published on localhost only:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

Do not expose Postgres as `5432:5432` on a public server unless the user explicitly asks for remote database access and firewall rules are configured.

If the app logs Prisma `P1000` authentication errors while containers are running, the existing Postgres volume may have a password that differs from the current environment variables. Prefer fixing the database user password instead of deleting the volume:

```bash
docker exec -it expense-calculator-bot-postgres psql -U postgres -d telegram_expenses -c "ALTER USER postgres WITH PASSWORD 'postgres';"
docker restart expense-calculator-bot-app
```

Do not run `docker compose down -v` unless the user explicitly accepts losing the local/server database volume.

## Coding Guidelines

- Follow the existing CommonJS style with `require` and `module.exports`.
- Keep Telegram UI text in Russian unless the surrounding text is already English or the user asks otherwise.
- Prefer repository functions for Prisma access instead of querying Prisma directly from handlers.
- Keep handlers thin: parse user intent and call services for business logic.
- Use existing helpers such as `formatMoney`, date range utilities, parser functions, and keyboard builders.
- Keep changes scoped; do not rename the `Expense` model or `expenses` table unless the task explicitly calls for a migration.
- Avoid adding broad abstractions unless they remove real duplication across expense and income flows.
- Do not remove OpenAI transcription dependencies or service code unless explicitly requested.

## Deployment Reminder

If the user writes exactly `deploy`, treat it as a deployment command and do all of the following:

1. Commit and push current git changes if there are any. Do not include intentionally local/untracked files unless the user explicitly asks to track them.
2. Connect to the production server over SSH:

```bash
ssh root@45.150.188.212
```

3. Run the already configured server-side deploy command:

```bash
deploy-bot
```

The server-side `deploy-bot` command is expected to run `git pull` and then rebuild/restart the Docker stack.

After pushing code to the server, rebuild the app container so new source files are included:

```bash
git pull origin master
docker compose up -d --build app
docker logs --tail=100 -f expense-calculator-bot-app
```
