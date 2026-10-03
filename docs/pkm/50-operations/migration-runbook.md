---
title: Migration runbook
summary: Safe schema provisioning, upgrade sequencing, and security verification.
source:
  - src/lib/db/schema.ts
  - drizzle.config.ts
  - supabase/migrations/0001_initial_schema.sql
  - supabase/migrations/0002_lock_down_data_api.sql
  - supabase/migrations/0003_milestones.sql
  - supabase/migrations/0004_integrity.sql
  - supabase/migrations
verified: 2026-10-03
tags: [runbook, database]
---

# Migration runbook

A checked-in SQL file is not evidence that any database has run it. Inspect the target and take a recoverable backup before changing an existing House. Capture migration outcome without logging private rows or credentials.

## Inventory

| File | Purpose | Execution caveat |
|---|---|---|
| `0001_initial_schema.sql` | Historical initial tables/enums and early policies | Plain CREATE statements; not idempotent; incomplete compared with current schema |
| `0002_lock_down_data_api.sql` | RLS/grant lockdown, guarded Auth FK, default chambers | Historical baseline; later hardening repairs policy behavior |
| `0003_milestones.sql` | Milestone column support | Follow current schema and migration order |
| `0004_integrity.sql` | Backfills, not-null/check integrity, reply FK, feed index | Existing rows may require remediation; inspect failure rather than force constraints |
| `20261003175118_security_and_private_media.sql` | Completes missing baseline tables; private-schema helpers and message RLS; private media buckets/policies; URL normalization; Realtime | Deploy matching media route when changing live media access; preserve backup and verify policy behavior |

List actual files with `rg --files supabase/migrations`. Never infer a complete current schema from `0001`.

## Fresh empty project

For an empty database, apply the complete migration chain in filename order: `0001`, `0002`, `0003`, `0004`, then `20261003175118_security_and_private_media.sql`. The final migration supplies tables/columns previously created only by Drizzle, private bucket policies, and Realtime publication. Do **not** run `db:push` first on this path.

For a project whose tables were already created through Drizzle, do not replay `0001`; reconcile actual schema and apply the required `0002` onward. `0002` includes the guarded Auth user FK and default chamber inserts. The repository E2E harness starts a dedicated local Supabase instance using this migration history; follow [testing strategy](testing-strategy.md) rather than combining bootstrap procedures.

## Existing House

1. Confirm the target project and current table/policy/constraint state.
2. Take a backup and check its manifest and auth-identity scope; see [recovery](backup-and-recovery.md).
3. Review unapplied additive SQL, its expected lock/transaction behavior, and failure recovery. Apply backfills before constraints. In particular, `0004` must repair older nullable/invalid rows before a schema push tries to enforce its newer constraints.
4. Apply only the required, reviewed migrations in sequence. Stop on errors. Do not use `db:push` as a migration runner for a live project.
5. Verify constraints, all-table RLS, effective grants, helper-function execution rights, Storage policy, and realtime behavior. Record both success and residual requirements in release evidence.

Never erase rows, drop/recreate the public schema, relax RLS, or bypass constraints to make an upgrade look green. A code push does not apply remote SQL.

## Security verification

Inspect catalog metadata for RLS on every application table, grants to `anon`/`authenticated`, policies, function exposure, Storage bucket privacy, and Realtime publication. Then use actual browser-facing roles to verify:

- Anonymous and authenticated non-members cannot read/write family tables.
- Active members can obtain only approved byline columns and permitted live messages.
- Guests cannot perform member writes; non-Elders cannot read private chamber messages.
- Deactivation removes subsequent data/media access.
- Storage uploads are constrained to the caller's permitted paths and valid types/sizes.

The 2026-10-03 audit found the configured live project's lockdown had not been applied. After a private backup, migrations were applied and catalog checks confirmed RLS on every application table, zero client write grants, and private House buckets. Consult [backend audit](../../audits/2026-10-03/backend-security.md) for the evidence and [verification](../../audits/2026-10-03/verification.md) for the separate app deployment state. Future environments still require their own checks.
