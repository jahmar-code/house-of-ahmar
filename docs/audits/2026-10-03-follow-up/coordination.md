# Product, delivery, documentation and coordination audit

Baseline: `f239065`, reviewed 2026-10-03. Audience: the owner and Claude implementing the follow-up. This lane reconciles specialist evidence and scopes the handoff; it does not make application changes or claim user research took place.

## Six leadership and documentation perspectives

| Sibling persona | Applied perspective | Result and limit |
|---|---|---|
| Product manager | Prioritize the family's outcomes: join, recover access, contribute, find history, make plans, converse, and administer privately | Preserve the single-House scope; prioritize privacy and broken implemented flows ahead of new features. No interviews, adoption metric or product demand is fabricated |
| Project manager | Keep scope, dependencies, ownership and unresolved decisions explicit | Four bounded lanes and one integrated backlog; implementation is delegated to the future Claude pass. No invented dates, throughput or confidence forecast |
| Engineering manager | Define readiness/done, sequence risk reduction and hold evidence gates | Every fix needs a reproducible trigger and acceptance check; production, SQL, source and local test results remain separate |
| Tech lead | Set shared contracts and integrate independent findings | Three specialist workers plus this coordinator cover 24 roles. Files shared by fixes require one owner; review proposals before schema, policy or release-contract changes |
| Technical writer | Produce a usable explanation/reference/how-to handoff for one implementer | New audit is a findings reference; prior-work is historical context; the Claude metaprompt is an implementation how-to. Keep those purposes separate and link them |
| Codebase documentarian | Reconstruct the source model and compare it with the documented invariants | Existing vault maps the main subsystems well, but fresh findings falsify some stronger privacy/recovery implications. Keep old evidence immutable and add dated corrections rather than laundering prior green checks into certainty |

## CO-01 — P2: Embedded migration instructions contradict the canonical safety contract

**Status:** Source-confirmed documentation/operator-safety defect.

**Trigger:** A developer or agent opens `drizzle.config.ts` to change a schema or reads the backup script's usage header. The former calls `npm run db:push` “the real workflow” against the live database and cites a nonexistent numbered critical rule in the now-thin `CLAUDE.md`. The latter says to back up before running `db:push` against the live House. These comments survive despite the canonical `AGENTS.md` and migration runbook explicitly forbidding blind live schema pushes.

**Evidence:** `drizzle.config.ts` schema-workflow comment, `scripts/backup.mjs` introductory instructions, `package.json` exposed `db:push` command, and `docs/pkm/50-operations/migration-runbook.md` fresh/existing-target recipes. The comments are actionable instructions in precisely the files an implementer opens at the risk boundary. The issue is inconsistent guidance, not evidence that somebody executed a destructive command.

**Fix:** Keep generated SQL output separate from curated migrations, but rewrite the stale instructions around the actual reviewed-migration workflow. Clearly limit `db:push` to deliberately disposable targets or remove it if the project has no supported use for it. If retaining an executable helper, make it fail safely before touching an unintended environment. Link the canonical runbook; remove obsolete CLAUDE rule references. Coordinate the backup header with OP-01 so instructions and implementation agree.

**Acceptance:** Read every surviving migration/backup command recommendation against the package scripts and runbook. A fresh maintainer can identify the empty-project route, existing-data route, generated-SQL inspection route and required backup/security checks without contradictory instructions. Do not run a live push to validate the documentation.

## Workflow refactor candidates, not new application defects

- **Role coverage:** The sibling library contains 24 roles. The local roster contains 21 because it adds a docs curator but omits dedicated mobile, data engineering, analytics and AI/ML adaptations. The audit covers all 24 source roles, but a future “load all local agents” invocation would not. Add a small explicit mapping or focused local adaptations if that will improve future routing. Treat responsive web/mobile lifecycle, data safety and agent-development concerns as applicable; do not create native apps, a warehouse, telemetry or an LLM product to fill the roster.
- **Evidence retention:** The release ledger correctly distinguishes static, mocked, real-DB, browser and production evidence, but exact subsequent CI success is currently reached through external run links rather than frozen in the original narrative. Future releases should record immutable commit/run/deployment IDs and a concise machine-readable result where practical. Avoid a recursive full redeploy merely to update a dated evidence note.
- **Refactor discipline:** The Council state synchronization, media policy/proxy contract, and mutation state checks deserve focused characterization tests before extraction. Do not replace the app's architecture or split every Server Action into extra layers just because a generic persona favors a pattern. Extract a boundary when multiple concrete defects demonstrate the same invariant needs one implementation.
- **No proof by file count:** Link/provenance checks establish navigation and source-path shape. They do not establish that an operational recipe restores a database or that every privacy claim holds. Pair security/recovery prose changes with executed boundary tests.

## Family outcomes and evidence still needed

| Outcome | Existing evidence | Follow-up focus |
|---|---|---|
| An invited relative joins and recovers access | Local signup/invite/recovery journeys | Real delivery/confirmation configuration; no surprise live confirmation override |
| A member shares something and sees success | Wall post/comment/reaction/photo tests | Visibility when posting from history, guest capability consistency, long valid content |
| Relatives can make and update plans | Gathering/RSVP/all-day browser tests | Atomic archive/edit state, timed timezone editing, pending-input preservation |
| Conversations remain accurate after disruption | Two-session delivery/recovery and cursor tests | Old loaded history after missed deletion; review whether the source's reconciliation contract can know that a retained older row was deleted |
| An Elder preserves a private, recoverable House | Roles/RLS/private media/source safeguards | Signed-URL revocation, sensitive audit metadata, real races, restore dependency order, enforced release policy |
| The House is comfortable on real phones | Chromium/WebKit emulation and screenshots | 320px valid content, nested clipping, real virtual keyboards and screen-reader task completion |

The purpose of this audit is dependable existing family workflows. Notifications, full-text search, account export/erasure, native apps, AI features, and the retained Archives/family-tree schema remain separate product decisions. Their absence is not automatically a defect.

## Delivery sequence and decision boundaries

Use a risk/impact ordering, not invented numerical scores or delivery dates. First establish and fix the actual server privacy boundary; next repair unsafe operational helpers, audit metadata and recovery contracts. Then repair state/data-loss and user-flow defects. Add the missing real concurrency and missed-event regressions, and agree on an enforced release gate.

Backend policy/state fixes and UI fixes can proceed independently after agreeing on action result/error semantics and media behavior. Schema/migrations, global styles, validators, package/lockfile, shared types, root layouts, CI and environment contracts each need one owner. Reconcile the whole result before publishing. The root Claude coordinator owns final review and already-authorized release work, not every specialist's implementation.

Operational decisions requiring real target information include existing signed-URL revocation, restore topology/identity handling, production email credentials, and hosting/branch promotion policy. Prepare concrete plans and safe local proofs first; do not guess credentials, loosen policy, impose a new branch workflow silently, send family email, or mutate production fixtures to make a report green.
