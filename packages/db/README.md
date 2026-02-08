# Database Package

Holds schema definitions, migrations, and the database client.

## Migration Tooling

- **Drizzle Kit** is the standard migration tool for this repo.
- Configuration lives in `packages/db/drizzle.config.ts`.
- Migrations are generated into `packages/db/migrations`.

## UUIDv7 Policy

- All primary/foreign keys use UUIDv7.
- UUIDv7 values are generated in the application layer and passed into inserts.

## Local Development

- Start Postgres with `docker compose up -d` from the repo root.
- Example connection string:
  - `postgres://nulldiary:nulldiary@localhost:5432/nulldiary`
