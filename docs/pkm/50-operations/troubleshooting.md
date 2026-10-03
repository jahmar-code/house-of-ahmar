---
title: Troubleshooting
summary: Diagnose family access, stale content, media, realtime, and setup failures.
source:
  - src/lib/auth.ts
  - src/lib/env.ts
  - src/app/initiation/page.tsx
  - src/app/actions/onboarding.ts
  - src/components/council/realtime-message-list.tsx
  - src/app/api/media/[bucket]/[...path]/route.ts
  - scripts/check-messages.mjs
  - scripts/e2e-prepare.mjs
verified: 2026-10-03
tags: [runbook, support]
---

# Troubleshooting

Begin with the actual symptom, role, route, timestamp, and environment. Gather the smallest useful evidence without copying family messages, photos, passwords, invite codes, or session cookies into a report.

| Symptom | Checks and recovery |
|---|---|
| Named environment error | Compare variable names with `.env.example`; restart after server-env changes and rebuild after public-env changes |
| Account exists but cannot enter | Verify email confirmation and active database membership separately; Auth signup does not grant a House place |
| Paused-access screen | Ask an existing Elder to reactivate the member; do not create another membership |
| Code rejected | Check status, expiry, remaining uses, and exact normalized input; issue a replacement invite through Elder Council |
| Empty House cannot create first Elder | Set bootstrap code only on the deliberately empty target; never clear existing members to make bootstrap work |
| Recovery email points elsewhere | Verify app site origin, Auth redirect allow-list, and email template callback; test confirmation and password recovery independently |
| Photo missing | Inspect authenticated `/api/media` response and safe bucket/path; verify bucket policy and migration compatibility; do not make the bucket public as a fix |
| Council says offline | Inspect subscription status, Realtime publication, member/session state, and policy helper grants; verify send/refresh behavior separately |
| Mutation succeeded but screen is stale | Check server invalidation and caller refresh/reconciliation; compare current database state before repeating a write |
| Schema/migration error | Identify the last applied migration and violating constraint; stop and reconcile safely using the migration runbook |
| Unit tests pass but browser suite fails to start | Check Node 24, Docker/local Supabase, ports, browser binaries, generated E2E env, and completed production test build |
| Local uploads or realtime break after a Supabase CLI upgrade | Older service containers may remain attached to a newer database schema. Re-run the documented E2E preparation to recreate the disposable `house-of-ahmar` stack and volumes, then rebuild the test app; this removes all local fixtures |

## Access incident

If anonymous or non-member access is observed, preserve the narrow evidence and prioritize closing that access. Inspect effective grants, RLS, exposed helper functions, Storage policies, and the corresponding application checks. Avoid downloading private content merely to demonstrate a leak. Follow [migration safety](migration-runbook.md) and document the actual target-state correction in the dated security audit.

## Release regression

Identify the deployed revision and whether database/configuration changed with it. A code-only regression can often use a compatible previous app revision; a database/media-contract change needs a coordinated forward fix or tested rollback. Follow [release runbook](release-runbook.md). A database restore is a last-resort recovery procedure, not a routine way to undo a UI change.

## Escalation record

Provide reproducible steps, role, expected/actual result, sanitized error, affected revision/environment, and checks already performed. State whether content remains available and whether others are affected. Avoid unsupported root-cause claims and record a regression test once the issue is repaired.
