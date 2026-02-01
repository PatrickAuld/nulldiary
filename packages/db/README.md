# Database Package

Holds schema definitions, migrations, and the database client.

## UUIDv7 Policy
- All primary/foreign keys use UUIDv7.
- Decide on application-side vs database-side UUIDv7 generation before implementing migrations.
