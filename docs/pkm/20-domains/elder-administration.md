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
  - src/app/(house)/elder-council
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
| Audit Log | View recent administrative events | Human-readable labels and bounded results |

House identity is stored as key/value rows. `getHouseSettings` supplies defaults for absent/unrecognized values; `updateHouseSettings` writes the set transactionally and invalidates the root layout and its descendants. This refreshes public sign-in, signup, and recovery monograms even when their pages were prerendered, as well as private navigation, the gate, and the Great Hall. The default welcome is intentionally inclusive. Public House identity must never expose private member content or a private cover photo unintentionally.

## Audit behavior

`AUDIT_ACTION_LABELS` is the shared action vocabulary. Logs include role/activation, invites, chamber management, settings, moderation of another person's content, and gathering cancellation/restoration/archive. Routine self-removal is intentionally not treated as administrative surveillance.

`logAudit` catches write failures, so the user operation can succeed even if its audit insert fails. The log is therefore a best-effort accountability aid, not an immutable or transactionally complete ledger. Diagnostic logs must avoid private content when reporting such failures.

## Verify

Visit each page as member and guest using its direct URL; invoke mutations with unauthorized IDs/roles; attempt last-Elder removal including concurrency; verify counts after actions; check copied invitation wording and manual fallback if clipboard permission fails; confirm destructive dialogs name the target and allow cancellation. See [release runbook](../50-operations/release-runbook.md) for production checks.
