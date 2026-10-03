---
title: AI development process
summary: Focused specialist routing, shared-file ownership, integration, and evidence.
source:
  - AGENTS.md
  - CLAUDE.md
  - agents/README.md
  - package.json
  - docs/pkm/README.md
verified: 2026-10-03
tags: [workflow, agents]
---

# AI development process

The workflow borrows HotSeat's useful separation of instructions, specialist judgment, durable knowledge, and verification. It does not import HotSeat's tickets, SaaS roles, branch restrictions, booking domain, or undocumented tooling assumptions.

## Instruction layers

| Layer | Purpose |
|---|---|
| User request and active tool instructions | Task authorization, priorities, platform restrictions |
| `AGENTS.md` | Canonical House engineering rules |
| `CLAUDE.md` | Pointer for clients that load that entry point |
| `agents/*.md` | Local discipline-specific judgment and completion format |
| `docs/pkm` | Source-verified knowledge, loaded only where needed |
| `docs/audits/<date>` | Findings and actual execution evidence |

Personas are Markdown instructions, not a background process. In a tool with subagents, the coordinator dispatches them explicitly when authorized; otherwise the current agent reads/adopts the relevant role inline. No task is complete merely because several personas wrote reports.

## Shape and route

Start with the affected family outcome, observable acceptance criteria, current source, and available environment. Use product/UX roles to clarify outcomes; technical lead/architect roles identify contracts and dependency order. Dispatch independent work only when each slice has a concrete owner and useful parallel work exists.

Use this handoff:

```text
Goal: observable family behavior to achieve
Owner/persona: named role
Owned files: exact files or bounded directories
Read-only context: shared source and relevant notes
Contract: inputs, outputs, permissions, states, migration dependencies
Constraints: privacy, user authorization, environment, shared files
Done: implementation + appropriate tests + source-linked findings
Report: files, rationale, checks/outcomes, unresolved risks
```

Frontend, backend/security, and docs can often proceed in parallel after agreeing on role/media/action contracts. Package/lockfile/CI changes have one owner. Schema and migration numbering serialize under the database owner. The coordinator communicates changed contracts before dependents finalize.

## Integrate and challenge

1. Each specialist returns a concise evidence report and owned files.
2. Coordinator resolves overlaps and reviews the combined diff, including intended behavior versus UI controls.
3. QA covers full flows and failure modes; accessibility/performance assess representative screens and actual bottlenecks.
4. Code reviewer examines authorization, data integrity, stale state, and regressions independently; actionable findings include reproduction, impact, and source.
5. Owners fix findings; rerun checks justified by the changes. Do not repeatedly run unrelated suites after a clean gate without reason.
6. Documentation owner reconciles source contracts, migration state, and limitations. Run link/provenance checks.
7. Release owner verifies the final integrated state and handles the already-authorized push/deploy steps, recording what actually occurred.

## Durable memory

Update notes in the same change as behavior. `source` paths locate affected knowledge; `verified` stamps require a real source read. Repeated failure modes deserve a focused regression check or procedure, not an ever-longer root instructions file. Keep one canonical permission matrix, migration recipe, and command contract; link to them.

For a new audit, use a dated directory containing scope/findings/fixes/evidence/blockers. Keep `BUILD_STATUS.md` brief and current. Never propagate a prior task's unverified claim into release status.
