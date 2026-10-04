# Full follow-up audit and Claude handoff

**Reviewed baseline:** `f239065ad943131eece5f17ad99fded541d863e1`, 2026-10-03. **Disposition: changes required.** This pass applied all 24 perspectives from the owner's sibling `../agents_md` library through three specialist audit workers and a coordinating lane. It reviewed the implemented family workflows, source, operational scripts and previous release evidence, with targeted synthetic reproductions. It is not a claim of exhaustive security, accessibility or device certification.

The earlier release improved the app substantially and passed its recorded gates. This follow-up identifies **14 actionable items: one P1 and thirteen P2**. Twelve concern implementation/documentation defects; two are a release-policy gap and a concurrency-verification gap. The application fixes below are **open**. This pass adds audit/handoff documentation, not application repairs or another production deployment.

> **Resolution update (2026-10-03, later the same day):** the implementation pass is recorded in [resolution and evidence](resolution.md). It fixes every finding locally with before/after evidence and two further defects (DS-04, DS-05). Live rollout, historical redaction, already-issued signed URLs, a hosted restore and the release gate await the owner. The text below is the original audit, unchanged.

## Read and continue

| Need | Document |
|---|---|
| Give Claude the complete implementation task | [Claude metaprompt](claude-metaprompt.md) |
| Understand everything already integrated, tested and released | [Prior work and release context](prior-work.md) |
| Inspect authorization, media, audit privacy and database findings | [Data and security](data-security.md) |
| Inspect mobile/desktop, interaction, accessibility and performance findings | [Experience](experience.md) |
| Inspect backup, scripts, release and test infrastructure findings | [Operations](operations.md) |
| Understand product scope, delivery order and documentation/workflow findings | [Coordination](coordination.md) |
| Check the earlier release's original evidence | [Original audit](../2026-10-03/README.md) and [verification ledger](../2026-10-03/verification.md) |

## Prioritized implementation backlog

P1 means address the privacy boundary first. P2 means a consequential defect or readiness gap that should be resolved in this follow-up. Evidence labels distinguish real execution from source review; a source finding is not a claimed browser pass.

