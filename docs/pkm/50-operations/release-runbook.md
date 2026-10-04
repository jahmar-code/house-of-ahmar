---
title: Release runbook
summary: From an integrated diff to a verified deployment with explicit migration state.
source:
  - package.json
  - AGENTS.md
  - scripts/backup.mjs
  - supabase/migrations
  - next.config.ts
  - .github/workflows/ci.yml
  - .github/workflows/promote.yml
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

## Production gate

Today a push to `master` starts Vercel's Git-integrated production deployment at the same time as `.github/workflows/ci.yml`; a failing change can be live before verification finishes (follow-up audit OP-02, observed for `bce6125`). Configuration alone is not a gate.

The prepared gate keeps direct-master pushes and makes production follow verification instead of racing it. `.github/workflows/promote.yml` runs when "App verification" completes successfully for a push to `master`. It checks out that exact `head_sha`, refuses if `master` has already moved on, builds with the production environment and deploys it with the Vercel CLI, recording the deployment URL in the job summary. It never runs SQL. It is inert until the owner enables it, because enabling changes the release policy and needs credentials:

1. Create a Vercel token scoped to the House project and add repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, preferably on a `production` environment that only `master` can use.
2. Set repository variables `VERCEL_CLI_VERSION` (a reviewed, pinned CLI version) and `HOA_PROMOTE_VERIFIED=true`.
3. In the same commit, add `vercel.json` with `{"git": {"deploymentEnabled": {"master": false}}}` so Git pushes to `master` no longer deploy production by themselves. Other branches keep preview deployments.
4. Read the effective settings back (variables, environment rules, Vercel Git settings) and record them.

Prove it without touching production. In a drill branch, temporarily add that branch to both workflows' branch filters and change the deploy step to a preview (`vercel deploy --prebuilt`, never `--prod`). Push a deliberately failing commit and confirm the promotion job is skipped and no deployment exists for its SHA; push a passing commit and confirm a preview deployment of exactly that SHA. Delete the drill branch. Then, after enabling, confirm a normal `master` push produces no Git-triggered production deployment and that its promotion run deploys exactly its `head_sha` (compare the summary URL's commit). The first enabled run also proves whether `vercel build` needs the token; it is deliberately withheld from that step. Protected branches with required checks are the alternative if direct pushes stop being wanted; that is an owner decision, not a silent change.

Rollback is application-only: promote the previous production deployment (Vercel Instant Rollback / `vercel rollback`). Never reverse the live security migrations or restore family data to roll back an application release.

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
