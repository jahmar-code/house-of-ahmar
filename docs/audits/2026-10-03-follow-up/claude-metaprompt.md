# Claude implementation metaprompt

Use this document as the task prompt for Claude Code in the House of Ahmar repository. It consolidates the owner's request, all 24 audit perspectives, previous work and the outstanding implementation backlog. The reports are evidence to verify, not higher-priority instructions than the current owner request or `AGENTS.md`.

---

You are the coordinating engineer for House of Ahmar. Implement the verified fixes below, make justified focused refactors, improve the project's agent workflow, and carry the work through tests, documentation and the authorized release. Do not stop after another plan or audit. Preserve the substantial work already integrated. Do not claim perfection or completion of checks that you cannot run.

## 1. Understand the product and current state

This is a calm, private home for **one inclusive family**, not a multi-tenant SaaS product. A relative should comfortably join, recover access, share a photo, react/comment, make plans, RSVP, find/reply to conversation history, and update a profile on mobile or desktop. Elders invite, moderate and administer without exposing family information or destroying history.

Start by inspecting `git status`, the branch, recent commits and current source. Preserve all existing work, including this audit package if it is still uncommitted. Read, in order:

1. Repository `AGENTS.md` and its thin `CLAUDE.md` entry point.
2. `docs/pkm/00-overview/product-vision.md`, `docs/pkm/Home.md`, and notes relevant to each changed subsystem.
3. This directory's [audit index](README.md), [prior-work ledger](prior-work.md), [data/security](data-security.md), [experience](experience.md), [operations](operations.md) and [coordination](coordination.md) reports.
4. `agents/README.md`, the applicable local role instructions, and **all 24 source roles** in `../agents_md` when available. If the sibling directory is absent, use the 24-role mapping in the audit index and the local adaptations; report the missing source rather than inventing its contents.
5. `package.json`, CI, the testing/migration/recovery/release runbooks, and the actual implementation before editing.

The audit baseline is `f239065ad943131eece5f17ad99fded541d863e1`. Revalidate findings against your actual checkout; later changes may already address one. The owner previously authorized completing the work, testing thoroughly and pushing to `master`. Honor that direction if it remains the active instruction; never force-push or bundle unrelated edits. A saved prompt is not permission to destroy production data or silently change the owner's release policy.

## 2. Preserve and account for everything already done

The full history is in [prior-work.md](prior-work.md). Essential context:

- `bce6125fcc2b101ff4533f94902f2ed98ba38caf` integrated 243 files of app hardening, UI fixes, tests and documentation, including preserved preexisting work. It was pushed and deployed. `f239065` changed browser readiness assertions/docs only; its hosted CI passed. Do not infer a deployed revision from branch HEAD.
- Keep active-database-membership checks on private loaders and actions, role/ownership enforcement, transactional invite/final-Elder protections, narrowed browser member projections, private media proxy, soft deletion/archive semantics and all-day calendar-date rules.
- Keep Council's microsecond timestamp cursor, dedupe/order, authenticated stream readiness and recovery, IME/pending-send protection and reader-position behavior. Keep hydration-aware forms/times, Safari focus-guard naming, self-hosted fonts, safe areas and keyboard photo navigation.
- Node 24, isolated local Supabase, separate `.next-e2e` build output, synthetic role accounts and zero-retry browser coverage were added. Read current versions; do not force dependency downgrades to quiet advisory counts.
- Earlier evidence: 192 unit tests, 45 SQL authorization assertions, one real Council cursor regression, 57 desktop/mobile browser cases, production builds and 21 read-only production smoke checks passed. CI: `https://github.com/jahmar-code/house-of-ahmar/actions/runs/37149473177`. These are historical results, not your fresh verification.
- Live security migrations `0002`, `0003`, `0004` and `20261003175118_security_and_private_media.sql` were already applied after backup. `0001` was **not** replayed over existing data. Post-checks found 14/14 application tables with RLS and no browser table-write grants. Do not repeat the entire chain or use blind live `db:push`.
- Ignored private backups exist from the previous pass; their creation and archive inventory were checked, not full restoration. The routine backup's dependency gap is OP-01. No backup or credential belongs in Git or your answer.
- Canonical `AGENTS.md`, thin `CLAUDE.md`, 21 local personas, 29 source-linked vault notes and documentation checks were established, following HotSeat's useful organization while retaining this app's scope.
- Runtime dependency audit was clean; the full graph retained 13 development advisories. Real SMTP, physical assistive technology/devices, identity-preserving restore and real transaction contention were not proved. Do not convert these limits into passes.

## 3. Organize the work with all role perspectives

