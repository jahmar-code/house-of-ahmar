---
title: Libraries and tooling
summary: Responsibilities of shared modules and operational scripts.
source:
  - package.json
  - src/lib
  - scripts
  - vitest.config.mts
  - drizzle.config.ts
  - next.config.ts
verified: 2026-10-03
tags: [reference, tooling]
---

# Libraries and tooling

## Runtime libraries

`package.json` and the lockfile hold current versions. The supported runtime is Node 24. Inter and Geist Mono are self-hosted through Fontsource packages so builds do not fetch fonts from a third-party font service. The core stack is Next.js App Router with React/TypeScript, Tailwind CSS, Base UI/shadcn primitives, Supabase Auth/Realtime/Storage, Drizzle/Postgres.js, Zod, date-fns, Lucide, and Sonner. Read installed source/docs for version-specific behavior instead of importing assumptions from HotSeat.

| Module | Contract |
|---|---|
| `lib/auth.ts` | Verified user → active database membership/role |
| `lib/env.ts` | Named configuration validation errors |
| `lib/db/index.ts`, `schema.ts` | Connection lifecycle and relational model |
| `lib/validators.ts`, `constants.ts` | Untrusted input validation and closed values |
| `lib/media.ts` | Private route addresses, allowed buckets, safe paths, and upload ownership |
| `lib/message-order.ts`, `lib/db/message-projection.ts` | Preserve PostgreSQL microseconds and deterministic message-ID ties across server and realtime rows |
| `lib/settings.ts` | House identity defaults and reads |
| `lib/audit.ts` | Shared action labels and best-effort writes |
| `lib/rate-limit.ts` | Process-local attempt counters; no shared store |
| `lib/get-url.ts`, `safe-redirect.ts` | Application URL and internal destination handling |
| `lib/supabase/{client,server,middleware}.ts` | Browser/client cookies and session refresh |
| `lib/supabase/storage.ts` | File validation, paths, browser upload helper |
| `types/index.ts` | Result shapes, inferred entities, safe author projections |

## Operations scripts

Read each script's current options and environment safeguards before execution.

| Script | Behavior |
|---|---|
| `backup.mjs` | Reads public-schema dump and Storage objects to unique timestamped local output; excludes Auth schema |
| `enable-realtime.mjs` | Ensures message/channel publication configuration; database mutation |
| `seed-channels.mjs` | Ensures default chamber rows; database mutation |
| `confirm-test-user.mjs` | Privileged email-confirmation override for a specifically identified test account |
| `e2e-prepare.mjs`, `e2e-env.mjs`, `e2e-run.mjs` | Recreate the exact disposable local Supabase stack and fixtures, enforce fixed ports, and run browser build/test/server using separate `.next-e2e` output |
| `check-docs.mjs` | Offline Markdown link/provenance checks |
| `generate-icons.mjs` | Regenerates local image assets |
| `check-messages.mjs` | Database diagnostics; avoid content output unless explicitly needed |
| `seed-past-gathering.mjs` | Development fixture guarded by explicit opt-in |

The confirmation helper is not a substitute for working email delivery. Backup output is private family data and must stay out of Git. `db:generate` produces SQL for inspection; it does not prove migration ordering or grant correctness. See [release](../50-operations/release-runbook.md), [testing](../50-operations/testing-strategy.md), and [recovery](../50-operations/backup-and-recovery.md).