| ID | Priority / type | Finding and acceptance boundary | Evidence | Detail / owner |
|---|---|---|---|---|
| DS-01 | P1 defect | Storage signing permits bearer photo URLs that keep serving after deactivation. Deny client signing while preserving authorized downloads; separately address already issued URLs | Real local upload, sign, deactivate, anonymous GET returned matching bytes | [Security](data-security.md#ds-01--p1-members-can-mint-bearer-media-urls-that-survive-deactivation); database + security |
| DS-02 | P2 defect | Audit metadata retains raw invite codes and deleted message text. Use safe per-action payloads and render no secret codes | Three deliberately red action contracts; mocked external edges | [Security](data-security.md#ds-02--p2-audit-metadata-duplicates-invitation-secrets-and-deleted-message-text); backend |
| DS-03 | P2 defect | An archive between read and write lets an edit acknowledge a hidden future gathering. Make state transitions atomic and return a recoverable conflict | Deliberately red real-action/real-PostgreSQL interleaving | [Security](data-security.md#ds-03--p2-a-concurrent-archive-can-turn-a-successful-edit-into-a-hidden-future-gathering); backend + database |
| OP-01 | P2 defect | Public-only backup omits private functions referenced by restored policies. Define and rehearse a complete supported restore order | Prior synthetic dumps and fresh local schema dump inspected; full restore not run | [Operations](operations.md#op-01--p2-public-only-backups-omit-helper-functions-required-by-their-policies); platform + database |
| OP-03 | P2 defect | Legacy test confirmation helper targets normal live credentials, can confirm real accounts, and logs identity details. Remove or strictly localize it and related fixtures | Source inspection; unsafe script deliberately not executed | [Operations](operations.md#op-03--p2-the-test-account-confirmation-helper-can-bypass-live-email-verification); platform |
| CO-01 | P2 documentation defect | Embedded instructions endorse live `db:push`, contradicting the migration runbook. Align comments, commands and guards | Source inspection | [Coordination](coordination.md#co-01--p2-embedded-migration-instructions-contradict-the-canonical-safety-contract); tech lead + writer |
| UX-01 | P2 defect | Posting from Wall page 2 reports success but hides the new post. Reveal the committed post, including when pins fill page 1 | Local Chromium plus persisted-row check | [Experience](experience.md#ux-01--p2--a-successful-post-from-an-older-wall-page-is-invisible); frontend |
| UX-02 | P2 defect | Guests see enabled reactions that always fail. Match visible capabilities to the enforced role and review restricted empty-state links | Local Guest interaction; server correctly rejected | [Experience](experience.md#ux-02--p2--guests-are-offered-reactions-that-always-fail); frontend |
| UX-03 | P2 defect | Valid long profile text clips inside a card at 320px while document-width checks pass. Assert text containment and readable wrapping | Local geometry and screenshot | [Experience](experience.md#ux-03--p2--valid-profile-text-is-clipped-at-narrow-widths); frontend + accessibility |
| UX-04 | P2 defect | Profile gathering summaries format the server's date instead of the viewer-local/all-day contract. Make all surfaces agree | Completed Auckland browser probe: Saturday on profile, Sunday on hydrated detail | [Experience](experience.md#ux-04--p2--a-members-gathering-summary-uses-a-different-calendar-date); frontend |
| UX-05 | P2 defect | Gathering fields stay editable during Save, then navigation discards the newer draft. Define pending and cancel behavior without losing input | Held real local Server Action, edited draft, persisted earlier value | [Experience](experience.md#ux-05--p2--gathering-edits-made-during-save-are-silently-discarded); frontend |
| UX-06 | P2 defect | Recovery's newest-100 snapshot cannot remove a missed deletion from older loaded Council history. Reconcile or explicitly reset the bounded older window | Real local browser/SQL probe with dropped UPDATEs: fresh snapshot rendered, deleted older text retained | [Experience](experience.md#ux-06--p2--recovery-cannot-remove-a-missed-deletion-from-loaded-older-history); frontend + backend |
| OP-04 | P2 verification gap | Invite/final-Elder invariants lack real independent-transaction race tests. Test contention without serializing it in the harness | Current test/source inspection; no broken lock asserted | [Operations](operations.md#op-04--p2-the-highest-impact-concurrency-invariants-lack-real-concurrent-transaction-tests); QA + database |
| OP-02 | P2 release-policy gap | Production can deploy before CI finishes. Enforce promotion of the exact passing revision, fitting the owner's direct-master preference | Read-only hosted deployment/check timestamps and effective branch rules | [Operations](operations.md#op-02--p2-production-deployment-can-precede-and-bypass-verification); release + owner decision |

DS-01 is continued retrieval from the server after revocation, not a promise to recall previously downloaded files. DS-02 is sensitive-data duplication in an Elder-only audit surface; no public leak was proven. OP-02 does not characterize the earlier owner-authorized push as unauthorized. OP-04 is missing evidence, not proof of faulty locking.

## Coverage of all 24 source personas

Each filename below refers to the sibling library; clone-independent instructions live in this repository's [agent roster](../../../agents/README.md). The specialist reports explain each role's actual checks and limits. Grouping perspectives into bounded lanes avoids competing edits and preserves one coordinating owner.

| Source persona | Lane / application |
|---|---|
| `backend-engineer.md` | Data/security — action validation, authorization and state transitions |
| `database-engineer.md` | Data/security — schema, constraints, transactions and policies |
| `security-pentester.md` | Data/security — direct API/media trust boundaries and local adversarial proofs |
| `software-architect.md` | Data/security — one-House architecture and boundary fitness |
| `data-engineer.md` | Data/security — identity, recovery dependencies and history integrity |
| `code-reviewer.md` | Data/security — independent challenge of prior changes and evidence |
| `frontend-engineer.md` | Experience — complete interactive flows and client state |
| `mobile-engineer.md` | Experience — responsive web, touch/composer and device gaps |
| `accessibility-specialist.md` | Experience — semantics, reflow, focus and assistive-technology limits |
| `performance-engineer.md` | Experience — image/query costs and measurement gaps |
| `ux-designer.md` | Experience — permissions, feedback, navigation and pending states |
| `ux-researcher.md` | Experience — family task protocol; no research results fabricated |
| `devops-platform.md` | Operations — scripts, environments, CI and dependency graph |
| `sre.md` | Operations — backup/restore, failure recovery and observability |
| `release-manager.md` | Operations — checked SHA, deployed SHA, promotion and rollback |
| `qa-tester.md` | Operations — test validity, isolation and missing race coverage |
| `analytics-engineer.md` | Operations — truthful product counts and privacy; no tracking introduced |
| `ai-ml-engineer.md` | Operations — development-agent workflow; no application AI subsystem assumed |
| `product-manager.md` | Coordination — family jobs, product boundaries and priorities |
| `project-manager.md` | Coordination — dependencies, scope and handoffs |
| `engineering-manager.md` | Coordination — readiness, evidence and completion standards |
| `tech-lead.md` | Coordination — shared contracts, ownership and integration |
| `technical-writer.md` | Coordination — implementation instructions and readable evidence |
| `codebase-documentarian.md` | Coordination — provenance, prior-work ledger and source/doc consistency |

No native app, warehouse, subscription system, telemetry SDK, AI feature, public social network, Archives UI or family-tree UI is required merely because a generic persona discusses it. The local roster currently omits four dedicated sibling adaptations and adds a docs curator; the handoff requests an explicit mapping, not unnecessary product expansion.

## Verification ledger and limits

**Earlier release, inherited evidence:** 192 unit tests, 45 SQL authorization assertions, one real Council cursor test, 57 browser cases, production builds, and 21 read-only production smoke checks passed. [Hosted CI 37149473177](https://github.com/jahmar-code/house-of-ahmar/actions/runs/37149473177) passed for `f239065`. The application deployed at `bce6125` has the same app source; do not assert that the later tests/docs commit was deployed without host evidence.

**This follow-up:** the three specialist reports record their actual source/API/catalog reviews and targeted local proofs. The four deliberately red security/action tests are regression demonstrations outside the committed suite. They are not a claim that the committed CI suite now fails. A fresh full dependency audit found the same 13 development advisories (9 high, 4 moderate).

| Fresh check | Result and scope |
|---|---|
| `npm run test:e2e:prepare` | Passed; fresh disposable local services and synthetic accounts |
| `npm run build:e2e` | Passed; isolated production test artifact |
| `npm run check` | Passed; type/lint, 192 tests in 13 files and documentation validation. One opt-in real-DB test skipped by this unit gate; not rerun through `test:db` in this pass |
| `npm run build` | Passed after moving aside the generated Turbopack cache. Initial sandbox attempt and first permitted retry failed with a compiler port-binding permission error; the clean-cache permitted retry succeeded without source changes |
| `npm run docs:check` | Passed; 70 Markdown files, 29 vault notes and 219 source paths. Local links checked again after the final ledger update |
| Targeted experience probes | All six defects reproduced locally; UX-04 required hydration readiness, UX-06 proved fresh snapshot application before asserting retained deleted text |
| Targeted security/data probes | DS-01 reproduced through real Storage; DS-02 demonstrated by three deliberately red mocked-edge action tests; DS-03 by one deliberately red real-DB action interleaving |
| `git diff --check` | Passed; tracked changes limited to the documentation index, with this new audit directory untracked for the handoff |

The full 57-case browser matrix, production smoke and live policy catalog audit were not rerun for this documentation-only pass. Physical devices/software keyboards, screen readers, real SMTP, full identity-preserving restore, actual transaction contention and production latency percentiles remain unverified. The completed timezone/history probes establish the defects, but permanent regression tests and the reports' broader acceptance cases still belong in implementation. The initial timezone probe's `…` detail text was inconclusive and was superseded by the completed hydrated comparison.

Synthetic browser evidence is ignored under `artifacts/audit-2026-10-03-follow-up/`. Temporary security/action reproductions are under `/private/tmp/hoa-follow-up-audit/`; those machine-local paths are diagnostic context, not prerequisites available in a fresh clone. Acceptance procedures in the reports must be implemented as durable repository tests by Claude. Never commit credentials, session state, signed URLs, live backups or family content as evidence.

## Completion standard for the next pass

Reproduce, fix, independently review and verify each confirmed defect. Keep optional refactors and product decisions explicit. For every ID, report fixed with fresh evidence, disproved with evidence, or still open with a concrete dependency; do not close items merely because the old suite stays green. Update affected source-backed notes with the implementation and record exact check/release revisions. The [metaprompt](claude-metaprompt.md) supplies the execution order, shared contracts, safe environments and final deliverables.
