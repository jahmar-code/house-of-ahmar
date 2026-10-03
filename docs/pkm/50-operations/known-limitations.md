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
| Audit | Best-effort log inserts after operations | Successful mutations may lack a log entry if logging fails |
| Backup | Public schema and configured Storage objects, not Auth users | Fresh-project recovery needs identity preservation/mapping |
| Offline | Manifest/icons without a complete offline strategy | Installing a shortcut does not guarantee offline access |
| Environment parity | Remote project settings can drift from source | Validate policies, storage, redirects, and migrations in the target |

These limits describe deliberate scope or unresolved capabilities, not a waiver for broken implemented features. Privacy exposures, authorization defects, inaccessible controls, and lost updates remain bugs to repair. The [dated audit](../../audits/2026-10-03/README.md) records findings and their current state; consult it before declaring a release ready.

No legal compliance, accessibility certification, production uptime, or performance percentile is claimed without the corresponding evidence. The source review and tests cover what they explicitly record.
