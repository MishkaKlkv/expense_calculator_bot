---
name: expense-bot-build-and-quality
description: Expense calculator bot build, verification, Prisma migration, Docker, and deployment workflow. Use when validating code changes, preparing commits, changing database behavior, debugging server deployment, or checking regressions.
---

# Expense Bot Build And Quality

Use this skill to verify changes consistently before handoff, commit, or deploy.

## Local Commands

Run commands from repository root.

- Install dependencies: `npm install`
- Run bot in development: `npm run dev`
- Run production command locally: `npm start`
- Generate Prisma client: `npm run prisma:generate`
- Create/apply development migration: `npm run prisma:migrate -- --name <migration_name>`
- Apply production migrations: `npm run prisma:migrate:deploy`
- Run PostgreSQL locally: `docker compose up -d postgres`
- Run full stack locally: `docker compose up -d --build`
- Watch app logs: `docker compose logs -f app`

## Minimum Verification

For small code changes, run:

```bash
node -e "require('./src/bot/keyboards'); require('./src/bot/handlers/menu.handler'); require('./src/bot/handlers/expense.handler'); require('./src/bot/handlers/stats.handler'); console.log('imports ok')"
git diff --check
```

For changes touching reports, exports, charts, reminders, categories, or repositories, add the directly affected modules to the import smoke command.

## Prisma And Database Changes

Use this workflow when changing `prisma/schema.prisma` or database behavior:

1. Add or update the Prisma model.
2. Create a migration with `npm run prisma:migrate -- --name <migration_name>`.
3. Inspect generated SQL before finalizing.
4. Run `npm run prisma:generate` if the generated client may be stale.
5. Verify imports and at least one service path that uses the changed model.

Do not delete Docker volumes or run `docker compose down -v` unless the user explicitly accepts losing data.

## Docker And Server Checks

The app container runs:

```bash
npm run prisma:migrate:deploy && npm start
```

PostgreSQL must only be published on localhost:

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

If Prisma logs `P1000` authentication errors while containers are running, the existing Postgres volume may have an old password. Prefer fixing the database user password instead of deleting the volume.

## Deployment Workflow

If the user writes exactly `deploy`, follow the deployment rule in `AGENTS.MD`:

1. Commit and push current git changes if there are any.
2. Do not include intentionally local/untracked files unless explicitly requested.
3. SSH to `root@45.150.188.212`.
4. Run `deploy-bot` on the server.

## Finalization Checklist

- Imports pass.
- `git diff --check` passes.
- Prisma migrations are present for schema changes.
- New callbacks/actions are registered and have keyboard constants.
- Personal and family scopes were considered where relevant.
- Local-only draft files remain untracked unless explicitly requested.

