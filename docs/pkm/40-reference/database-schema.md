---
title: Database schema
summary: Entities, integrity rules, and the distinction between active and retained schema.
source:
  - src/lib/db/schema.ts
  - src/types/index.ts
  - src/lib/constants.ts
  - src/lib/audit.ts
  - drizzle.config.ts
  - supabase/migrations
verified: 2026-10-03
tags: [reference, database]
---

# Database schema

`src/lib/db/schema.ts` is the Drizzle model. SQL migrations also own policies, grants, functions, and auth/storage integration that the TypeScript schema alone cannot reproduce.

| Table | Purpose and key relationships |
|---|---|
| `members` | Unique Auth user ID, profile, role, active flag, presence; authorship anchor |
| `access_codes` | Unique code, status, use ceiling/count, creator/last redeemer, expiry |
| `posts` | Author, content/type/media/milestone, pin/delete flags |
| `comments` | Post and author, content, delete flag |
| `reactions` | Post/member/reaction key, unique per triple |
| `gatherings` | Creator, title/details, start/end, all-day, cancellation/archive |
| `rsvps` | Gathering/member/status/note, unique per pair |
| `channels` | Name, stable unique slug, type, archive flag, sort order |
| `messages` | Channel, author, content, soft deletion, optional self-referencing reply |
| `house_settings` | Key/value identity settings and updater |
| `audit_logs` | Actor/action/entity/timestamp plus per-action allow-listed metadata (`AUDIT_METADATA_KEYS`) for administrative history |
| `member_relationships` | Retained parent/child links; no current family-tree UI |
| `albums`, `photos` | Retained media archive structure; no current Archives UI |

## Integrity

UUIDs identify entities. Timestamps represent instants; birthdays use a date. Enums cover role, post type, RSVP, channel type, and code status. Closed text-value checks protect milestones/reaction keys. Invite counts must remain nonnegative and not exceed a ceiling. Gathering end must follow start. Reply references are self-FKs with nulling on deletion.

Unique constraints support idempotent/atomic operations, including RSVP upsert, reaction conflict handling, member Auth identity, channel slug, and access code. The feed partial index targets live posts ordered by pin and creation. Soft deletion/archival filters remain necessary in every relevant query; a schema flag does not enforce read behavior automatically.

`members.auth_user_id` references Supabase Auth through migration SQL. Deleting an Auth identity is not an account-removal workflow and can conflict with historical author references. [Recovery](../50-operations/backup-and-recovery.md) must preserve identity mappings.

## Provisioning

Use the [migration runbook](../50-operations/migration-runbook.md). `0001` is a historical snapshot, not the complete current model or a repeatable bootstrap command. Drizzle tooling never provisions RLS, browser grants, Storage policies, default chambers, or Realtime publication; there is no push script, and `drizzle.config.ts` refuses `drizzle-kit push`/`migrate` outside the disposable local test database.

Inspect live schema and constraints separately from the local files when verifying a release. No statement in this note proves a remote migration was applied.
