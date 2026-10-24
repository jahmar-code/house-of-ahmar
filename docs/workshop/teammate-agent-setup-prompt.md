# Workshop teammate setup: metaprompt for your Claude agent

Hand everything below the line to your own Claude agent (Claude Code or similar) on the machine where your agents run. Before you do, replace `<WORKSHOP_URL>` with the Workshop address you were given (for example `https://agents.example.af`). The canonical API contract is [agent ingest API](../pkm/40-reference/agent-ingest-api.md).

---

You are helping me connect my running software agents to **the Workshop**, a private monitoring dashboard my cofounder hosts at `<WORKSHOP_URL>`. Once connected, I'll see my agents' live status, runs and logs there. I can share chosen agents with my cofounder, who can watch but not control them, and I can pause, resume or stop them from the dashboard. Work through the steps below in order. Stop and ask me whenever a step needs me (anything in a browser, or a choice only I can make). Don't guess.

## Ground rules

- Never commit, print in full, or log an agent token. Tokens look like `hoa_agent_…`. Keep them in the environment or the secret store each agent already uses (`.env` that is gitignored, launchd/systemd environment, the hosting provider's secrets, 1Password CLI). If you find one in a tracked file, stop and tell me.
- Everything an agent reports is readable by anyone I share it with. Never report secrets, API keys, customer data, personal data or full prompts/completions. Report short operational status: what it's doing, counts, durations, costs, error summaries.
- Don't change what my agents do. Add reporting around their existing work, plus pause/stop handling at safe checkpoints.
- Reporting must never crash or block an agent. If the Workshop is unreachable, log locally and continue.

## Step 1 — My access (I do this; you guide me)

1. Ask me whether my cofounder has already added my email on the Workshop's **Operators** page, or listed me as an admin. If not, I need to ask them first.
2. Have me open `<WORKSHOP_URL>/workshop/sign-up`, create an account with **that exact email**, and click the confirmation email. Then I sign in at `<WORKSHOP_URL>`.
3. If I see "You're not on the operator list", the email doesn't match what was added, or isn't confirmed yet. Help me sort that out before continuing.

## Step 2 — Inventory my agents

Find the long-running or scheduled agents on this machine and in the repositories I point you to: services, workers, cron jobs, bots, Claude Agent SDK apps, and Claude Code sessions I want tracked. List each one with: what it does, where it runs, its language/runtime, how it's started, where its secrets live, and whether it has a main loop or discrete jobs. Show me the list and ask which ones to connect. Use one Workshop agent per independently running process.

## Step 3 — Register each agent and store its token (I click; you store)

For each agent I choose:

1. Have me go to **Agents → New agent** in the Workshop, give it a clear name and description, and copy the token it shows once.
2. Ask me to paste the token where you can store it securely, alongside that agent's existing secrets, as:
   ```
   HOA_WORKSHOP_URL=<WORKSHOP_URL>
   HOA_AGENT_TOKEN=hoa_agent_…
   ```
3. Confirm the storage location is not tracked by git (`git check-ignore`).

## Step 4 — Add reporting

The API is plain HTTPS with `Authorization: Bearer $HOA_AGENT_TOKEN`:

| Call | Body | Use |
|---|---|---|
| `POST <WORKSHOP_URL>/api/agents/v1/heartbeat` | `{"status":"running","message":"…","version":"…","intervalSec":30,"metadata":{…}}` | Every ~30s, and whenever status changes. Status is one of `starting`, `running`, `idle`, `paused`, `error`, `stopping`, `stopped` |
| `POST …/runs` | `{"runId":"your-id","status":"running"\|"succeeded"\|"failed"\|"cancelled","summary":"…","metrics":{…}}` | Optional. Start and finish discrete jobs; upserts by `runId` |
| `POST …/events` | `{"events":[{"level":"info"\|"warn"\|"error"\|"debug","message":"…","runId":"…"}]}` | Optional log lines, up to 100 per call |
| `GET …/control` | — | Returns `{"desiredState":"run"\|"pause"\|"stop"}`. Every response above includes it too |

Limits: 2000-char messages, 2 KB event `data`, 8 KB `metadata`/`metrics`, 120 requests/min, 10,000 events and 2,000 new runs per agent per day. On `429`, honour `Retry-After` and drop low-value logs. On `401`, the token is wrong, rotated or archived: stop reporting and tell me.

Pick the lightest integration that fits each agent:

- **Node.js**: download the zero-dependency reporter from `https://raw.githubusercontent.com/jahmar-code/house-of-ahmar/master/tools/hoa-agent/hoa-agent.mjs` (if it isn't on `master` yet, use the `codex/agent-dashboard` branch). Vendor it next to the agent. Use `new WorkshopAgent()`, `onControl()`, `start({ version })`, `run(id, fn)`, `log()`, `waitWhilePaused()`, and `stop()` on shutdown. `tools/hoa-agent/example.mjs` in that repo is a complete worker to copy from.
- **Python or other languages**: write a small client around the four calls (for example with `requests`/`httpx` and timeouts of 10s or less). Heartbeat in a background thread or task, and read `desiredState` from each response.
- **Shell scripts and cron jobs**: call the reporter CLI, e.g. `node hoa-agent.mjs heartbeat --status running --message "…"`, `node hoa-agent.mjs run --id "$RUN" --status succeeded --summary "…"`, `node hoa-agent.mjs log --level warn "…"`. Or use curl with `--max-time 10`. For a job that runs every N minutes, send a heartbeat with `intervalSec` slightly above N so it isn't shown offline between runs.
- **Claude Code sessions**: add hooks in that project's `.claude/settings.json` that call the CLI. `SessionStart` reports `running`, `Stop` reports `idle` ("Waiting for input"), `SessionEnd` reports `stopped`. Keep the hook commands fast and make them always exit 0 (append `|| true`).

## Step 5 — Honour pause and stop

The Workshop only asks; the agent decides when it's safe. At a natural checkpoint (between jobs, loop iterations or tool calls):

- On `pause`: finish the current step, report `paused`, poll `control` (or keep heartbeating) until it returns `run`, then report `running` and continue.
- On `stop`: finish the current step, flush logs, report `stopped`, and exit cleanly. Make sure the supervisor (launchd, systemd, pm2, Docker restart policy) doesn't immediately restart it. If it would, ask me how I want that handled.
- Never interrupt a step mid-write or leave external state half-done to honour a control request.

## Step 6 — Verify each agent and share

1. Start the agent. Within one interval it should appear in the Workshop as **Running**, with its message and version.
2. Have me click **Pause** in the Workshop. Confirm the agent reaches a checkpoint and the badge turns **Paused**. Then have me click **Resume** and confirm it continues.
3. If it reports runs or logs, confirm they appear on the agent's page.
4. Ask me which agents to share with my cofounder. I toggle that in the agent's **Sharing** panel (they can watch, not control).
5. Stop the agent the normal way and confirm it reports **Stopped**, not Offline.

## Step 7 — Report back

Give me a short table: agent name, where it runs, integration type, where its token is stored, verified (yes/no), shared with cofounder (yes/no), and anything left to do. Also list every file you changed. To rotate a token later, I click **Rotate token** on the agent's page and you update the stored value; the old one stops working immediately.
