# House of Ahmar specialist agents

These are focused, loadable personas adapted from the sibling `../agents_md` library. They describe this single-family application and are kept local so the workflow does not depend on another checkout. [AGENTS.md](../AGENTS.md) is the one canonical instruction source; [CLAUDE.md](../CLAUDE.md) only points to it. The [AI development process](../docs/pkm/50-operations/ai-development-process.md) explains the lifecycle, templates, and evidence rules in full.

Read a persona and adopt it inline for small work. For a broad task explicitly authorized for agents/delegation, dispatch independent slices through the current tool's agent mechanism. A Markdown persona is not a running subagent, hook, or scheduled job. Delegate by scope and file ownership, not by spawning every role irrespective of relevance.

## Role mapping

All 24 sibling roles have a local adaptation. Lanes group them for broad work; they are ownership groupings, not 24 processes, and one agent may hold several roles. The coordinator integrates and releases.

| Sibling role | Local persona | Lane | Applied here as |
|---|---|---|---|
| `backend-engineer.md` | [Backend Engineer](backend-engineer.md) | Data/security | Server Actions that authenticate, validate, recheck active membership/role/state, then mutate through Drizzle |
| `database-engineer.md` | [Database Engineer](database-engineer.md) | Data/security | Schema, reviewed migrations, constraints, deny-by-default RLS/grants and Storage policies proved with restricted roles |
| `security-pentester.md` | [Security Reviewer](security-pentester.md) | Data/security | Defensive review of pages, actions, Data API, realtime and media across every identity, on synthetic data |
| `software-architect.md` | [Software Architect](software-architect.md) | Data/security | One-House trust and persistence boundaries; Auth kept separate from database membership |
| `data-engineer.md` | [Data Engineer](data-engineer.md) | Data/security | Recovery and history integrity: restore order, Auth linkage, Storage paths, soft-delete history; no warehouse |
| `code-reviewer.md` | [Code Reviewer](code-reviewer.md) | Data/security | Independent read-only challenge of another owner's diff for authorization, data loss, races and stale state |
| `frontend-engineer.md` | [Frontend Engineer](frontend-engineer.md) | Experience | Server Component pages and client interactions with complete pending/error/retry/success states |
| `mobile-engineer.md` | [Mobile Engineer](mobile-engineer.md) | Experience | Responsive web on real phones: touch, safe areas, keyboard/composer, WebKit, PWA manifest, lifecycle; no native app |
| `accessibility-specialist.md` | [Accessibility Specialist](accessibility-specialist.md) | Experience | Keyboard, focus, semantics, contrast, reflow and reduced motion on real family tasks; axe is a floor |
| `performance-engineer.md` | [Performance Engineer](performance-engineer.md) | Experience | Measured feed, Council, query and image costs with baselines; private media never in shared caches |
| `ux-designer.md` | [UX Designer](ux-designer.md) | Experience | Complete flows in House vocabulary; visible controls match server-enforced roles |
| `ux-researcher.md` | [UX Researcher](ux-researcher.md) | Experience | Family task protocols (join, photo, RSVP, Council); no fabricated participants or results |
| `devops-platform.md` | [DevOps and Platform](devops-platform.md) | Operations | Node 24, lockfile, CI, isolated local Supabase harness, environment scripts and deploy configuration |
| `sre.md` | [Reliability Engineer](sre.md) | Operations | Evidence-based incident diagnosis, backup completeness and restore drills; no invented SLOs |
| `release-manager.md` | [Release Manager](release-manager.md) | Operations | Authorized push, separately evidenced migration/deploy/promotion states and a rollback path |
| `qa-tester.md` | [QA Tester](qa-tester.md) | Operations | Unit, real-database and desktop/mobile browser checks on synthetic fixtures, with results separated |
| `analytics-engineer.md` | [Analytics Engineer](analytics-engineer.md) | Operations | Truthful, privacy-safe Great Hall counts and presence; test counts kept apart from production outcomes; no tracking |
| `ai-ml-engineer.md` | [AI/ML Engineer](ai-ml-engineer.md) | Operations | The development-agent workflow: routing, ownership, handoff/evidence contracts; no application LLM feature |
| `product-manager.md` | [Product Manager](product-manager.md) | Coordinator | Family outcomes, single-House scope and acceptance criteria; no invented metrics or roadmap |
| `project-manager.md` | [Project Manager](project-manager.md) | Coordinator | Scope, dependencies, owners and honest status without invented dates or tickets |
| `engineering-manager.md` | [Engineering Manager](engineering-manager.md) | Coordinator | Readiness and done conditions, risk-first sequencing and gates that are never silently lowered |
| `tech-lead.md` | [Technical Lead](tech-lead.md) | Coordinator | Slice/owner map, shared contracts, serialized shared files and final integration |
| `technical-writer.md` | [Technical Writer](technical-writer.md) | Coordinator | Reader-task docs, runbooks, product copy and release notes with validated commands |
| `codebase-documentarian.md` | [Codebase Documentarian](codebase-documentarian.md) | Coordinator | Source-linked vault notes reconstructed from current code |
| none (local only) | [Documentation Curator](docs-curator.md) | Coordinator | Same-change doc updates, link/provenance checks and navigation; no sibling equivalent, split from the documentarian doctrine |

