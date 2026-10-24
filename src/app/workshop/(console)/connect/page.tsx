import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CodeBlock } from "@/components/workshop/code-block";
import { requirePageOperator } from "@/lib/workshop/access";
import { getRequestOrigin } from "@/lib/workshop/origin";
import { INGEST_LIMITS, REPORTED_STATUSES } from "@/lib/workshop/constants";

export const metadata: Metadata = { title: "Connect an agent" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[2.5rem_minmax(0,1fr)]">
      <span className="flex size-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-mono text-sm font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 space-y-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default async function ConnectPage() {
  await requirePageOperator();
  const origin = await getRequestOrigin();

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Integration"
        title="Connect an agent"
        description="Agents push to the Workshop over HTTPS with their own token. Anything that can make an HTTP request can report: a Node or Python service, a cron job, a Claude Code hook."
      />

      <div className="space-y-10">
        <Step n={1} title="Register the agent and keep its token">
          <p className="text-sm text-muted-foreground">
            Create it from <span className="text-foreground">Agents → New agent</span>. Store the token in the agent&apos;s
            environment, never in source control.
          </p>
          <CodeBlock label="Environment" code={`HOA_WORKSHOP_URL=${origin}\nHOA_AGENT_TOKEN=hoa_agent_…`} />
        </Step>

        <Step n={2} title="Send heartbeats">
          <p className="text-sm text-muted-foreground">
            Every 30 seconds or so. Without one for three intervals (minimum 90s) the agent shows as offline. Status is one of{" "}
            {REPORTED_STATUSES.map((s, i) => (
              <span key={s}>
                <code className="font-mono text-foreground">{s}</code>
                {i < REPORTED_STATUSES.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
          <CodeBlock
            label="curl"
            code={`curl -X POST ${origin}/api/agents/v1/heartbeat \\
  -H "Authorization: Bearer $HOA_AGENT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"running","message":"Indexing inbox","version":"1.4.0","intervalSec":30}'

# → {"ok":true,"desiredState":"run","desiredStateAt":"…"}`}
          />
        </Step>

        <Step n={3} title="Obey pause and stop">
          <p className="text-sm text-muted-foreground">
            Every response carries <code className="font-mono text-foreground">desiredState</code>:{" "}
            <code className="font-mono text-foreground">run</code>, <code className="font-mono text-foreground">pause</code>{" "}
            or <code className="font-mono text-foreground">stop</code>. When it changes, finish the current step, then report{" "}
            <code className="font-mono text-foreground">paused</code> or <code className="font-mono text-foreground">stopped</code>{" "}
            so the dashboard knows you complied. Only the owner can change it.
          </p>
        </Step>

        <Step n={4} title="Report runs and logs (optional)">
          <CodeBlock
            label="Runs: upsert by your own runId"
            code={`curl -X POST ${origin}/api/agents/v1/runs \\
  -H "Authorization: Bearer $HOA_AGENT_TOKEN" -H "Content-Type: application/json" \\
  -d '{"runId":"nightly-2026-10-23","status":"succeeded","summary":"Synced 40 records","metrics":{"records":40,"costUsd":0.12}}'`}
          />
          <CodeBlock
            label={`Events: up to ${INGEST_LIMITS.eventsPerBatch} per request`}
            code={`curl -X POST ${origin}/api/agents/v1/events \\
  -H "Authorization: Bearer $HOA_AGENT_TOKEN" -H "Content-Type: application/json" \\
  -d '{"events":[{"level":"warn","message":"Rate limited by upstream, backing off","runId":"nightly-2026-10-23"}]}'`}
          />
        </Step>

        <Step n={5} title="Or use the reporter">
          <p className="text-sm text-muted-foreground">
            <code className="font-mono text-foreground">tools/hoa-agent/hoa-agent.mjs</code> in the House repository is a
            single zero-dependency file. Copy it next to your agent.
          </p>
          <CodeBlock
            label="Node"
            code={`import { WorkshopAgent } from "./hoa-agent.mjs";

const agent = new WorkshopAgent(); // reads HOA_WORKSHOP_URL and HOA_AGENT_TOKEN
agent.onControl((state) => state === "stop" && agent.stop().then(() => process.exit(0)));
await agent.start({ version: "1.0.0" });

await agent.run("job-42", async (run) => {
  run.log("Fetching leads");
  return { summary: "Processed 12 leads", metrics: { leads: 12 } };
});`}
          />
          <CodeBlock
            label="Python (requests)"
            code={`import os, requests
W = os.environ["HOA_WORKSHOP_URL"]; H = {"Authorization": f"Bearer {os.environ['HOA_AGENT_TOKEN']}"}
state = requests.post(f"{W}/api/agents/v1/heartbeat", json={"status": "running"}, headers=H, timeout=10).json()["desiredState"]`}
          />
          <CodeBlock
            label="Claude Code hook (.claude/settings.json)"
            code={`{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node ~/hoa-agent.mjs heartbeat --status running --message 'Session started'" }] }],
    "Stop":         [{ "hooks": [{ "type": "command", "command": "node ~/hoa-agent.mjs heartbeat --status idle --message 'Waiting for input'" }] }],
    "SessionEnd":   [{ "hooks": [{ "type": "command", "command": "node ~/hoa-agent.mjs heartbeat --status stopped" }] }]
  }
}`}
          />
        </Step>

        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <h2 className="mb-2 text-sm font-semibold text-foreground">What partners can see</h2>
          <p>
            Anyone you share an agent with can read its status, metadata, runs and every log line. Don&apos;t report secrets,
            customer data or full prompts. Messages are capped at {INGEST_LIMITS.messageChars} characters, event data at{" "}
            {INGEST_LIMITS.eventDataBytes / 1024} KB, metadata and metrics at {INGEST_LIMITS.jsonBytes / 1024} KB. Each agent may
            store {INGEST_LIMITS.eventsPerDay.toLocaleString("en-US")} events and start{" "}
            {INGEST_LIMITS.runsPerDay.toLocaleString("en-US")} runs per day. Events are kept for 30 days.
          </p>
        </section>
      </div>
    </div>
  );
}
