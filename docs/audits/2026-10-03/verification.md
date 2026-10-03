# Verification and release evidence — 2026-10-03

This audit covers the existing uncommitted application work and the fixes made during this session. The product is a single private family House, not a public social network. Evidence is separated by environment; local tests do not prove a production deployment or real email delivery.

## Baseline and scope

- Starting branch: `master`, matching `origin/master` at `181675c` when fetched.
- Existing modifications were retained and reviewed rather than reset.
- Baseline: TypeScript, ESLint, and 114 Vitest tests passed.
- Specialist lanes: frontend/UX/accessibility/mobile/performance; backend/database/security/architecture; documentation/product/workflow and independent review; coordinator QA/DevOps/release.
- See [frontend findings](frontend-ux.md), [backend findings](backend-security.md), and [documentation/workflow review](documentation-workflow.md).

## Live database remediation

Read-only inspection found all 14 application tables without RLS and broad anonymous/authenticated grants. This was an actual configuration defect, despite an existing migration describing the intended lockdown.

Before modifying the live database, the coordinator saved a private application SQL backup and Storage inventory under `backups/2026-10-03T17-55-17/`. An additional custom-format `pre-hardening-full.dump` includes the `public`, `auth`, and `storage` schemas with identities and privileges; its archive table of contents was checked. These files are ignored by Git. The dump has not been restored into another project during this audit.

The preflight found zero invalid gathering intervals, self-parent edges, deleted messages, or overused invite counters needing corrective cleanup. Storage contained no objects. The migrations applied were `0002`, `0003`, `0004`, and `20261003175118_security_and_private_media`; `0001` was deliberately not replayed over existing tables.

After application, independent read-only checks confirmed:

- 14/14 application tables have RLS enabled.
- Zero anonymous/authenticated/PUBLIC table write grants remain.
- `feed-media`, `archives`, and `avatars` are private and have upload limits.
- Existing member and active-Elder counts are unchanged.
- Anonymous HTTP requests to invitations, member email columns, and messages each return 401.

The SQL changes are complete. Code deployment is tracked separately below. Do not roll back by restoring public grants; roll forward while keeping private data denied.

## Automated checks

| Check | Result |
|---|---|
| Updated unit suite | 192 tests across 13 files passed; the opt-in database test is skipped in this command and run separately below |
| TypeScript and ESLint | Passed with the above suite |
| Real PostgreSQL authorization | 45 assertions plus the real Council action/microsecond cursor regression passed; synthetic fixtures rolled back |
| Production builds | Normal production-environment build and isolated `.next-e2e` build passed with Next.js 16.3.8 |
| Fresh dependency installation | `npm ci` passed after repairing the lockfile's missing platform dependency entries |
| Production dependency audit | Zero reported vulnerabilities with `npm audit --omit=dev` |
| Full dependency audit | 13 development-tool advisories remain in braces/fast-glob and legacy drizzle-kit/esbuild chains; forced incompatible downgrades were not applied |
| Initial desktop core journeys | 8 passed, including invitation onboarding, post/comment/reaction, gathering/create/edit/RSVP, Council persistence, guest restrictions, Elder controls, private photos and profile edits |
| Initial visual sweep | 44 route/role/viewport combinations: no document overflow, broken images, or browser JavaScript errors |
| Targeted final browser regressions | 12/12 passed across all three projects: Wall input, two-session streaming, private avatars, database-stream failure/recovery |
| Backup smoke | Two concurrent local database backups passed: distinct destinations, owner-only dump files, completion manifests |
| Final cross-browser run | 57/57 passed in 3.7 minutes: 19 journeys each in desktop Chromium, mobile Chromium and mobile WebKit; zero retries |
| Documentation drift check | 63 Markdown files, 225 local links, 29 vault notes and 218 source references passed |

Browser tests run only against disposable local Supabase, with three synthetic roles. Chromium desktop, 375px mobile Chromium, and iPhone-sized WebKit are configured. Axe checks cover WCAG A/AA rules; this is useful automated evidence, not a claim of perfect accessibility on every physical device.

The harness refuses non-loopback database/API/app origins and requires dedicated ports. Preparation recreates only this project's disposable services and volumes, replaying the full migration chain with compatible image versions. Production and test browser bundles use different build directories. No real family data is used in UI tests. Browser screenshots and failure traces remain in ignored local artifacts.

The expanded checks caught and drove repairs for long-name mobile overflow, error contrast, early input before hydration, timestamp hydration, Safari focus-guard names, stale public branding, a tokenless browser Realtime join, database-stream health reporting, and microsecond message ordering. An initial disk-space interruption and outdated local service images were environmental failures, not accepted test results. Later browser attempts exposed test sequencing during menu animations and WebKit prefetch cancellation, plus stale regenerated fixture HTML between standalone server runs. These were repaired without filtering accessibility rules or browser errors. The completed runs above supersede those failed attempts. Invite/last-Elder concurrency is protected in source and covered by mocked tests; this audit does not claim a real concurrent-transaction stress test.

## Release status and remaining limits

Release identity and remote outcomes are recorded in [master commits](https://github.com/jahmar-code/house-of-ahmar/commits/master) and the [App verification workflow](https://github.com/jahmar-code/house-of-ahmar/actions/workflows/ci.yml); check the run for the actual release SHA. Vercel's deployment status is attached to that commit. These remote results are separate from the local evidence recorded here. Public CI uses synthetic local infrastructure and receives no live Supabase credentials. The following require separate operational evidence even after code checks pass:

- Production hosting health and active deployment commit.
- Real SMTP delivery and email branding/configuration.
- A rehearsed cross-project recovery preserving original Auth user IDs.
- Physical-device and assistive-technology testing beyond browser emulation.

The in-memory access-code limiter is per process; transactional invite consumption and database permissions remain the authoritative safeguards. See [known limitations](../../pkm/50-operations/known-limitations.md) for the current operational boundaries.
