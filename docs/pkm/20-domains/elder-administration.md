---
title: Elder administration
summary: House care, permissions, auditability, and recoverable administration.
source:
  - src/app/actions/admin.ts
  - src/app/actions/members.ts
  - src/app/actions/council.ts
  - src/app/actions/settings.ts
  - src/lib/settings.ts
  - src/lib/audit.ts
  - src/lib/audit-summary.ts
  - src/app/(house)/elder-council
  - supabase/operations/redact-audit-secrets.sql
verified: 2026-10-03
tags: [admin, audit]
---

# Elder administration

Elder Council is the House's administrative area. Every page and mutation enforces Elder access; navigation visibility is not the permission boundary.

| Surface | Responsibility | Recovery expectation |
|---|---|---|
| Overview | Summaries and links to administrative tasks | Counts reflect current state |
| Access Codes | Create, copy/share manually, inspect, revoke invitations | An invalid/expired code can be replaced; no automatic outbound messaging |
| Members | Change role, deactivate/reactivate | Keep at least one active Elder; never erase historical authorship |
| Chambers | Create, rename, archive, reopen | Reopening restores access to preserved history |
| Settings | House name, tagline, welcome, cover image | Save as one coherent identity update |
| Audit Log | View recent administrative events | Human-readable labels and bounded results; no invite codes or removed content |

House identity is stored as key/value rows. `getHouseSettings` supplies defaults for absent/unrecognized values; `updateHouseSettings` writes the set transactionally and invalidates the root layout and its descendants. This refreshes public sign-in, signup, and recovery monograms even when their pages were prerendered, as well as private navigation, the gate, and the Great Hall. The default welcome is intentionally inclusive. Public House identity must never expose private member content or a private cover photo unintentionally.

## Audit behavior

`AUDIT_ACTION_LABELS` is the shared action vocabulary. Logs include role/activation, invites, chamber management, settings, moderation of another person's content, and gathering cancellation/restoration/archive. Routine self-removal is intentionally not treated as administrative surveillance.

Each action's metadata is typed (`AuditMetadataByAction`) and filtered at runtime by `auditMetadata` against `AUDIT_METADATA_KEYS`: only listed keys with primitive values survive, text is cut at 200 characters, and lists at 20 items. The trail keeps who, which entity, and non-secret state. Invites keep their label, use limit and expiry days but never the code; Elder removals keep the author plus the chamber (messages) or post (comments) ID, and a post removal records `hadText` and `photoCount`; none keeps the removed words. Adding a key is a privacy decision, not a refactor.

`logAudit` catches write failures and reports only the action name, so the user operation can succeed even if its audit insert fails. The log is therefore a best-effort accountability aid, not an immutable or transactionally complete ledger.

The Audit Log page loads the latest 200 entries with only the actor's byline columns and renders each through `summarizeAuditEntry`. It reads named fields only, so an invite appears by label or a short entity reference, and codes or previews in rows written before the allow-list never reach the page. Those historical keys remain in `audit_logs` until an operator, after a verified backup and the owner's approval, runs `supabase/operations/redact-audit-secrets.sql`. That script is not a migration: it is a dry run by default, commits only with `-v apply=true`, prints counts only, and removes just `code` from invite events and `preview` from Elder removals. It was applied to the live House on 2026-10-04 after a backup (one invite code removed, every event kept); see the [follow-up resolution](../../audits/2026-10-03-follow-up/resolution.md). Backups taken earlier still hold the old keys.

## Verify

Visit each page as member and guest using its direct URL; invoke mutations with unauthorized IDs/roles; attempt last-Elder removal including concurrency (`concurrency.database.test.ts` races it on real PostgreSQL); verify counts after actions; confirm the Audit Log shows no invite code or removed text; check copied invitation wording and manual fallback if clipboard permission fails; confirm destructive dialogs name the target and allow cancellation. See [release runbook](../50-operations/release-runbook.md) for production checks.
