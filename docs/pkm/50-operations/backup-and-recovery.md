---
title: Backup and recovery
summary: The identity-preserving backup, the fresh-target restore contract, and what the rehearsal does and does not prove.
source:
  - scripts/backup.mjs
  - scripts/restore.mjs
  - scripts/restore-rehearsal.mjs
  - scripts/local-stack.mjs
  - src/lib/db/schema.ts
  - supabase/migrations
  - supabase/migrations/20261003200000_operation_aware_media.sql
  - package.json
  - .github/workflows/ci.yml
  - .gitignore
verified: 2026-10-03
tags: [runbook, recovery]
---

# Backup and recovery

The family history spans Postgres rows, Auth identities, and Storage objects. A recovery accounts for all three and keeps their identifiers: `members.auth_user_id` must still name the same Auth user, and stored media references must still resolve to the same object paths.

## Backup contract

```bash
npm run backup                                  # reads .env.local
npm run backup -- --out /private/backup-location
npm run backup -- --env <file>                  # explicit environment file instead of .env.local
npm run backup -- --db-only                     # NOT a complete family backup
```

`scripts/backup.mjs` is read-only against Supabase. It opens one `repeatable read read only` transaction, exports its snapshot, and runs every `pg_dump` and row count from that same snapshot, so the files and counts agree. Exporting a snapshot needs the direct or session connection string; a transaction-mode pooler fails and the script aborts. `pg_dump` must be at least as new as the server.

Each run writes a new owner-only directory, `<timestamp>-<random suffix>`, containing:

| File | Contents |
|---|---|
| `auth.sql` | Data-only `auth.users` and `auth.identities` rows with original IDs and password hashes; the most sensitive file |
| `public-data.sql` | Data-only dump of every `public` table |
| `schema-reference.sql` | `public` and `private` schema for inspection or diffing; **never** restored |
| `storage/<bucket>/…` | Every object in `feed-media`, `archives`, and `avatars` (skipped by `--db-only`) |
| `manifest.json` | Format `house-of-ahmar-backup/2`, row counts per table and for both Auth tables, each object's path, content type, size and SHA-256, the migration file list, `pg_dump` version and Git revision |
| `MANIFEST.txt` | Written last; its presence means every requested step finished |

The archive deliberately holds data, not schema: RLS policies depend on the `private` helper schema, Storage policies, and grants, which come only from the versioned migrations. An explicit `--env` file replaces the loaded configuration rather than mixing with `.env.local`. The database password reaches `pg_dump` through `PGPASSWORD`, not process arguments, and object paths that would escape their bucket directory are rejected. Storage download needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; without them the script exits after the database files instead of writing a manifest. A directory without `MANIFEST.txt` is incomplete.

Not captured: Auth sessions, refresh tokens and other Auth tables, so relatives sign in again after a restore; project configuration such as Auth URLs, email templates and SMTP; deployment environment variables. Keep `backups/` untracked (it is in `.gitignore`), keep copies private, and encrypt any off-device copy. Take a fresh backup before applying a migration or bulk change, and on a schedule that matches acceptable data loss. No schedule is claimed as running.

## Restore contract

Restore **only** into a fresh, isolated target that clients cannot reach yet:

1. Provision the target from `supabase/migrations` in order, following the [migration runbook](migration-runbook.md). That supplies tables, `private` helpers, RLS, grants, Storage buckets and policies, and Realtime.
2. Run, with a target-only environment file:

   ```bash
   npm run restore -- --from backups/<dir> --env <target env file> --confirm-target <db-host:port>
   ```

`scripts/restore.mjs` reads the target only from the named file and refuses before writing when:

- `--confirm-target` does not exactly match the target database `host:port`;
- the target's database or Supabase host is the one configured in `.env.local`;
- the backup lacks `MANIFEST.txt`/`manifest.json` or has another format;
- the target lacks `private.is_media_read_operation()` (not provisioned from current migrations) or a table the backup has;
- the target already has Auth users, rows other than the migration's default chambers, or objects in the House buckets.

It then runs one `psql` transaction with `ON_ERROR_STOP`: truncate the seed rows, load `auth.sql`, load `public-data.sql`, commit. Any SQL error rolls everything back. Next it uploads each object at its original path with its recorded content type (no overwrite), and finally compares table and Auth row counts, members without a matching Auth user, and every object's SHA-256 against the manifest, exiting non-zero on any difference. `psql` must be on `PATH`.

If the database load commits but a later Storage step fails, the target is no longer empty and the script will refuse to run again: recreate the target and start over rather than patching it.

Before any client connects, repeat the [security verification](migration-runbook.md#security-verification) on the target: anonymous and non-member denial, member byline-only reads, private-chamber limits, deactivated-member denial, and refusal of client URL signing. Then sign in as a representative member and Elder, open photos, send and reconnect in Council, and RSVP. Record the backup timestamp, target, checks, discrepancies, and measured duration before reopening the House.

There is no in-place or partial restore into the live House. Recovering selected rows into an existing project needs its own reviewed plan; never point the restore at production or truncate live tables.

## Rehearsal

`npm run test:restore` (`scripts/restore-rehearsal.mjs`) runs on the prepared disposable stack only. It seeds synthetic history with a photo, portrait, retained Archives object, comment, reaction, reply thread, content-free tombstone, gathering with RSVP, and audit row; backs up with the real script; destroys and recreates the stack from the migrations through `scripts/local-stack.mjs`; restores with the real script; then checks member IDs, Auth linkage and roles, the reply thread and tombstone, RLS on every table, sign-in with the original password and Auth ID, photo download through the member's own session, refused URL signing, Council reads through the Data API, closed contact columns, and anonymous denial. It finishes by rerunning `tests/integration/database-security.mjs` and `tests/integration/storage-media.mjs` against the restored target, removes its own rows and objects, and leaves the restored E2E fixtures in place. It rewrites `.env.e2e.local` if the recreated stack issues different keys. CI runs it after the browser suite, with a PostgreSQL 17 client installed to match the local server.

Not rehearsed: a restore into a hosted Supabase project, including whether the hosted `postgres` role may write `auth.users`/`auth.identities`; Auth configuration and email; live Realtime delivery on the restored target. A rehearsal pass proves the scripts against local data, not a family recovery.

## Media links issued before the operation-aware guards

Backups and restores do not change Storage signing. Applying `20261003200000_operation_aware_media.sql` stops client sessions from signing new URLs; URLs signed before it remain valid for whatever lifetime their caller chose. Restoring objects at their original paths therefore restores what such a URL can reach, which is one more reason to re-key objects whose URLs may have been issued (see the follow-up resolution). See the [media rollout notes](migration-runbook.md#operation-aware-media-rollout-20261003200000).
