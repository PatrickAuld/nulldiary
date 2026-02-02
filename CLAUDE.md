# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

Always use TDD.
Always runt the tests.
Keep the tests _fast_, and keep feedback loops tight.
Consider edge cases and boundry conditions in tests design.
Don't duplicate tests and checks unnecessarly. Write smart tests, not only coverage.

If you wouldn't bet money on a design decision or a code, ask about it.
Keep things simple, readable, clear. Longer variable names are ok when the intent requires it.

## Project Overview

Aipromptsecret is a system for accepting inbound messages from AI/agent clients, moderating them, and publishing approved messages to a public static site. See `docs/implementation-spec.md` for the full specification and implementation checklist.

## Build & Development Commands

This is a **pnpm monorepo** (pnpm@8.15.4).

```bash
pnpm install          # Install all workspace dependencies
pnpm format           # Check formatting (prettier)
pnpm lint             # Lint all packages (eslint)
```

### Database (packages/db)

```bash
pnpm --filter @aipromptsecret/db db:generate   # Generate Drizzle migrations
pnpm --filter @aipromptsecret/db db:migrate    # Run Drizzle migrations
pnpm --filter @aipromptsecret/db db:studio     # Open Drizzle Studio
```

Requires `DATABASE_URL` environment variable (Postgres connection string).

## Architecture

pnpm workspace with two apps and three packages:

- **`apps/admin`** -- Admin moderation UI (Next.js + Astro planned)
- **`apps/public`** -- Public static site (Next.js + Astro planned)
- **`packages/db`** -- Postgres schema (Drizzle ORM), migrations, and DB client
- **`packages/shared`** -- Shared types, Zod validation schemas, and utilities
- **`packages/ingestion`** -- Ingestion service: request parsing and normalization

### Key Design Decisions

- **UUIDv7** for all primary and foreign keys (application-side vs DB-side generation TBD -- see `packages/db/README.md`)
- **Drizzle ORM** with Drizzle Kit for schema and migrations; schema defined in `packages/db/src/schema.ts`, config in `packages/db/drizzle.config.ts`, migrations output to `packages/db/migrations/`
- **TypeScript strict mode**, target ES2022, Bundler module resolution (see `tsconfig.base.json`)
- Three main DB tables: `ingestion_events` (raw requests), `messages` (normalized, moderatable), `moderation_actions` (audit trail)

### Ingestion Pipeline

The ingestion endpoint (`/s/*`) accepts all HTTP verbs and extracts messages from multiple sources in priority order:
1. Headers (`x-message`, `x-secret`, `x-prompt`)
2. Body JSON fields (`message`, `secret`, `prompt`)
3. Query parameter (`message` or `secret`)
4. Path segment after `/s/`
