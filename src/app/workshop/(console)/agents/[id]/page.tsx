import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { ActivityTime } from "@/components/shared/activity-time";
import { AgentControls } from "@/components/workshop/agent-controls";
import { AgentSettings } from "@/components/workshop/agent-settings";
import { AutoRefresh } from "@/components/workshop/auto-refresh";
import { EventLog } from "@/components/workshop/event-log";
import { HealthBadge, PendingControl } from "@/components/workshop/health-badge";
import { RunsTable } from "@/components/workshop/runs-table";
import { SharePanel } from "@/components/workshop/share-panel";
import { db } from "@/lib/db";
import { loadVisibleAgent, requirePageOperator } from "@/lib/workshop/access";
import { getRequestOrigin } from "@/lib/workshop/origin";
import { getAgentEvents, getAgentRuns, getAgentStats, getShareTargets } from "@/lib/workshop/queries";
import { computeHealth, offlineAfterSeconds, pendingControl } from "@/lib/workshop/status";
import { eventLevelFilterSchema } from "@/lib/workshop/validators";

export const metadata: Metadata = { title: "Agent" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ level?: string }> };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}

export default async function AgentPage({ params, searchParams }: Props) {
  const ctx = await requirePageOperator();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  // The page's own boundary: owner or explicit share, else 404.
  const access = await loadVisibleAgent(ctx.operatorId, id);
  if (!access) notFound();
  const { agent, isOwner } = access;

  const level = eventLevelFilterSchema.parse((await searchParams).level);
  const [owner, runs, events, stats, shareTargets, origin] = await Promise.all([
    db.query.operators.findFirst({ where: (o, { eq }) => eq(o.id, agent.ownerId), columns: { displayName: true } }),
    getAgentRuns(agent.id),
    getAgentEvents(agent.id, level),
    getAgentStats(agent.id),
    isOwner ? getShareTargets(agent.id, ctx.operatorId) : Promise.resolve([]),
    getRequestOrigin(),
  ]);
  const health = computeHealth(agent);
  const pending = pendingControl(agent, health);

  return (
    <div>
      <Link
        href="/workshop"
        className="mb-4 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All agents
      </Link>

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground wrap-anywhere sm:text-3xl">{agent.name}</h1>
            <HealthBadge health={health} />
            <PendingControl pending={pending} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isOwner ? "You own this agent" : `Shared with you by ${owner?.displayName ?? "another operator"} · view only`}
          </p>
          {agent.statusMessage && <p className="mt-3 max-w-2xl text-sm text-foreground">“{agent.statusMessage}”</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh seconds={5} />
          {isOwner && <AgentControls agentId={agent.id} desiredState={agent.desiredState} />}
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="Last heartbeat">
          {agent.lastHeartbeatAt ? <ActivityTime value={agent.lastHeartbeatAt} /> : "Never"}
        </Fact>
        <Fact label="Offline after">{offlineAfterSeconds(agent.heartbeatIntervalSec)}s silent</Fact>
        <Fact label="Runs (24h)">{stats.runs24h}</Fact>
        <Fact label="Failed (24h)">{stats.failed24h}</Fact>
        <Fact label="Errors (24h)">{stats.errors24h}</Fact>
        <Fact label="Version · host">
          {[agent.version, agent.host].filter(Boolean).join(" · ") || "—"}
        </Fact>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Activity" description="Newest first. Status changes and owner actions are recorded automatically.">
            <EventLog agentId={agent.id} events={events} level={level} />
          </Section>
          <Section title="Runs" description="The 15 most recent.">
            <RunsTable runs={runs} />
          </Section>
        </div>

        <aside className="space-y-6">
          {agent.description && (
            <Section title="About">
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{agent.description}</p>
            </Section>
          )}
          {agent.metadata && Object.keys(agent.metadata).length > 0 && (
            <Section title="Reported metadata">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(agent.metadata, null, 2)}
              </pre>
            </Section>
          )}
          {isOwner && (
            <>
              <Section title="Sharing" description="Shared operators can watch, not control.">
                <SharePanel agentId={agent.id} targets={shareTargets} />
              </Section>
              <Section title="Settings">
                <AgentSettings
                  agentId={agent.id}
                  name={agent.name}
                  description={agent.description}
                  tokenHint={agent.tokenHint}
                  ingestOrigin={origin}
                />
              </Section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
