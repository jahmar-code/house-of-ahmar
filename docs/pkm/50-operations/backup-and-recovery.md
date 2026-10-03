---
title: Backup and recovery
summary: What the backup captures, what it omits, and how to plan a valid restore.
source:
  - scripts/backup.mjs
  - src/lib/db/schema.ts
  - supabase/migrations/0002_lock_down_data_api.sql
  - .gitignore
verified: 2026-10-03
tags: [runbook, recovery]
---

# Backup and recovery

The family history spans Postgres rows, Auth identities, and Storage objects. A usable recovery plan accounts for all three and their stable identifiers.

## Backup contract

```bash
npm run backup
npm run backup -- --out /private/backup-location
npm run backup -- --db-only
```

The script reads `.env.local`, runs `pg_dump` of the **public schema** without owner/privilege statements, and normally downloads configured media buckets. Each run creates a new timestamped directory with a unique suffix containing `database.sql`, Storage files, and a manifest. Even runs started within the same second cannot overwrite an earlier backup or inherit its completion manifest. It requires a compatible `pg_dump` client; Storage download also requires the operational service-role key. The configured bucket set is `feed-media`, `archives`, and `avatars`, including retained historical media. Review that list and the actual object inventory if another bucket is introduced.

`--db-only` intentionally omits photos and must never be called a complete family-media backup. A failed or interrupted script may leave partial output; a directory's existence is not proof of completion. The script creates owner-only output, keeps the database password out of process arguments, and rejects Storage object paths escaping their bucket directory. Keep backups untracked and copied to another private location. `MANIFEST.txt` is written only after all requested work succeeds.

Take a fresh backup before migrations or other bulk changes. Choose a routine backup frequency that matches acceptable family data loss, and periodically prove a restore in an isolated environment. Neither scheduling nor a restore drill is claimed as executed by this document.

## Critical Auth omission

The dump does **not** include `auth.users`. `members.auth_user_id` references those identities. Signing up again in a new project generates different IDs and does not automatically reconnect historical members. The application does not provide a general account-relinking tool.

For a same-project recovery, establish that matching Auth users still exist before restoring public data. For a fresh-project disaster recovery, use a verified identity-preserving platform recovery procedure or a deliberately reviewed identity-mapping migration. Do not disable the Auth FK or tell relatives to create duplicate memberships as a shortcut. Without an Auth recovery plan, this script is a public-data/media backup, not a complete cross-project disaster recovery solution.

## Restore procedure

1. Isolate the target and establish its Auth identity state. Preserve any current data needed for rollback.
2. Inspect the dump and rehearse with fail-on-error behavior on a disposable target; do not paste a restore into a populated live database blindly.
3. Restore/reconcile public data while preserving member IDs and Auth linkage.
4. Restore Storage objects at their expected bucket paths, preserving media references. Legacy public URLs may need the current private-media migration/compatibility logic.
5. Apply the current grant/RLS/integrity migrations and verify their effects; the dump omits grants and should not be treated as a security configuration backup.
6. Re-establish Realtime, Storage policies, Auth URLs/email templates, and application environment.
7. Verify member/Elder login, invitation behavior, representative posts/images, private chamber access, message send/reconnect, and an RSVP. Count restored rows/objects without exposing their content.
8. Record the restore environment, backup timestamp, checks, discrepancies, and the proven recovery duration before reopening the House.

A restore drill is complete only when representative identities and media work, not when `psql` exits successfully. See [release](release-runbook.md) for the shared smoke checklist.
