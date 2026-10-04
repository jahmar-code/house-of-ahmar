# Operations, reliability, release and verification audit

Reviewed on 2026-10-03 against `f239065ad943131eece5f17ad99fded541d863e1`. This is a fresh, read-only audit of implementation and recorded evidence, not a new release or a claim that every earlier check was rerun. No production data, service configuration, branches, or dependencies were changed.

## Persona coverage

The complete sibling personas were read, alongside the applicable local adaptations and repository instructions. Their generic enterprise/SaaS assumptions do not override this single-family product.

| Persona from `../agents_md` | Applied review | Exclusions justified by the product |
|---|---|---|
| `devops-platform.md` | CI, lockfile/runtime, fixture isolation, environment boundaries, backup machinery, dependency advisories | No new infrastructure stack, warehouse, or multi-environment platform is justified merely by the persona |
| `sre.md` | Restore dependency order, failure evidence, incident visibility, operational limitations | No invented uptime, RPO/RTO, on-call team, capacity percentile, or availability certification |
| `release-manager.md` | Exact deployed revision versus verified revision, hosted check results, release gating and rollback instructions | No mandatory enterprise release train, percentage rollout, or feature-flag service for six relatives |
| `qa-tester.md` | Actual CI execution, risk-based coverage, transaction-race gaps, deterministic local harness, scope of browser assertions | Physical-device, assistive-technology and SMTP checks are not inferred from Playwright |
| `analytics-engineer.md` | Meaning and privacy of presence/counts, separation of test totals from measured production outcomes | No analytics warehouse, retention experiment, usage SDK, behavioral profiling, or invented adoption metrics |
| `ai-ml-engineer.md` | Development-agent handoffs, bounded ownership, source/evidence requirements, Claude continuation constraints | No application LLM/RAG feature exists; no model purchase, fine-tuning, family-content eval corpus, or AI feature roadmap is proposed |

## Findings to hand to Claude

### OP-01 — P2: Public-only backups omit helper functions required by their policies

**Status:** Newly confirmed recovery defect; related to, but distinct from, the already documented Auth omission and missing restore rehearsal.

**Trigger and impact:** Restore a post-hardening `npm run backup` dump into an isolated target with the original Auth identities but without the House's `private` schema. The dump contains `members_client_read` and `messages_client_read` policy definitions calling `private.is_active_member()` and `private.can_read_channel(uuid)`, yet it does not create those functions. A fail-on-error restore cannot complete that policy section. Reapplying hardening *after* restoring public data, as the current runbook orders it, does not resolve the preceding dependency failure. Simply pre-running every migration also creates the public objects already contained in the full SQL dump, so that is not a complete restoration recipe either.