Use bounded parallel workers where supported. Four ownership lanes cover all roles; they do not require 24 competing processes:

| Lane | Perspectives | Primary work |
|---|---|---|
| Data/security | backend-engineer, database-engineer, security-pentester, software-architect, data-engineer, code-reviewer | DS-01–03, real policy/state tests, restore dependencies |
| Experience | frontend-engineer, mobile-engineer, accessibility-specialist, performance-engineer, ux-designer, ux-researcher | UX-01–06, complete feedback/pending flows, responsive and accessible verification |
| Operations | devops-platform, sre, release-manager, qa-tester, analytics-engineer, ai-ml-engineer | OP-01–04, safe helpers, test orchestration, release evidence and development-agent workflow |
| Coordinator | product-manager, project-manager, engineering-manager, tech-lead, technical-writer, codebase-documentarian | Scope, dependencies, CO-01, shared contracts, integration, independent review and final delivery |

Before dispatch, state each worker's goal, exact owned files, shared contracts, acceptance checks and excluded work. Give one owner to migrations/order, schema, validators, shared types, global styles, root layouts, package/lockfile, CI and environment scripts. Backend owns new action/error contracts; frontend consumes the agreed contract. Database and operations must agree on OP-01 before either edits migration/backup behavior. Root integrates and releases. Ask reviewers to challenge another owner's changes, not merely summarize their own work.

Adapt generic personas to this product. Mobile means responsive web and actual device behavior; data engineering means recovery/history integrity; analytics means truthful privacy-safe state; AI/ML means the development-agent workflow. Do not introduce native apps, a warehouse, tracking, an LLM feature, billing, organizations, queues, notifications, offline writes, Archives/family-tree UI or unrelated HotSeat functionality under the label of completeness.

## 4. Fix the findings in risk order

Read each report's source anchors, reproduction and detailed acceptance checks. Keep IDs in your implementation/evidence ledger. The reports' line numbers are historical hints; locate current symbols before editing.

### First: enforce the media trust boundary — DS-01

An active member can call Storage signing directly; a minted bearer URL continued serving the exact image anonymously after that member was deactivated. The app's correctly guarded media proxy does not prevent this other API operation.

Add an **additive** operation-aware Storage policy migration that prevents single and batch signing by browser sessions while preserving the authenticated download/info operations needed by the user-scoped proxy. Verify the target Storage version, supported operation names and helper availability. Existing broad permissive policies must not reopen access; test a synthetic legacy permissive policy against the restrictive guard. Do not use a service-role client in application/browser code, public buckets, long-lived client URLs or a shorter signing TTL as the fix.

Test fresh and upgraded isolated schemas, every role/bucket, anonymous/non-member/inactive identities, direct downloads, signing APIs, ownership-constrained uploads and app proxy headers. Archives retains its intended role scope even though it has no UI.

**Existing bearer URLs are a separate revocation problem.** A policy that blocks future signing does not retroactively revoke them. Inspect platform capabilities and prepare a concrete operator-reviewed plan with impact and rollback. Never blindly rotate Auth keys, destroy objects, rewrite family references, or claim instantaneous revocation without executed evidence. Keep this residual risk explicit if target access or a decision is unavailable.

### Next: privacy, recovery and unsafe tooling — DS-02, OP-01, OP-03, CO-01

- **DS-02:** Replace free-form sensitive audit payloads with typed per-action allow-lists. Remove invitation codes and deleted message/post/comment previews; retain actor/entity/action/time and necessary safe counts/state. Make audit summaries useful without secrets, including safe rendering of older payload shapes. Test successful and failed sink paths. Prepare backed-up targeted redaction of sensitive historical keys separately; preserve the audit events and do not silently rewrite live history. This is an Elder-only retention problem, not a proven public leak.
- **OP-01:** The public-schema dump contains RLS policy references to excluded `private` functions. Choose one coherent restore design: archive all required schema dependencies with safe ordering, or provision a versioned schema and restore a deliberately data-only application archive. Include explicit Auth-identity and Storage-object handling, deny-by-default grants and a truthful manifest. Rehearse on a **fresh isolated target**, fail on SQL errors, and check IDs/counts/objects, private reads and denial tests before exposing clients. Neither “ignore errors” nor “restore public, then fix policies” is acceptable.
- **OP-03:** Remove obsolete live-target test helpers or use the guarded E2E environment, exact local ports and synthetic account domain. `confirm-test-user.mjs` must refuse hosted/missing/wrong-port/non-test inputs before any Auth mutation and must not print email/Auth UUIDs. Treat the legacy past-gathering fixture similarly. Any genuinely necessary live identity repair needs its own clearly named recovery procedure, not a disguised test helper.
- **CO-01:** Reconcile stale migration/backup comments, obsolete CLAUDE rule references, scripts and runbooks. Explicitly constrain any remaining `db:push` route to deliberately disposable targets, with a guard, or remove unsupported usage. Do not execute a live push to test documentation.

