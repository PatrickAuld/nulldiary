# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

Always use TDD.
Always run the tests.
Keep the tests _fast_, and keep feedback loops tight.
Consider edge cases and boundary conditions in test design.
Don't duplicate tests and checks unnecessarily. Write smart tests, not only coverage.

If you wouldn't bet money on a design decision or a piece of code, ask about it.
Keep things simple, readable, clear. Longer variable names are ok when the intent requires it.

## Project Overview

Nulldiary is a system for accepting inbound messages from AI/agent clients, moderating them, and publishing approved messages to a public site. See `docs/implementation-spec.md` for the full specification.

## Build & Development Commands

This is a **pnpm monorepo** (pnpm@8.15.4).

```bash
pnpm install          # Install all workspace dependencies
pnpm format           # Check formatting (prettier)
pnpm lint             # Lint all packages (eslint)
```

### Running Tests

```bash
pnpm --filter @nulldiary/ingestion test       # Ingestion tests (46)
pnpm --filter @nulldiary/admin test           # Admin tests (30)
pnpm --filter @nulldiary/public test          # Public tests (6)

# Single test file
pnpm --filter @nulldiary/ingestion vitest run src/parse-message.test.ts

# Watch mode
pnpm --filter @nulldiary/ingestion test:watch
```

### Database (packages/db)

```bash
pnpm --filter @nulldiary/db db:generate   # Generate Drizzle migrations
pnpm --filter @nulldiary/db db:migrate    # Run migrations (tsx src/migrate.ts)
pnpm --filter @nulldiary/db db:studio     # Open Drizzle Studio
```

Requires `DATABASE_URL` environment variable (Postgres connection string).

### Local Development

```bash
pnpm dev:up           # Start Postgres (Docker) + run initial migration
pnpm dev:services     # Start admin (port 3000) + public (port 4321)
pnpm dev:seed         # Seed test messages via curl
pnpm dev:down         # Stop Postgres (preserves data)
pnpm dev:reset        # Drop and recreate DB + re-migrate
```

Local `DATABASE_URL`: `postgres://nulldiary:nulldiary@localhost:5432/nulldiary`

## Architecture

pnpm workspace with two apps and three packages:

- **`apps/public`** -- Next.js 15 SSR site (targeting Vercel). Serves approved messages and the ingestion endpoint (`/s/*`).
- **`apps/admin`** -- Next.js 15 admin moderation UI (targeting Vercel). Auth via Supabase; bypass with `SUPABASE_AUTH_BYPASS=true` for local dev.
- **`packages/db`** -- Drizzle ORM schema, postgres.js client factory, and migration runner.
- **`packages/ingestion`** -- Pure-logic ingestion service: request parsing and normalization. No HTTP framework coupling.
- **`packages/shared`** -- Placeholder for shared types/Zod schemas (currently empty).

### Workspace Dependency Graph

```
apps/admin     → @nulldiary/db
apps/public    → @nulldiary/db, @nulldiary/ingestion
packages/ingestion → @nulldiary/db
packages/db    → (no internal deps)
```

### Database

- **Driver**: `postgres` (postgres.js) -- works natively on Cloudflare Workers with `nodejs_compat`. Client configured with `max: 1` and `prepare: false` for Supabase transaction pooler (port 6543).
- **Schema**: `packages/db/src/schema.ts` -- three tables (`messages`, `ingestion_events`, `moderation_actions`), three enums.
- **UUIDv7**: Application-side generation via `uuidv7` package. Generated before insert, not DB defaults.
- **Migrations**: SQL files in `packages/db/migrations/`, run programmatically via `drizzle-orm/postgres-js/migrator` in `packages/db/src/migrate.ts`.

### Ingestion Pipeline

The ingestion endpoint (`/s/*` in `apps/public/src/app/s/[...path]/route.ts`) accepts all HTTP verbs. Flow:

1. `extractRequest(Request)` → `RawRequest` (normalize URL, headers, body)
2. `parseMessage(RawRequest)` → `ParseResult` (extract message by priority)
3. `persistIngestion(Db, RawRequest, ParseResult)` → insert into DB

Message extraction priority (first non-empty match wins):

1. Headers: `x-message`, `x-secret`, `x-prompt`
2. Body fields (JSON/form/plaintext): `message`, `secret`, `prompt`
3. Query params: `message`, `secret`
4. Path segment after `/s/`

On success: inserts into `messages` first (UUIDv7 id), then `ingestion_events` with FK. On parse failure: inserts only `ingestion_events` for audit.

### Admin Moderation

- **Data layer** in `apps/admin/src/data/`: `queries.ts` (list/get) and `actions.ts` (approve/deny).
- **Moderation actions** are transactional: select-for-update, validate pending status, update message, insert audit row, commit.
- **API routes** at `apps/admin/src/app/api/`.
- **DB singleton**: `apps/admin/src/lib/db.ts` exports `getDb()` that lazily creates client from `DATABASE_URL`.

### Deployment

- **Deployment**: Vercel (target). Configure two Vercel projects for `apps/public` and `apps/admin`.

## Testing Patterns

All packages use **Vitest**. Config in `vitest.config.ts` per package. Tests co-located with source (`src/**/*.test.ts`).

### Fake DB Builders (not mocks)

Tests avoid mocking Drizzle internals. Instead, they build lightweight fake DB objects that track method call chains:

```ts
function makeFakeDb(resultRows: unknown[] = []) {
  const calls: Array<{ method: string; args?: unknown }> = [];
  // Returns chainable object with .from(), .where(), .orderBy(), etc.
  // .then() resolves with resultRows (makes it awaitable)
}
```

For transactional actions, fakes implement `db.transaction(fn)` by passing themselves as the tx context.

### Factory Functions

Test data built via `makeMessage(overrides)`, `makeEvent(overrides)` patterns -- inline per test file.

### Module Mocks (ingestion)

`vi.hoisted()` + `vi.mock()` for isolating persistence and UUID generation in unit tests.