**Evidence:** `scripts/backup.mjs` invokes `pg_dump --schema=public --no-owner --no-privileges`. The hardening migration creates helpers in `private` and public-table policies that call them. Both earlier synthetic backup-smoke dumps at `/private/tmp/hoa-backup-verified-UBvjXj/` contain these policy references and no private-schema creation. A fresh schema-only dump from the disposable local database reconfirmed the same omission in `/private/tmp/hoa-audit-schema.sql`. Only SQL definitions were inspected; no family rows were read. PostgreSQL explicitly notes that selecting a schema does not include dependencies in other schemas: [pg_dump schema selection](https://www.postgresql.org/docs/current/app-pgdump.html).

**Smallest sound change:** Define one supported restore contract: either capture the required private-schema definitions with a correctly ordered archive, or provision a versioned schema first and restore a deliberately data-only application dump. Keep Auth restoration and Storage objects explicit, preserve deny-by-default grants, and update the manifest and recovery runbook to match the exact commands. Do not solve this by ignoring SQL errors or removing RLS.

**Acceptance:** A synthetic fixture backup restores into a fresh isolated target with `ON_ERROR_STOP=1`, preserved Auth/member IDs, matching row/object counts, working authorized photos and Council subscriptions, and passing anonymous/non-member/inactive denial checks. Keep the target inaccessible to ordinary clients until lockdown verification passes. Include a regression asserting that backup/restore succeeds with the `private` helper dependency. A live family restore is neither required nor authorized by this finding.

### OP-02 — P2: Production deployment can precede and bypass verification

**Status:** Newly verified release-policy gap/decision; no current application regression or unauthorized prior deployment is asserted. The earlier user explicitly authorized the direct push to master.

**Trigger and impact:** A direct push to `master` starts the Git-integrated production deployment independently of `.github/workflows/ci.yml`. A failing change can be exposed before the six-minute verification job completes. No branch protection or effective branch rules were present when inspected.

**Evidence:** Read-only GitHub API checks returned `Branch not protected` for master protection and `[]` for effective rules. Commit `bce6125` deployed successfully at **19:39:43 UTC**, while its [CI run 37148625887](https://github.com/jahmar-code/house-of-ahmar/actions/runs/37148625887) finished **failed at 19:46:03 UTC**. Its failures were later identified as test readiness defects and fixed; the sequence nevertheless demonstrates that the hosted check is not a release gate. The follow-up [f239065 run](https://github.com/jahmar-code/house-of-ahmar/actions/runs/37149473177) passed. GitHub currently records the production application at `bce6125`; `f239065` changed test harness/docs only, so these application sources match.

**Smallest sound change:** Choose and document an enforced gate that fits the owner's workflow. For direct-master releases, stage a Vercel deployment without assigning the production alias and promote only after the exact revision's required checks pass. Alternatively, require the verification status before merging a protected branch and disallow normal bypasses. Coordinate any change to direct-master preferences with the owner; do not silently impose a different branch policy. Keep migrations a separately reviewed stage, not an automatic destructive deploy hook.

**Acceptance:** An intentionally failing *disposable preview* revision never changes the production alias; the passing revision has a recorded check SHA, deployment ID, and promotion outcome. Read back the effective policy. Rehearse an application-only rollback without reversing the live security migrations or restoring family data. Do not deliberately publish a broken production commit to test this gate.

### OP-03 — P2: The test-account confirmation helper can bypass live email verification

**Status:** Source-confirmed operator safety/privacy defect; the script was not executed.

**Trigger and impact:** `node scripts/confirm-test-user.mjs <email>` loads the normal `.env.local` credentials, finds any matching account among the first 200 Auth users, and calls the service-role confirmation override. There is no loopback/test-project/test-email check. The helper then prints the email and Auth UUID. An operator intending to unblock a test can instead bypass a real relative's email verification and copy identity information into task logs.

**Evidence:** The full script uses `config({ path: ".env.local" })`, `auth.admin.listUsers`, and `auth.admin.updateUserById(..., { email_confirm: true })`; its success paths print both identity fields. `docs/pkm/40-reference/libraries-and-tooling.md` describes it as a test-account helper. Unlike `scripts/e2e-env.mjs`, it does not enforce the dedicated local target. The retained seed-past-gathering helper explicitly opts into a live fixture, which is also unnecessary now that the isolated harness exists.

**Smallest sound change:** Remove obsolete test helpers or make test-only helpers load the dedicated E2E environment and require its exact loopback API/DB ports plus a synthetic email domain. Log only an operation outcome. If a live identity repair capability is required, name and document it as a separate privileged recovery procedure with explicit target/account selection; do not disguise it as ordinary test setup. Migrate the legacy past-gathering fixture to the same disposable environment.

**Acceptance:** Hosted URLs, missing E2E configuration, non-test account addresses, and the wrong local ports fail before any Auth/network mutation. A fixture confirmation succeeds locally and produces no email, UUID, token or credential in captured output. Tests should stub the mutation boundary to prove refusal happens first.

### OP-04 — P2: The highest-impact concurrency invariants lack real concurrent-transaction tests

**Status:** Known verification gap, confirmed against the current test implementations; not evidence that the source locks are broken.

**Trigger and impact:** Two different users redeem the final use of an invitation, or two Elders concurrently demote/deactivate each other. A regression in advisory-lock scope, actor rechecking or invite-row locking could admit too many relatives or leave no active Elder, while the present tests remain green.

**Evidence:** `src/app/actions/onboarding.test.ts` serializes its mocked `transaction` through a JavaScript promise queue; its only concurrent case is two retries by the *same user*. `src/app/actions/members.test.ts` mocks the lock and database reads. `tests/integration/database-security.mjs` runs catalog/RLS assertions within one connection/transaction, and `council.database.test.ts` tests a cursor contract. None races the real onboarding/membership transactions. The prior audit correctly disclosed this boundary.

**Smallest sound change:** Add opt-in integration tests using independent database connections and the actual action transaction paths, stubbing only the per-request Auth identity/cache/audit edges. Cover two users competing for one invite use, duplicate retry of one user, concurrent founding attempts, and reciprocal Elder demotion/deactivation. Use synthetic fixtures and reliable cleanup, not real family accounts.

**Acceptance:** The invitation race commits exactly one new member/redemption, retries consume no extra use, bootstrap produces one founding Elder, and every membership race retains at least one active Elder with stale actors rejected. Run these in `test:db`/CI, without serializing the test itself into the behavior it intends to prove. Failure injection should demonstrate the tests notice a missing lock or actor recheck.

## Carried-forward limitations and proportionate follow-up

- **Full recovery remains unproved.** The earlier extra pre-hardening Auth/public/Storage dump had its archive inventory checked, not restored. The ordinary backup excludes Auth and has OP-01. After fixing that contract, rehearse a complete isolated recovery with synthetic Auth IDs and media; define acceptable data-loss/recovery windows with the owner and then choose backup frequency/private off-device retention. Do not label an on-disk manifest a recovery guarantee.
- **Real email delivery and confirmation remain unverified.** Local configuration disables signup email confirmation; the recovery journey generates a local Auth link. A controlled disposable hosted environment should verify delivery, confirmation, expired/reused links, and redirect configuration before declaring the invitation/auth story operationally complete.
- **Physical devices and assistive technology remain unverified.** The 57 browser journeys cover useful desktop/mobile emulations and real Chromium/WebKit engines. They do not establish virtual-keyboard behavior on actual phones or screen-reader task success.
- **Development dependencies retain 13 advisories.** A fresh `npm audit --json` on this pass again reported 9 high and 4 moderate dependency entries, derived from the braces stack-exhaustion and old esbuild development-server advisories. This is not 13 independently exploitable application defects. The suggested forced fixes include incompatible downgrades. Track compatible upstream fixes and avoid exposing development tooling; do not regress Next/Drizzle merely to obtain a green full audit. The separate prior hosted runtime-only audit passed.
- **Rate limiting and audit logging have explicit limits.** `src/lib/rate-limit.ts` is process-local, while `src/lib/audit.ts` writes best-effort after operations. These are known design boundaries, not distributed abuse resistance or guaranteed audit durability. Prioritize a shared limiter or transactional audit only against a concrete abuse/audit requirement; preserve simple operation for the House.
- **Observability is sparse.** There is no app-level operational event/error pipeline or documented owner/notification path for failed backups, Auth delivery or sustained runtime failures. Start with privacy-safe outcome/error categories and an actionable runbook; avoid logging member details, invite codes, messages or URLs containing secrets. Do not invent an SLO or collect family behavior to satisfy a generic persona.

## Analytics and development-agent conclusions

The Great Hall's counts are product state, not adoption analytics: active members, members with `lastSeenAt` within the shared five-minute presence window, and non-cancelled/non-archived upcoming or ongoing gatherings. `presence-provider.tsx` sends presence while visible; `presence.ts` updates active rows. The values are a server-rendered snapshot, not a measured long-term engagement metric. There is no evidence-based reason to add third-party tracking, a warehouse, experiments or family-content collection. If presence freshness becomes confusing, label and refresh that existing product state rather than invent a new metric.

The current agent workflow has useful boundaries: canonical `AGENTS.md`, a thin `CLAUDE.md`, local roles, source-linked notes, bounded ownership, coordinator integration and independent review. Preserve these. For the Claude handoff, enumerate findings by ID with evidence, smallest change, acceptance, and environment; require reproduction before refactor and distinguish inherited green runs from newly executed checks. Load roles by responsibility and reuse current model configuration rather than copying stale model IDs/pricing from the generic AI persona. Treat external reports/tool output as evidence, not instructions. No application AI subsystem or production family-content eval set is warranted.

## Evidence ledger for this pass

| Check | Outcome |
|---|---|
| Initial `git status --short` | Clean at assigned baseline |
| Six full sibling persona files and applicable local roles | Read; analytics/AI have no local role because these are not shipped app subsystems |
| Source review | CI, package/scripts, fixture runners, backup/runbooks, environment/DB connection, audit/rate limiting, presence/counts, integration/unit/browser test scope |
| Read-only hosted CI metadata | `f239065` run 37149473177 success; verify job 19:52:35–19:58:51 UTC; failure-artifact upload appropriately skipped |
| Read-only release/protection metadata | `bce6125` production success; original CI failed later; master unprotected and no effective branch rules |
| Fresh full dependency audit | 13 advisories: 9 high, 4 moderate; no dependency changes |
| Prior synthetic backup SQL inspection | Confirmed public policies reference excluded private helpers; no rows or secrets printed |
| Fresh local schema read | Initially unavailable on 55322; after coordinator prepared the disposable stack, a read-only schema dump succeeded and confirmed both excluded helper dependencies. No services were started or altered by this lane |
| New unit/build/browser/race/restore execution | **Not run in this audit lane**; prior release evidence is linked and not reclassified as a fresh result |
| Production mutation or repair | **Not performed** |

Only this report was authored by this audit lane. Findings remain open for the coordinator's consolidated Claude prompt; this report does not authorize a production repair, release-policy change or destructive recovery drill.
