---
title: Release runbook
summary: From an integrated diff to a verified deployment with explicit migration state.
source:
  - package.json
  - AGENTS.md
  - scripts/backup.mjs
  - supabase/migrations
  - next.config.ts
verified: 2026-10-03
tags: [runbook, release]
---

# Release runbook

## Prepare

Read the task's authorized destination, current branch, `git status`, and final diff. The default working branch prefix is `codex/`; an explicit request to push `master` controls this task's destination. Do not include unrelated edits or force-push shared history.

Reconcile implementation contracts, migrations, tests, and docs. Review high-risk auth/media paths independently where practical. Run the required [testing gates](testing-strategy.md) and record their exact outcomes. Failed or unexecuted checks are limitations to resolve or report, not silent passes.

## Database and hosting

A Git push does not run SQL or confirm a deployment. Identify whether the change requires migrations, environment rebuild, Storage policy changes, Auth template/URL changes, or Realtime configuration. Prepare those artifacts and follow the task's deployment authorization separately from ordinary code editing. Back up before live data changes and use the [migration runbook](migration-runbook.md).

Keep a known deployable revision and a rollback plan. Schema rollback is not automatically safe: prefer forward fixes or expand/contract changes that allow the previous app version to operate. Do not restore a database backup merely to roll back CSS or a frontend deploy.

## Validate the resulting environment

1. Public front door and sign-in load without private content.
2. An active member can open Great Hall, Wall, Gatherings, Council, directory, and settings.
3. A guest sees permitted content, can RSVP, and cannot publish/member-write.
4. An Elder can use each admin area; unrelated users cannot reach it directly or invoke its actions.
5. Create a controlled post/RSVP/message only if the target permits test data; verify errors and refreshed state.
6. Private photos reject anonymous access; realtime respects private/archived chambers and inactive membership.
7. Confirm mobile navigation/composer and desktop layout, no unexpected browser errors, and auth confirmation/recovery URLs.

Production smoke should minimize writes to family data. Where production mutation testing is inappropriate, use a dedicated fixture environment and explicitly record the remaining deployed-state uncertainty.

## Release record

State commit, pushed branch, remote/deployment identity when observed, checks, migration application status, and any remaining blocker. If pushing succeeds but deployment was not observed, say exactly that. Link dated [audit evidence](../../audits/2026-10-03/README.md). Never equate compilation, a local screenshot, a merged commit, and a healthy deployed product.
