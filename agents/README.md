# House of Ahmar specialist agents

These are focused, loadable personas adapted from the sibling `../agents_md` library. They describe this single-family application and are kept local so the workflow does not depend on another checkout. [AGENTS.md](../AGENTS.md) is the shared instruction source; [AI development process](../docs/pkm/50-operations/ai-development-process.md) defines handoffs and integration.

Read a persona and adopt it inline for small work. For a broad task explicitly authorized for agents/delegation, dispatch independent slices through the current tool's agent mechanism. A Markdown persona is not a running subagent or automatic hook. Delegate by scope and file ownership, not by spawning every role irrespective of relevance.

| Persona | Responsibility |
|---|---|
| [Product Manager](product-manager.md) | Vision, acceptance criteria, prioritization, and honest product status. |
| [UX Designer](ux-designer.md) | Navigation, interaction states, flow design, and clear supporting copy. |
| [UX Researcher](ux-researcher.md) | Usability task plans, reproducible observations, and adoption questions. |
| [Software Architect](software-architect.md) | Cross-cutting boundaries, irreversible decisions, reliability, and technical tradeoffs. |
| [Backend Engineer](backend-engineer.md) | Server Actions, resource-state rules, auth context, and domain logic. |
| [Database Engineer](database-engineer.md) | Drizzle schema, SQL migrations, constraints, RLS/grants, and query behavior. |
| [Frontend Engineer](frontend-engineer.md) | Pages/components, responsive layout, forms, navigation, and client state. |
| [Accessibility Specialist](accessibility-specialist.md) | Deep accessibility review beyond automated scan results. |
| [Performance Engineer](performance-engineer.md) | Browser/server/query latency, render work, image loading, and resource use. |
| [Security Reviewer](security-pentester.md) | Authorized defensive auth/privacy review and regression tests. |
| [QA Tester](qa-tester.md) | Unit/integration/browser checks, reproduction, fixtures, and evidence. |
| [Code Reviewer](code-reviewer.md) | Independent read-only review of the diff and affected contracts. |
| [DevOps and Platform](devops-platform.md) | CI, local environments, build/test reproducibility, and deployment machinery. |
| [Reliability Engineer](sre.md) | Incident diagnosis, recoverability, backups, and operational evidence. |
| [Release Manager](release-manager.md) | Release sequencing, final gates, migration/deploy coordination, and outcome. |
| [Codebase Documentarian](codebase-documentarian.md) | Knowledge vault, architecture/domain/flow maps, and source provenance. |
| [Documentation Curator](docs-curator.md) | Same-change documentation updates and navigation consistency. |
| [Technical Writer](technical-writer.md) | Clear README/runbook/reference text, product copy, and release notes. |
| [Engineering Manager](engineering-manager.md) | Bounded work-in-progress, integration checkpoints, and delivery risk. |
| [Project Manager](project-manager.md) | Work breakdown, change control, status, and coordination records. |
| [Technical Lead](tech-lead.md) | Task decomposition, shared contracts, sequence, and final technical coherence. |

## Typical routing

- Visible feature: frontend + relevant backend owner, then QA; add UX/accessibility when interactions or navigation change.
- Permissions or SQL: backend + database + security, then actual policy/concurrency verification.
- Whole-app audit: technical lead/coordinator sets seams; frontend/UX, backend/security/data, and docs can work in bounded parallel lanes; QA/reviewer challenge the integrated result before release.
- Documentation: documentarian reconstructs the model, technical writer shapes reader-facing instructions, curator keeps links/source claims synchronized. One agent may adopt these roles together.

Every handoff names the goal, owned files, shared contract, constraints, and required evidence. Every completion report names changes, checks/outcomes, and unresolved risks. Do not count a persona report as a verified feature. Keep permissions, source facts, and release claims in their canonical notes rather than repeating them in each persona.
