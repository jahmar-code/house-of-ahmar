---
title: Testing strategy
summary: Evidence layers and the acceptance checks for reliable mobile and desktop family flows.
source:
  - package.json
  - vitest.config.mts
  - src/lib/validators.test.ts
  - src/app/actions/feed.test.ts
  - src/app/actions/gatherings.test.ts
  - src/app/actions/council.test.ts
  - src/app/actions/council.database.test.ts
  - src/components/council/message-sync.ts
  - scripts/e2e-prepare.mjs
  - scripts/e2e-env.mjs
  - scripts/e2e-run.mjs
  - playwright.config.ts
  - tests/e2e/helpers.ts
  - tests/e2e/house.spec.ts
  - tests/e2e/public.spec.ts
  - tests/e2e/onboarding-media.spec.ts
  - tests/e2e/recovery.spec.ts
  - tests/e2e/interactions.spec.ts
  - tests/e2e/settings.spec.ts
  - tests/e2e/realtime-recovery.spec.ts
  - supabase/config.toml
  - tests/integration/database-security.mjs
  - .github/workflows/ci.yml
  - next.config.ts
verified: 2026-10-03
tags: [testing, quality]
---

# Testing strategy

## Required gates

Use the scripts currently declared in `package.json`:

```bash
npm run check
npm run build
```

`check` combines static typing, lint, unit tests, and `docs:check`. Node 24 is the supported major version. The production build is a distinct gate and can reveal framework/runtime issues. Preserve lockfile reproducibility and use the supported Node version. Run targeted tests during implementation, then the complete required gates after integrating changes.

Unit tests exercise validators, action permissions/state transitions, and client-state helpers. Mocked actions can prove validation/branch behavior but cannot establish SQL grants, transactional concurrency, email delivery, websocket updates, or visual usability. When browser/test harness scripts are available, use their explicit environment contract rather than improvising live test users.

## Isolated browser suite

Docker must be available for the dedicated local Supabase stack. The harness uses API/database ports 55321/55322 and serves the production app on port 3217. It does not load the family's `.env.local` as its test target.

```bash
npm run test:e2e:prepare
npx playwright install chromium webkit
npm run build:e2e
npm run test:e2e
```

Preparation first verifies the exact local project ID, then **stops this project's disposable Supabase stack with `--no-backup`, removes its local volumes, and starts fresh services**. Fresh startup replays all migrations; preparation checks the loopback database and dedicated port, then creates synthetic Elder, Member, and Guest accounts with a generated password. Existing local test content, including uploaded media, is removed. It writes ignored `.env.e2e.local` with restrictive file permissions. The runner validates local service URLs before spawning build/server/tests. Re-run preparation deliberately; it replaces the entire fixture stack, credentials, and invitation usage. Never put important development data in this disposable project.

Recreating services is intentional: upgrading the Supabase CLI does not replace already-running Storage or Realtime containers. Resetting only their database can leave older service images incompatible with the newer schema. Preparation targets only the `house-of-ahmar` local project; other projects must not share this disposable ID.

The runner requires the dedicated API/database/app ports and sets `HOA_E2E=1`, selecting `.next-e2e` for both build and server. Ordinary development and production use `.next`. This separation matters because `NEXT_PUBLIC_*` values are compiled into browser bundles: changing the server environment cannot retarget an already-built browser client. Always rebuild after changing test configuration.

The local Supabase config disables email confirmation for synthetic signups and allows 200 sign-in/signup requests per five minutes so the full browser matrix can run without provider throttling. These are disposable-test settings, not production recommendations. Recovery tests generate local Auth links and prove callback/password behavior; they do not prove real SMTP delivery or production signup confirmation.

Playwright manages a production server with reuse disabled. Projects cover desktop Chromium (1440×1000), mobile Chromium (375×812), and mobile WebKit (390×844), with a Toronto timezone. Tests run serially, without automatic retries; traces/screenshots are retained on failure and an HTML report is produced. Axe checks supplement task assertions. Use the actual report for executed scenario/test totals; project configuration alone proves no pass.

The committed browser scenarios cover public navigation and anonymous denial; member routes, posting/commenting/reactions, gatherings/RSVP/editing, two-session Council delivery, guest restrictions, and Elder invitations; invitation signup and private media/profile persistence; and password-recovery token use/reuse. `interactions.spec.ts` adds photo-viewer and menu keyboard/focus behavior, private avatar uploads and accessible alternatives, IME draft preservation and duplicate-send prevention, composer placement above navigation, and all-day gathering display/editing in Honolulu and Auckland. These are executable scenarios, not a claim that every configured project has passed; consult the current run result.

