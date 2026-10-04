---
title: Known limitations
summary: Explicit product and operational gaps, separate from verified regressions.
source:
  - src/lib/db/schema.ts
  - src/lib/rate-limit.ts
  - src/lib/audit.ts
  - src/app/(house)/feed/page.tsx
  - src/app/(house)/council/[channelId]/page.tsx
  - src/app/manifest.ts
  - scripts/backup.mjs
  - scripts/restore.mjs
  - src/lib/audit-summary.ts
  - supabase/operations/redact-audit-secrets.sql
  - supabase/migrations/20261003200000_operation_aware_media.sql
verified: 2026-10-03
tags: [limits, operations]
---

# Known limitations

| Area | Current boundary | Consequence |
|---|---|---|
| Historical content | Wall pages of 50 and Council load-earlier batches; no full-text search | History is navigable, but finding a specific old item remains manual |
| Notifications | No email/SMS/push delivery for ordinary activity | Relatives must open the House to catch up |
| Archives/family tree | Retained schema without current routes | Do not advertise these as working features |
| Council | No media composer or read receipts | Text conversations, replies, and earlier-history loading are the supported scope |
| Account lifecycle | No general self-service account export/erasure/relink | Deactivation preserves history; separate reviewed tooling needed for other requests |
| Rate limiting | Process-local counters | Cold starts and multiple servers do not share attempts |
| Audit | Best-effort log inserts after operations; rows written before the metadata allow-list may still hold invite codes or removed-content previews | Successful mutations may lack a log entry if logging fails. The audit page never renders those older keys. The live House was redacted with `supabase/operations/redact-audit-secrets.sql` on 2026-10-04; another environment needs its own operator-approved run, and older backups keep the keys |
| Backup | Auth users/identities, public data and House Storage objects; restore only into a fresh target provisioned from migrations | Restore is rehearsed on the local stack only; a hosted restore, Auth configuration, and in-place or partial recovery into the live House are unproven |
| Media links | Where `20261003200000` is applied, browser sessions cannot sign Storage URLs | URLs signed before it was applied keep their caller-chosen lifetime. The live House had no House objects when it was applied (2026-10-04); elsewhere, follow the detection and re-keying plan in the follow-up resolution |
| Offline | Manifest/icons without a complete offline strategy | Installing a shortcut does not guarantee offline access |
| Environment parity | Remote project settings can drift from source | Validate policies, storage, redirects, and migrations in the target |

These limits describe deliberate scope or unresolved capabilities, not a waiver for broken implemented features. Privacy exposures, authorization defects, inaccessible controls, and lost updates remain bugs to repair. The [dated audit](../../audits/2026-10-03/README.md) and its [follow-up](../../audits/2026-10-03-follow-up/README.md) record findings and their state; consult them before declaring a release ready.

No legal compliance, accessibility certification, production uptime, or performance percentile is claimed without the corresponding evidence. The source review and tests cover what they explicitly record.