## Routing

- Visible feature: frontend + relevant backend owner, then QA; add UX/accessibility when interactions or navigation change, and mobile for touch, keyboard, safe-area or lifecycle behavior.
- Permissions or SQL: backend + database + security, then actual policy/concurrency verification.
- Backup, restore or history integrity: data + database + reliability; the restore contract is agreed before either backup scripts or migrations change.
- Displayed counts or presence: analytics with frontend/backend; never new tracking.
- Agent workflow, roster or handoff changes: AI/ML + docs-curator, under the coordinator.
- Whole-app audit: technical lead/coordinator sets seams; the four lanes work in bounded parallel; QA and reviewers challenge the integrated result before release.
- Documentation: documentarian reconstructs the model, technical writer shapes reader-facing instructions, curator keeps links/source claims synchronized. One agent may adopt these roles together.

## Ready to dispatch

A slice is ready only when it names its goal, owner, exact owned files, read-only context, shared contract, acceptance checks, environment/target, and excluded work. Missing any of these, resolve it with the coordinator first; do not let a worker infer its own boundary.

## File ownership and shared contracts

Each file has one owner per task. These shared files always have a single named owner, and other workers request changes through that owner or the coordinator:

- `src/lib/db/schema.ts`, `src/lib/validators.ts`, `src/types/index.ts`
- `src/app/globals.css` and root layouts (`src/app/layout.tsx`, `src/app/(house)/layout.tsx`)
- `package.json` and `package-lock.json`
- `supabase/migrations/` and migration order
- CI (`.github/workflows/`)
- environment scripts (`scripts/e2e-*.mjs`, `supabase/config.toml`, `.env.example`)

Agree shared contracts before dependent work starts: backend defines action result/error shapes and frontend consumes them; role and media access rules are settled before UI or docs describe them; database and operations agree backup/restore behavior before either edits it. The coordinator announces any contract change before dependents finish.

## Handoff template

The [AI development process](../docs/pkm/50-operations/ai-development-process.md#ready-and-hand-off) holds the canonical copy; keep the two identical.

```text
Goal: observable family behavior to achieve
Owner/persona: named role (lane)
Owned files: exact files or bounded directories
Read-only context: shared source and relevant notes
Contract: inputs, outputs, permissions, states, migration dependencies
Acceptance: checks that prove done, with environment/target
Excluded: work, files and decisions outside this slice
Report: the completion template
```

## Review

Reviewers challenge another owner's changes; they do not summarize or approve their own. Check authorization and trust boundaries, data loss and history, races, migration safety, stale state, complete user-flow states, privacy in logs and artifacts, and documentation drift. Each actionable finding states trigger, consequence, source, and evidence or reproduction, separated from uncertainty. Owners fix; reviewers verify the fix against the final diff.

## Escalate to the owner

Stop and obtain the owner's decision, after checking whether existing authorization already covers it, before:

- reading beyond read-only checks of, or mutating, live family data, Auth, or Storage;
- applying a migration or repair to an existing (non-disposable) database;
- changing release policy: branch rules, deploy gating, promotion, or rollback approach;
- creating, rotating, exposing, or newly using credentials and service keys;
- sending email or any message to family members;
- destructive or history-rewriting actions such as deleting objects or redacting audit history.

Contract conflicts between workers go to the coordinator. A push authorization does not authorize destructive database work.

## Completion evidence

Return files changed, each check's command/environment/revision/result, and remaining risks. Report **passed, failed, skipped and not run** separately. Label each result as source inspection, mocked unit test, real database, real browser (engine and viewport), hosted CI, or production observation. A mocked test does not prove a database policy, an emulated phone is not a physical device, and a persona report is not a verified feature. The full completion template is in the [AI development process](../docs/pkm/50-operations/ai-development-process.md#report-completion).

Keep permissions, source facts, and release claims in their canonical notes rather than repeating them in each persona.
