# Prior work and release context

Audience: Claude or a maintainer continuing this application. This is the historical handoff for the completed release, not a claim that the follow-up audit found no defects. Read the [new audit](README.md) before implementing more changes.

## Identity and scope

- Repository: `jahmar-code/house-of-ahmar`; one private House for one inclusive family.
- Original audit started on `master` at `181675c` with substantial uncommitted work. Those changes were preserved, reviewed and integrated; do not attribute every changed line to one audit agent.
- `bce6125fcc2b101ff4533f94902f2ed98ba38caf`: integrated app audit/hardening/documentation release, 243 files changed. [Commit](https://github.com/jahmar-code/house-of-ahmar/commit/bce6125fcc2b101ff4533f94902f2ed98ba38caf).
- `f239065ad943131eece5f17ad99fded541d863e1`: follow-up browser-readiness assertions and audit documentation, six files; no application code change. [Commit](https://github.com/jahmar-code/house-of-ahmar/commit/f239065ad943131eece5f17ad99fded541d863e1).
- The completed release was pushed to `master`. Vercel production deployment of `bce6125` succeeded; the later `f239065` changed only tests/docs. Do not claim a different deployed SHA without checking the host.
- [Final hosted CI](https://github.com/jahmar-code/house-of-ahmar/actions/runs/37149473177) succeeded for `f239065`. The follow-up audit uses that commit as its source baseline.

## Application changes already integrated

| Area | Work completed | Main source anchors |
|---|---|---|
| Authentication and private loaders | Direct active-membership/role checks on private loaders and actions; database membership is authoritative; safer confirmation redirects and inactive-account handling | `src/lib/auth.ts`, `src/lib/supabase/middleware.ts`, `src/proxy.ts`, private `page.tsx` loaders, `src/app/auth/confirm/route.ts` |
| Joining and invitations | Transactional redemption, retries, founding-Elder behavior, bounded invite use, retired bootstrap after founding, stronger random invite codes | `src/app/actions/onboarding.ts`, `src/app/actions/admin.ts`, initiation routes |
| Elder controls | Role/activation checks and final-Elder safeguards; chamber administration; confirmation states and refreshed views; House identity transaction and root-layout revalidation | `src/app/actions/members.ts`, `council.ts`, `settings.ts`, Elder Council routes |
| Account recovery and profiles | Forgot/reset-password flows, recovery-token handling, own-profile/avatar settings, validation and accessible feedback | forgot/reset-password routes, `src/app/(house)/settings`, `src/app/actions/members.ts` |
| Great Hall and directory | Parallel summary reads, presence handling, first-run guidance, narrowed member projections, long-name wrapping, birthday calendar-date handling | dashboard route/components, members routes, `src/components/members/member-grid.tsx` |
| Wall | Text/photo/milestone/announcement behavior, server validation and ownership/state checks, comments/reactions, stable ordered pages, keyboard photo dialog | `src/app/actions/feed.ts`, feed page, `src/components/feed` |
| Gatherings | Validated create/edit/RSVP/cancel/archive flows, ongoing-event end-time handling, read-only archived views; all-day UTC calendar-day convention and client-local timed display | `src/app/actions/gatherings.ts`, gathering routes/components, `calendar-date.ts`, `gathering-date.tsx` |
| Council | Text/replies/history, microsecond timestamp ordering, dedupe, IME/pending-send guard, real authenticated Realtime join, stream readiness/failure/recovery, scroll preservation | `src/app/actions/council.ts`, `src/lib/db/message-projection.ts`, `src/lib/message-order.ts`, `src/components/council` |
| Private media | Private buckets and user-scoped authenticated byte proxy, validated paths/ownership, no-store responses, legacy-path normalization | media route, `src/lib/media.ts`, `src/lib/supabase/storage.ts`, final hardening migration |
| Shared UI | Mobile safe-area/composer work, semantic colors/contrast, focus and keyboard behavior, loading/error/not-found screens, avatar alternatives, Inter/Geist self-hosting | layouts, shared components, `globals.css`, root layout |
| Hydration and Safari | Hydration-aware fieldsets for primary forms; stable initial activity timestamps; accessible names on Safari's Base UI focus guards without disabling their focus behavior | `hydrated-fieldset.tsx`, `activity-time.tsx`, `use-modal-focus-guard-names.ts`, Dialog/Sheet |

These are implemented improvements. The new findings identify gaps that remain within some of these areas; a completed improvement is not an exhaustive guarantee.

## Live database work already performed

The previous audit discovered all 14 application tables without the intended RLS enforcement and broad anonymous/authenticated grants. Before changes, private backups and the Storage inventory were saved in ignored `backups/2026-10-03T17-55-17/`. A separate `pre-hardening-full.dump` includes `public`, `auth`, and `storage` schemas with identities/privileges; its archive table of contents was checked, but it was not restored in a drill. Never publish these files or their contents.

Applied to the configured live project: `0002_lock_down_data_api.sql`, `0003_milestones.sql`, `0004_integrity.sql`, and `20261003175118_security_and_private_media.sql`. **`0001` was not replayed over the existing database.** No blind `db:push` was used. The preflight found no invalid intervals/self-parent edges/overused counters requiring cleanup, and Storage contained no objects at that time.

Post-application checks observed 14/14 tables with RLS, zero anonymous/authenticated/PUBLIC table write grants, private `feed-media`/`archives`/`avatars` buckets with limits, unchanged member/Elder counts, and anonymous HTTP denial for invitations, member email columns and messages. Do not infer that every Storage API operation was tested: the follow-up signed-URL finding is a specific uncovered path.

Do not rerun the whole migration chain on production, restore a backup over live family data, relax RLS, rotate signing keys, redact historical records or replace Storage objects simply because a prompt says “fix the audit.” Prepare an explicit additive/operational plan first.

## Tooling, verification and workflow already added

- Node 24 contract in `.nvmrc` and package engines; Next 16.3.8, React 19.3.0, Supabase JS 2.117.2/SSR 0.12.7, Drizzle 0.45.3, Vitest 4.1.11 and Playwright 1.63.0. Read current `package.json` and lockfile before changing versions.
- Repaired lockfile platform entries and verified a clean `npm ci`. Production dependency audit reported zero vulnerabilities; the full audit still had 13 development-tool advisories (nine high, four moderate). Forced incompatible downgrades were deliberately avoided.
- GitHub Actions verification: pinned actions, Node 24, install/check/runtime audit, browser installation, disposable Supabase, real SQL checks, production E2E build, all browser projects, failure artifacts and cleanup. Configuration alone is not an enforced production-promotion gate; see the new operations finding.
- Dedicated disposable test target: API `55321`, PostgreSQL `55322`, app `3217`; `.env.e2e.local` is generated, ignored and restricted. Scripts refuse non-loopback/wrong-port targets. This does not make a tunnel to production safe.
- E2E preparation recreates only this project's disposable services and volumes, so database, Storage and Realtime images agree. It deletes that test project's old fixture content. Production `.next` and isolated `.next-e2e` output are separate because browser configuration is build-inlined.
- Three synthetic roles; desktop Chromium, mobile Chromium, mobile WebKit; serial execution and zero retries. Local email confirmations are disabled and auth rate limits raised for fixture volume; neither is a production recommendation.
- Backup script now creates unique destinations and restrictive files, avoids exposing the database password in argv, includes all configured media buckets, prevents path traversal and writes its completion manifest only after success. Its public-schema scope remains incomplete for disaster recovery; see OP-01.
- Removed tracked local Supabase setup/scratch files and obsolete fixture scripts from the release. Credentials, backups and browser artifacts remain ignored. The follow-up discovered another legacy helper that still needs remediation.
- `AGENTS.md` is the shared instruction source; `CLAUDE.md` is a thin entry point. The local roster has 21 adapted personas (including a local docs curator). The complete sibling library has 24 roles; the follow-up explicitly covers the four sibling disciplines without local equivalents.
- HotSeat-inspired source-linked knowledge vault: 29 notes, product/architecture/domains/flows/reference/operations, source metadata and verified dates; 63 Markdown files total at release. A dependency-free checker verified 225 local links and 219 source references. These counts will grow with this audit package.

## Historical verification outcomes

| Evidence | Observed result and limit |
|---|---|
| Original baseline | TypeScript/lint and 114 unit tests passed before the integrated work |
| Final unit/static/docs gate | 192 tests passed in 13 files; one opt-in DB test skipped here and run separately |
| Real database checks | 45 PostgreSQL authorization assertions plus the real Council microsecond-cursor action regression passed; transactional fixtures rolled back |
| Builds | Normal production-environment and isolated E2E production builds passed |
| Browser | 57/57 local cases passed; final Linux CI also passed 57/57 in 3.6 minutes, without retries |
| Production | 21 read-only public-page, desktop/mobile axe/overflow, header, anonymous-route and private-media checks passed on `https://house-of-ahmar.vercel.app`; no family mutation fixtures were created |
| Backup smoke | Two concurrent local dumps completed with unique directories, owner-only files and manifests; this was not a restore test |
| Independent review | Frontend/visual, security/integration and documentation reviews ran; the new audit challenges their blind spots rather than treating them as certification |

### Failures that drove the earlier fixes

- Disk exhaustion, an npm installation problem and missing optional platform entries prevented early installation/build attempts; later clean install/build results superseded them.
- Old local Supabase containers reused after a CLI/database upgrade broke Storage and Realtime; preparation now recreates the dedicated stack.
- Controlled inputs could receive edits before hydration; relative timestamps differed between rendering clocks/timezones; Realtime could join without the authenticated token. These resulted in source fixes and targeted regressions.
- Public House branding did not invalidate all prerendered entry pages; root-layout invalidation and a restore-aware branding test were added.
- Safari exposed unnamed focus guards; the shared adapter labels them while preserving focus handling.
- Browser scans initially sampled opening animations; WebKit reported canceled prefetches during forced document replacement; repeated standalone runs inherited regenerated fixture branding. Tests now wait for explicit readiness/animation/navigation state and restore public fixture HTML.
- The first hosted CI run passed 53/57. Traces showed profile hydration changed colors during axe and a keyboard event preceded modal focus. `f239065` added readiness assertions; six local regressions and the full hosted run passed afterward. No axe rule or page-error assertion was removed.

## Remaining boundaries carried forward

Real SMTP delivery/branding, a full identity-preserving recovery rehearsal, physical mobile keyboards/screen readers, and real concurrent invite/final-Elder stress tests were not proven by the release. The process-local limiter and best-effort audit logging remain documented limitations. Native apps, telemetry/analytics, AI product features, notifications, offline writes, family-tree/Archives UI and multi-house/billing flows were not implemented or promised.

The follow-up is a source audit plus targeted synthetic proofs; it does not silently convert these outstanding checks into passes. Use [the original evidence ledger](../2026-10-03/verification.md), the hosted CI run and the new specialist reports together.