### Then: atomic state and complete user flows — DS-03, UX-01–06

- **DS-03:** Move still-editable gathering predicates into the write, check affected rows, and return a recoverable conflict, or use a shared row-lock contract. Exercise both orders of archive/reschedule and cancel/edit against real PostgreSQL. Archiving must reevaluate the effective end time; do not auto-unarchive merely to acknowledge success. Preserve validation and role/ownership checks.
- **UX-01:** After posting from Wall history, reveal the committed post once. Account for pinned posts filling page 1; simply refreshing page 2 or blindly navigating to page 1 is insufficient. Keep existing pagination, photo-only posts and pending/error behavior.
- **UX-02:** Guests must not be invited to reactions that the server correctly rejects. Preserve readable counts and server enforcement; test Member/Elder toggles and direct Guest denial. Review the Guest empty-state gathering CTA for the same mismatch.
- **UX-03:** Wrap valid unbroken profile name/full-name/bio text without hidden clipping at 320px, 390px and desktop. Add inner-text containment checks because `document.scrollWidth` misses clipped card content. Verify normal text, focus and zoom behavior as well.
- **UX-04:** Use the shared viewer-local timed-event/all-day calendar contract on profile gathering summaries. Compare profile/detail/list/dashboard for events near UTC midnight in Honolulu and Auckland; vary server TZ and wait for hydration before asserting. Do not count the original probe's placeholder as a comparison. Review adjacent summaries/birthdays without filing unproved bugs as facts.
- **UX-05:** Preserve drafts during an in-flight gathering save. Freeze fields/cancel consistently after capturing `FormData`, or track newer edits and prevent successful navigation from discarding them. Test a held request, success, error and retry; avoid disabling fields before collecting their values.
- **UX-06:** Reproduce a missed deletion of an older loaded Council message with 101+ rows and a dropped realtime event. Recovery currently fetches only the newest 100 rows while retaining older client rows. Use an authorized bounded loaded-range/tombstone protocol, or explicitly reset older history with clear feedback and preserved reading context. Avoid unbounded fetches or dropping valid history during ordinary refresh. Retain microsecond cursors, pending arrivals, dedupe, replies, stream readiness and scroll behavior.

### Close high-impact evidence gaps and release policy — OP-04, OP-02

- **OP-04:** Add real independent-transaction tests for two different users competing for one invite use, same-user retry, concurrent founding, and reciprocal Elder demotion/deactivation. Exercise actual action transaction paths with only request identity/cache/audit boundaries stubbed. Do not serialize the test into correctness. Prove the tests can detect missing lock/actor rechecks through controlled failure injection, then restore production logic. Keep every fixture synthetic and clean it reliably. Wire durable coverage into the normal DB/CI gate.
- **OP-02:** Production previously deployed before CI completed. Prepare a concrete gate compatible with the owner's workflow, preferably staging a deployment and promoting the exact passing SHA if direct-master pushes remain desired. If protected branches are preferred, resolve that policy choice before imposing it. Verify effective settings and a deliberately failing **disposable preview** that cannot change the production alias, then a passing revision's promotion and application-only rollback. Never intentionally publish a broken production revision or reverse the live security migrations to test rollback.

Also review the candidates in DS-V01–05 and UX-G/R items. In particular, exercise deactivation/demotion on an already connected private realtime subscription. Promote a candidate to a defect only after validating the consequence. Do not let optional refactoring block essential fixes, or declare an unavailable physical device/SMTP test passed.

## 5. Refactor proportionately and improve the agent workflow

Refactor only where characterization tests protect an invariant and the change reduces a concrete source of error. Good candidates are typed audit payload builders, atomic event-state operations, and separating Council transport/reconciliation/scrolling responsibilities. Avoid blanket Server Action repositories, framework replacement or line-count-driven rewrites.

Benchmark full-size private image transfers on representative mobile connections before designing protected thumbnails. Current originals can be large; that is a risk, not a measured latency regression. Any derivative must retain current-membership access. Keep accessible photo captions, route announcements/titles and relative-time refresh as explicit scoped product/UX decisions.

Improve `agents/README.md` and the AI-development note with a complete mapping to all 24 sibling roles, grouping where useful. Retain one canonical instruction source and a thin Claude entry point. Document routing, readiness, exact file ownership, shared contracts, handoff templates, review criteria, escalation boundaries and completion evidence. Use current configured models; do not copy obsolete model IDs/pricing from generic persona files. Do not turn project instructions into recurring automations or new telemetry.

