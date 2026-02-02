# Database Package

Holds schema definitions, migrations, and the database client.

## Migration Tooling
- **Drizzle Kit** is the standard migration tool for this repo.
- Configuration lives in `packages/db/drizzle.config.ts`.
- Migrations are generated into `packages/db/migrations`.

## UUIDv7 Policy
- All primary/foreign keys use UUIDv7.
- Decide on application-side vs database-side UUIDv7 generation before implementing migrations.
