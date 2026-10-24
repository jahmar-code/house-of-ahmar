---
title: The Workshop
summary: Agent monitoring for the founders, on its own subdomain, with an operator allowlist kept apart from the family House.
source:
  - src/lib/workshop/access.ts
  - src/lib/workshop/status.ts
  - src/lib/workshop/queries.ts
  - src/lib/workshop/routing.ts
  - src/lib/workshop/constants.ts
  - src/app/actions/workshop.ts
  - src/app/workshop
  - src/components/workshop
  - src/lib/db/schema.ts
  - supabase/migrations/20261023120000_workshop_agents.sql
verified: 2026-10-23
tags: [domain, workshop, agents, security]
---

# The Workshop

The Workshop is a dashboard where the House's founders register the software agents they run, watch them live, share them with each other, and pause or stop them. It runs inside the same Next.js app and Supabase project as the House. It is served at the root of its own subdomain (for example `agents.kabul-afghanistan.ca`, set by `HOA_WORKSHOP_HOST`) and is also reachable at `/workshop` on any host.

It was added on 2026-10-23 at the owner's request as a deliberate, bounded exception to the "no unrelated features" rule in [AGENTS.md](../../../AGENTS.md). It shares nothing with family content.

## Two separate populations

| | House member | Workshop operator |
|---|---|---|
| Source of truth | `members` row, active | `operators` row, active |
| How access starts | Invitation code redeemed | Admin adds the email, *or* the email is in `HOA_WORKSHOP_ADMIN_EMAILS`; the first **confirmed** sign-in binds it |
| Sees family content | Yes | No. Being an operator grants nothing in the House |
| Sees agents | No (an Elder is not an operator by default) | Their own, plus agents explicitly shared with them |

One Supabase account can be both. Neither role implies the other. `getOperatorContext` in `src/lib/workshop/access.ts` resolves operators in this order:

1. A row bound to this `auth_user_id`. It must be active.
2. An unbound active row for the user's confirmed email. It is bound now, so a later email change cannot move it.
3. An env-listed admin email, which provisions an `admin` row.

A deactivated row is never re-provisioned from the env list.

## Permission matrix (canonical)

| Action | Owner | Shared operator | Admin (not owner) | Anyone else |
|---|---|---|---|---|
| See agent, status, runs, logs, metadata | ✓ | ✓ | ✗ | ✗ |
| Pause / resume / stop | ✓ | ✗ | ✗ | ✗ |
| Share / unshare, rename, rotate token, archive | ✓ | ✗ | ✗ | ✗ |
| Add / deactivate operators | — | — | ✓ | ✗ |

The sharing panel lists other operators by display name only; emails are visible only to admins on the Operators page. Workshop access depends on Supabase email confirmation being on; see [deployment](../50-operations/workshop-deployment.md#3-supabase-auth-confirmations-and-urls).

Admin is an operator-management role only. It deliberately does **not** reveal other operators' private agents. Every page and action enforces this itself through `visibleTo` / `loadVisibleAgent` and an owner check (`loadOwnedAgent` in `src/app/actions/workshop.ts`); the console layout is not a boundary. An unauthorized agent id renders not-found, so a page never confirms that the id exists.

Deactivating an operator hides their agents from everyone and makes ingest reject those agents' tokens. Reactivating restores both. `setOperatorActive` locks the table so concurrent changes cannot remove the last active admin.

## Agent state

- **Reported status** comes from the agent's heartbeat: `starting`, `running`, `idle`, `paused`, `error`, `stopping` or `stopped`.
- **Health** is what the UI shows (`computeHealth`). It is the reported status unless the agent has been silent longer than `max(90s, 3 × intervalSec)`, in which case it is `offline`. A `stopped` agent is never called offline. Before the first heartbeat it is `never` ("Not connected").
- **Desired state** (`run`, `pause` or `stop`) is set by the owner and returned on every ingest response. The UI shows "Pause requested" (and the like) until the agent's reported status acknowledges it (`pendingControl`).

Status changes, control requests and token rotations are written to `agent_events` automatically, so the activity log tells the story even for agents that send no logs.

## Pages

| Route | Purpose |
|---|---|
| `/workshop` | Summary tiles, "Your agents" and "Shared with you", sorted problems-first. Auto-refreshes every 10s while visible |
| `/workshop/agents/new` | Register an agent. The token is shown once |
| `/workshop/agents/[id]` | Status, facts, activity log with level filter, runs, plus owner-only controls, sharing and settings. Refreshes every 5s |
| `/workshop/connect` | Integration guide with copyable snippets for the current origin |
| `/workshop/operators` | Admin-only operator list |
| `/workshop/sign-in`, `/workshop/sign-up`, `/workshop/no-access` | Entry pages |

Live updates use `router.refresh()` polling (`AutoRefresh`), not Supabase Realtime. Each refresh re-runs the server-side access check, so a revoked share disappears on the next tick and no browser Data API policy is needed.

## Data

Five tables: `operators`, `agents`, `agent_shares`, `agent_runs` and `agent_events`; see [database schema](../40-reference/database-schema.md). RLS is enabled with no policies and no client grants, so they are reachable only through `DATABASE_URL`. Tokens are stored as SHA-256 hashes with a display hint. Archiving is a soft delete. Events older than 30 days are pruned by the retention cron; runs are kept.

## Related

[Agent ingest API](../40-reference/agent-ingest-api.md) · [Workshop deployment](../50-operations/workshop-deployment.md) · [Auth and security](../10-architecture/auth-and-security.md)
