---
title: Auth and security
summary: Database-backed membership, Data API policies, and private resource access.
source:
  - src/proxy.ts
  - src/lib/auth.ts
  - src/lib/supabase/middleware.ts
  - src/app/(house)/layout.tsx
  - src/app/auth/confirm/route.ts
  - src/lib/safe-redirect.ts
  - supabase/migrations/0002_lock_down_data_api.sql
  - next.config.ts
  - src/lib/media.ts
  - src/app/api/media/[bucket]/[...path]/route.ts
  - supabase/migrations/20261003175118_security_and_private_media.sql
  - supabase/migrations/20261003200000_operation_aware_media.sql
  - src/lib/db/safe-errors.ts
  - src/lib/audit.ts
  - src/lib/audit-summary.ts
verified: 2026-10-03
tags: [security, auth]
---

# Auth and security

## Trust boundaries

1. Supabase `getUser()` verifies the session.
2. `getAuthContext()` finds the matching **active** member in Postgres and returns the app identity. `requireAuth` and `requireRole` enforce that context; `requirePageAuth` redirects non-members before protected page queries.
3. Each private data loader and mutation checks access appropriate to its resource. Layout and navigation checks improve UX; they cannot substitute for a data-layer guard.
4. Browser Data API privileges are separately constrained by SQL grants and RLS. The app's privileged Postgres connection does not inherit browser restrictions.

`proxy.ts` maintains a public-path allow-list for the front door, auth/recovery, callback, and metadata. Other paths require a session. Metadata such as `hoa_member_id` is user-writable and is no longer used as a membership gate. The proxy authenticates only; database-backed loaders/actions enforce membership and roles. Never authorize from metadata or trust an incoming role.

## Read exposure

The browser receives only the member fields needed for a surface. `PUBLIC_MEMBER_COLUMNS` is intended for bylines; full identity/contact rows do not belong in feed/chat props. Member profile contact details are restricted for guests. Private chambers are Elder-only, including direct navigation and realtime/Data API access.

`0002_lock_down_data_api.sql` establishes deny-by-default RLS and removes broad client grants, then opens narrow reads needed for Council. Later migrations refine this posture. Apply the complete [migration runbook](../50-operations/migration-runbook.md), and verify policies as anonymous, non-member authenticated, guest, member, Elder, and deactivated identities. A query through the owner connection does not test browser policy enforcement.

## Authentication recovery

`auth/confirm` supports code exchange and token-hash verification. Redirect destinations pass through `safeRedirectPath`; deployment origin must be configured. Password recovery remains reachable for authenticated users without membership so they do not get trapped in initiation. See [join and recover](../30-flows/join-and-recover.md).

The invite is redeemed again on the server even if an earlier validation screen accepted it. First-Elder selection and use-count updates share a transaction and advisory lock. In-memory throttling deters repeated failures within one process but is not a shared serverless defense.

## Media, logs, and headers

`/api/media/[bucket]/[...path]` resolves active database membership, validates supported buckets and safe paths, then downloads through the caller's Supabase session so Storage RLS is a second gate. Responses use `Cache-Control: private, no-store` and `Vary: Cookie`; supported image MIME types are explicit. Private images bypass the public Next image optimizer. New uploads return relative app URLs; the migration converts legacy public bucket URLs without changing object paths. The `feed-media`, `archives`, and `avatars` buckets become private, with uploads constrained to the caller's allowed namespace. Retained `archives` media is Elder-only; active members may read family feed/avatar media.

Storage evaluates `storage.objects` SELECT policies for more than downloads, so `20261003200000_operation_aware_media.sql` makes the restrictive `house_media_read_guard` and `house_media_upload_guard` operation-aware. A browser session may read House objects only through authenticated download/info operations (`private.is_media_read_operation`) and insert only through a direct upload (`private.is_media_upload_operation`). Signing, batch signing, signed upload URLs, listing, copy/move, image rendering, TUS, and S3 operations on House buckets are refused, even if an older permissive policy such as `using (true)` still exists, because restrictive guards AND with every permissive policy. Restrictive write guards on `storage.buckets` also stop any browser session from creating, changing (for example making public) or deleting a House bucket. The migration aborts if the target's Storage lacks `storage.allow_any_operation` / `storage.allow_only_operation`, rather than silently denying every download. It does **not** revoke signed URLs minted before it is applied. The caller chooses a signed URL's lifetime, so an earlier one may stay valid for years; the operator plan in the [follow-up resolution](../../audits/2026-10-03-follow-up/resolution.md#ds-01-already-issued-signed-urls) covers detecting and re-keying them. The app itself never signs URLs.

Family photo access must be authenticated independently of the page containing the image. Audit the direct resource URL, the Storage API operations a session can call directly, and cache behavior as well as the UI; storage bucket policy and application routing must agree. [Membership](../20-domains/membership-and-invitations.md) and [The Wall](../20-domains/the-wall.md) document upload usage; [testing strategy](../50-operations/testing-strategy.md) lists the real Storage API checks.

`next.config.ts` sets anti-framing, MIME-sniffing, referrer, permissions, and transport headers. Its frame-ancestor CSP is not a complete script-source CSP. Audit logging records administrative actions on a best-effort basis; it is not a transactionally guaranteed audit ledger. Its metadata passes a per-action allow-list (`AUDIT_METADATA_KEYS` in `audit.ts`) that excludes invite codes and message/post/comment text, and `summarizeAuditEntry` never renders those keys from older rows; see [Elder administration](../20-domains/elder-administration.md#audit-behavior). Do not log message text, invite codes, credentials, or private profile fields in ordinary diagnostics. Database failures are reduced to their SQLSTATE before they can reach host logs (`installDatabaseErrorSanitizer` in `src/lib/db/safe-errors.ts`), because Drizzle's own error message carries every bound parameter.
