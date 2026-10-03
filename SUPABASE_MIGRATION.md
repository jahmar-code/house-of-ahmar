# Supabase migration and setup

The app uses Supabase Auth with cookie sessions, Postgres through Drizzle, Realtime for Council updates, and Storage for family images. Clerk is no longer an application dependency. This file is retained as an entry point for older links; it is not an executable migration recipe.

- [Current auth architecture](docs/pkm/10-architecture/auth-and-security.md)
- [Environment contract](docs/pkm/40-reference/environment-variables.md)
- [Fresh setup](docs/pkm/50-operations/local-setup.md)
- [Migration inventory and ordering](docs/pkm/50-operations/migration-runbook.md)
- [Recovery and auth identity caveats](docs/pkm/50-operations/backup-and-recovery.md)

`0001_initial_schema.sql` is a legacy snapshot with plain `CREATE TYPE` and `CREATE TABLE` statements. It is **not idempotent** and must not be replayed over tables created by Drizzle. Schema creation alone does not establish Data API grants, RLS, Realtime, Storage policies, or Auth URL configuration. A restored `public` schema alone also does not restore Supabase Auth identities.

Historical Clerk-to-Supabase implementation details are in this file's Git history. Do not copy old drop/rebuild instructions into a live House.
