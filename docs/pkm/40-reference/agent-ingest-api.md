---
title: Agent ingest API
summary: The HTTPS contract agents use to report heartbeats, runs and logs to the Workshop and receive pause/stop.
source:
  - src/app/api/agents/v1/heartbeat/route.ts
  - src/app/api/agents/v1/runs/route.ts
  - src/app/api/agents/v1/events/route.ts
  - src/app/api/agents/v1/control/route.ts
  - src/app/api/agents/cron/prune/route.ts
  - src/lib/workshop/ingest.ts
  - src/lib/workshop/validators.ts
  - src/lib/workshop/tokens.ts
  - src/lib/workshop/constants.ts
  - tools/hoa-agent/hoa-agent.mjs
  - tools/hoa-agent/example.mjs
  - vercel.json
verified: 2026-10-23
tags: [reference, workshop, api]
---

# Agent ingest API

Agents push to the Workshop; the Workshop never connects to them. Base URL: the Workshop origin, e.g. `https://agents.<domain>.af`. Every endpoint is under `/api/agents/v1/`, and the proxy skips the cookie session for these paths.

## Authentication

`Authorization: Bearer hoa_agent_<43 base64url chars>`. The token is the whole credential.

- It is issued when the agent is registered or rotated, and shown once.
- The database stores `sha256(token)` and a hint.
- Unknown, archived or rotated-out tokens, and tokens whose owner is deactivated, all get the same `401`.

## Endpoints

| Method and path | Body | Success |
|---|---|---|
| `POST heartbeat` | `{ status, message?, version?, host?, intervalSec?, metadata? }` | `200 { ok, desiredState, desiredStateAt }` |
| `POST runs` | `{ runId, status, summary?, metrics?, startedAt?, endedAt? }` | `200 { ok, run: { id, runId, status }, desiredState, … }` |
| `POST events` | `{ events: [{ level?, message, data?, runId?, at? }] }` (1–100) | `202 { ok, accepted, desiredState, … }` |
| `GET control` | — | `200 { desiredState, desiredStateAt }` |

- `status` is `starting`, `running`, `idle`, `paused`, `error`, `stopping` or `stopped`.
- Run `status` is `running`, `succeeded`, `failed` or `cancelled`.
- Event `level` is `debug`, `info`, `warn` or `error`; the default is `info`.

### Semantics

- **Heartbeat** updates the agent's live fields. If the status changed, it also writes an activity event. Send one every `intervalSec` (default 30, allowed 5–3600). Missing three in a row (minimum 90s) shows the agent offline.
- **Runs** upsert on `(agent, runId)`. They are idempotent, and once a run has `endedAt` (terminal status) its status never changes again, so a delayed retry cannot reopen it. `summary` and `metrics` merge with `coalesce`. `endedAt` defaults to now for terminal statuses.
- **Events** may reference a run by your `runId`. Unknown ids are stored unlinked rather than rejected. `at` lets you backfill buffered lines.
- **Control**: every response carries `desiredState`. On `pause`, finish the current step and report `paused`. On `stop`, report `stopped` and exit. When it returns to `run`, resume. Only the owner can change it from the dashboard.

## Limits and errors

| Limit | Value |
|---|---|
| Request body | 64 KB (`413`) |
| `message` | 2000 chars; `summary`/heartbeat `message` 500 |
| `metadata`, `metrics` | 8 KB serialized each (overwritten or per run) |
| Event `data` | 2 KB serialized (accumulates, so kept small) |
| Rate | 120 requests/min per agent per server instance (`429` + `Retry-After`) |
| Daily budget | 10,000 stored events and 2,000 new runs per agent per rolling 24h, counted in Postgres by insert time (`429`, `Retry-After: 3600`). Updating an existing run is free. Over budget, heartbeats still land and only their status-change log line is skipped |
| Timestamps | No more than 5 minutes in the future |

Validation failures return `422 { error: "<field>: <reason>" }`. Malformed JSON returns `400`. Responses are `Cache-Control: no-store`. The per-minute limiter is per server instance; see [known limits](../50-operations/known-limitations.md). The daily budget is what bounds storage: worst case about 40 MB of events per agent per day, kept 30 days. Concurrent batches can overshoot it by at most one batch each.

Anyone the agent is shared with can read everything it reports. Never send secrets, customer data or full prompts.

## Reporter

`tools/hoa-agent/hoa-agent.mjs` is a zero-dependency Node 18+ client and CLI that reads `HOA_WORKSHOP_URL` and `HOA_AGENT_TOKEN`:

- `WorkshopAgent.start()` runs the heartbeat loop.
- `log()` buffers events and sends them in batches.
- `run(id, fn)` wraps a unit of work and reports success or failure.
- `onControl(cb)` and `waitWhilePaused()` handle control.
- `stop()` flushes and reports `stopped`.

CLI: `heartbeat`, `log`, `run` and `control`, for shell scripts and Claude Code hooks. `tools/hoa-agent/example.mjs` is a runnable worker. The in-app [Connect page](../20-domains/the-workshop.md) shows curl, Node, Python and Claude Code hook snippets for the current origin.

## Retention cron

`GET /api/agents/cron/prune` deletes `agent_events` older than 30 days. It requires `Authorization: Bearer $CRON_SECRET` (constant-time compare), which Vercel Cron sends automatically when `CRON_SECRET` is set. `vercel.json` schedules it daily at 04:17 UTC.
