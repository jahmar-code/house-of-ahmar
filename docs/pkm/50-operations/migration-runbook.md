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
  - supabase/migrations/20261003175118_security_and_private_media.sql
  - supabase/migrations/20261003200000_operation_aware_media.sql
  - supabase/migrations
  - package.json
  - tests/integration/storage-media.mjs
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
| `20261003200000_operation_aware_media.sql` | Operation-aware restrictive Storage guards: downloads/info and direct uploads only; no client signing, listing, rendering, TUS or S3 on House buckets | Aborts unless the target's Storage provides `storage.allow_any_operation`/`allow_only_operation`; does not revoke already issued signed URLs |

List actual files with `rg --files supabase/migrations`. Never infer a complete current schema from `0001`.

## Fresh empty project

For an empty database, apply the complete migration chain in filename order: `0001`, `0002`, `0003`, `0004`, `20261003175118_security_and_private_media.sql`, then `20261003200000_operation_aware_media.sql`. `20261003175118` supplies tables/columns previously created only by Drizzle, private bucket policies, and Realtime publication; `20261003200000` restricts which Storage operations those policies admit. Do **not** run Drizzle's push first on this path. A target provisioned this way is also the only supported [restore](backup-and-recovery.md) destination.

For a project whose tables were already created through Drizzle, do not replay `0001`; reconcile actual schema and apply the required `0002` onward. `0002` includes the guarded Auth user FK and default chamber inserts. The repository E2E harness starts a dedicated local Supabase instance using this migration history; follow [testing strategy](testing-strategy.md) rather than combining bootstrap procedures.

## Existing House

1. Confirm the target project and current table/policy/constraint state.
2. Take a backup and check its manifest and auth-identity scope; see [recovery](backup-and-recovery.md).
3. Review unapplied additive SQL, its expected lock/transaction behavior, and failure recovery. Apply backfills before constraints. In particular, `0004` backfills older nullable/invalid rows before it adds its constraints; inspect a failure rather than forcing the constraint.
4. Apply only the required, reviewed migrations in sequence. Stop on errors. Drizzle is never a migration runner here (see below).
5. Verify constraints, all-table RLS, effective grants, helper-function execution rights, Storage policy, and realtime behavior. Record both success and residual requirements in release evidence.

Never erase rows, drop/recreate the public schema, relax RLS, or bypass constraints to make an upgrade look green. A code push does not apply remote SQL.

### Operation-aware media rollout (`20261003200000`)

For an existing House, apply it after a fresh backup and after confirming on the target that `storage.allow_any_operation(text[])` and `storage.allow_only_operation(text)` exist; the migration raises and rolls back without them, so a missing helper means upgrading Storage first, not editing the migration. It is additive: object names, stored media references, and the media route are unchanged, and it sets a five-second `lock_timeout`. Afterwards verify that members, guests, and Elders still see photos through the app, that `archives` stays Elder-only, and that a client session's `createSignedUrl`/`createSignedUrls` and signed-upload calls fail. Applying it does **not** revoke signed URLs minted earlier: count client sign requests in the Storage logs since the buckets went private and, if any exist, re-key the affected objects (the [follow-up resolution](../../audits/2026-10-03-follow-up/resolution.md#ds-01-already-issued-signed-urls) has the plan). On the live House it was applied on 2026-10-04 while Storage held no House objects at all, so no earlier URL could serve family media. Do not rotate keys, delete objects, or rewrite media references as an improvised fix.

## Drizzle tooling

There is no `db:push` script. `npm run db:generate` writes Drizzle's proposed SQL to `./drizzle` for inspection only. Nothing applies from that folder: turn reviewed statements into a new timestamped migration with any RLS, grants, and backfills. `drizzle.config.ts` throws for `drizzle-kit push`, `migrate`, `drop`, and `up` unless `DATABASE_URL` is a loopback host on the disposable test port 55322. `npm run db:studio` opens the configured database for reading **and** writing. Older migration headers that mention `drizzle-kit push` or `supabase db push` describe historical bootstrap advice, not a supported route to an existing House.

## Security verification

Inspect catalog metadata for RLS on every application table, grants to `anon`/`authenticated`, policies, function exposure, Storage bucket privacy, and Realtime publication. Then use actual browser-facing roles to verify:

- Anonymous and authenticated non-members cannot read/write family tables.
- Active members can obtain only approved byline columns and permitted live messages.
- Guests cannot perform member writes; non-Elders cannot read private chamber messages.
- Deactivation removes subsequent data/media access.
- Storage uploads are constrained to the caller's permitted paths and valid types/sizes.
- Client sessions cannot sign, batch-sign, list, or create signed upload URLs for House objects, including with a synthetic legacy permissive policy present.

On the disposable stack, `npm run test:db` runs these checks through SQL and the real Storage API, and `node tests/integration/database-security.mjs --reapply` replays `20261003175118` then `20261003200000` over existing data to rehearse the upgrade path.

The 2026-10-03 audit found the configured live project's lockdown had not been applied. After a private backup, migrations were applied and catalog checks confirmed RLS on every application table, zero client write grants, and private House buckets. Consult [backend audit](../../audits/2026-10-03/backend-security.md) for the evidence and [verification](../../audits/2026-10-03/verification.md) for the separate app deployment state. Future environments still require their own checks.