Install required browser system dependencies on Linux CI. A failed image download, unavailable Docker daemon, occupied port, or missing browser is an environment failure to record, not a skipped success. Test artifacts may include fixture credentials/session state and must remain ignored.

The shared accessibility helper waits for running finite animations to finish before evaluating contrast and overlap. Otherwise an entering sheet can be sampled with temporary opacity and geometry. This uses browser animation completion, not sleeps or rule exclusions. Full-document route probes and Council reload checks finish background requests before replacing the document, because WebKit reports canceled Next prefetches as page errors; runtime-error assertions remain unfiltered.

The settings journey restores both database values and rendered public pages. Local `next start` writes regenerated HTML to the build output but keeps invalidation tags in memory; stopping after invalidation without revisiting restored routes can leave fixture branding in a later run that reuses the same build. Rebuild after deliberately replacing database fixtures, and retain public-page verification during cleanup.

## Real database security checks

After local fixture preparation, run `npm run test:db`. The first script, `tests/integration/database-security.mjs`, checks actual catalog/policy behavior and browser-facing identities. The command then opts into `src/app/actions/council.database.test.ts`, which calls the real history action through Drizzle against a transaction containing microsecond timestamp fixtures; only auth/cache/audit boundaries are stubbed. Both suites roll back their fixtures and require the loopback database on port 55322. Their URL defaults to that local database when `DATABASE_URL` is absent; neither reads `.env.local`.

Keep these results separate from the ordinary unit suite and Playwright, and report each supplied count. The optional `--reapply` argument to the first script reapplies the hardening migration outside the fixture rollback; use it only on the dedicated disposable database. These guards are not a license to forward a live database onto the test port.

## Verification layers

| Layer | Proves | Does not prove |
|---|---|---|
| Type/lint/build | Static contracts and production compilation | Valid remote configuration or user task completion |
| Unit tests | Behavior under enumerated inputs/mocks | Live database locking/RLS/provider behavior |
| Browser smoke | Routes, interaction, visible state, runtime errors | Every role/state, other engines, or mail delivery |
| Database integration | Real constraints, policy behavior, races | Mobile UX |
| Manual device/keyboard inspection | Focus, touch, viewport/keyboard behavior | Exhaustive accessibility conformance |

## Risk-based acceptance matrix

| Area | Essential checks |
|---|---|
| Entry | Anonymous private-route denial; valid/invalid login; confirmation and recovery callback; safe redirects |
| Initiation | Valid/expired/revoked/used invite, final-use race, first Elder, retry, inactive user |
| Wall | Text/photo-only post, validation, reaction/comment, pin/remove, image privacy, guest restrictions |
| Gatherings | Create/edit, invalid dates, RSVP all statuses/guest, cancel/restore, archive, ownership denial |
| Council | Send/reply, two clients, deletion, reconnect/missed events, ordering, private/announcement/archived rules |
| Members | Directory/profile, contact visibility, update/remove avatar, birthday boundaries |
| Elder | Direct-route/action denial, codes, role/activation races, chambers, settings, audit visibility |
| Mobile/desktop | Narrow viewport and desktop, no overflow/covered controls, long content, keyboard focus, errors/empty/loading |
| Operations | Policies/grants/buckets, media routes, environment contract, migration rehearsal, backup scope |

Use disposable test data. Never use real family messages, photos, passwords, or destructive role changes as fixtures. A local frontend connected to production is still production for mutations.

## CI and dependency checks

`.github/workflows/ci.yml` runs on pull requests and pushes to master: Node 24, reproducible install, `check`, production dependency audit, browser installation, local Supabase fixtures, real database authorization, production E2E build, and browser journeys. It retains failure artifacts briefly and stops local services. The workflow definition is not proof of a hosted run.

Use `npm audit --omit=dev` to assess the runtime graph separately from development/build tooling. A clean runtime result does not clear advisories in development dependencies. Record unresolved tooling advisories and their context in verification evidence rather than applying incompatible forced upgrades.

## Evidence format

Record command, date, environment, result, test count where provided, and relevant artifacts. Browser results include role, viewport, and test scenario. Classify `passed`, `failed`, `skipped`, and `not run` separately, with the cause and next required action. Capture console/page errors without dumping private payloads.

The [October audit](../../audits/2026-10-03/README.md) is the execution ledger for this pass. Do not copy an earlier pass's success into a current release. CI configuration establishes automation intent; a successful CI run requires an observed run result.