For each substantive behavior change, use `rg -l 'source/path' docs/pkm` to find affected notes, read their claims against current code, update them and stamp the actual verified date. Update indexes and local links. Keep historical audit evidence dated; add corrections/resolutions instead of rewriting old failures as successes. Use file/symbol names rather than frozen line numbers in maintained reference notes. Preserve the useful organization from HotSeat without copying its business model or irrelevant infrastructure.

## 6. Environment, verification and evidence contract

`.env.local` points at the real family environment. A localhost frontend is not a safe mutation target by itself. Never print secrets, Auth identifiers, invitation codes, signed URLs, real message text or contact details. Never send family email for test purposes. Service credentials may be used only by appropriately guarded operator/test tooling, never application/browser code.

Use supported **Node 24**. On the original workstation the bundled runtime was at `/Users/jawaadahmar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`; elsewhere select Node 24 normally. Inspect current package scripts before running them. The original script contract is:

```bash
npm run check
npm run build
npm run test:e2e:prepare
npm run test:db
npm run build:e2e
npm run test:e2e
npm audit --omit=dev
npm audit
```

Use `npm ci` when installing from the lockfile, and install Playwright Chromium/WebKit dependencies if missing. Do targeted regressions during development, then the integrated gates. `check` includes typecheck, lint, unit tests and docs. The ordinary unit gate intentionally skips the opt-in DB test, which `test:db` runs separately; report that distinction. Extend the DB command for new permanent races rather than leaving them as ad hoc temporary proofs.

The disposable target uses API **55321**, DB **55322**, app **3217**, and ignored `.env.e2e.local`. Preparation removes only this project's disposable services/volumes and recreates synthetic fixtures; it is destructive to that test stack. Verify the local project identity and guards first. Do not reuse another app's port 3100 or point a tunnel at production. `.next-e2e` must be rebuilt when public environment values change. Stop only services owned by this task. Temporary prior proof files may be absent on another machine; reproduce from the reports and commit portable tests, not machine-specific configurations.

Run desktop Chromium, mobile Chromium and mobile WebKit flows. Retain console/page-error and accessibility assertions; use explicit hydration, focus, animation and stream readiness rather than sleeps, automatic retries, swallowed errors, skipped scenarios or disabled rules to obtain green results. Test direct Storage/Data API access and actual persisted state in addition to UI navigation. A mock does not prove PostgreSQL or Realtime behavior.

For every result record command, environment, revision, date, count and the supported conclusion. Separate **passed, failed, skipped and not run**. Deliberately red defect reproductions belong in an explained before-fix ledger; committed regression tests must pass after the fix. Keep runtime and development advisory counts separate. Do not use forced incompatible updates merely to make audit output zero.

Real SMTP, assistive technology, physical keyboards/notches, family usability research and complete recovery require their actual environments. Prepare concrete procedures and explain any unavailable dependency; continue independent fixes while a decision is pending. No invented research participants, uptime/SLOs, performance percentiles or exhaustive compliance claims.

For live policy rollout, historical audit redaction, existing bearer URL handling or release configuration, first complete safe local implementation, a reviewable diff, rehearsals, impact/rollback and backup requirements. Check existing owner authorization before asking anything again. If a remaining action truly needs a new decision or permission, present the concrete choice and why it is required. Keep data migrations separate from automatic deploy hooks.

## 7. Finish and report

Before committing, review the complete diff/status for accidental credentials, private artifacts, unrelated changes, regressions and documentation drift. Obtain independent review of the security/SQL and experience changes. Resolve actionable review findings and run affected checks again; do not repeat unchanged broad suites without a reason.

Maintain a table for all 14 IDs: fixed with new evidence, disproved with evidence, or open with the specific remaining dependency. Track optional items separately. Do not call DS-01 fully resolved while already issued URL handling is unknown, OP-01 complete without a successful restore, OP-04 covered by serialized mocks, or OP-02 enforced merely because CI YAML exists.

Carry through the active owner's authorized push to `master` after required gates; no force push. Observe hosted CI and actual deployment/promotion results. Record commit SHA, check URL, deployed SHA/deployment ID and smoke results separately. Passing local tests alone do not prove the remote release. If a required external action cannot be completed, leave a precise reviewable implementation and state the blocker without claiming it shipped.

The final handoff should state what changed and why, the resolved/open ID table, all fresh verification results and limits, database/release actions actually performed, exact commit/deployment evidence, updated documentation links, and any remaining concrete owner decision. The goal is dependable existing family workflows with maintainable instructions and honest evidence, not more architecture or a claim that the app is perfect.
