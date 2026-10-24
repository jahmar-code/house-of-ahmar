import Link from "next/link";
import type { Metadata } from "next";
import { Bot, CirclePause, Plus, Radio, Share2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { AgentCard } from "@/components/workshop/agent-card";
import { AutoRefresh } from "@/components/workshop/auto-refresh";
import { StatTile } from "@/components/workshop/stat-tile";
import { requirePageOperator } from "@/lib/workshop/access";
import { listVisibleAgents, type AgentSummary } from "@/lib/workshop/queries";
import { needsAttention } from "@/lib/workshop/status";

export const metadata: Metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

// Problems first, then live work, then everything quiet.
function byUrgency(a: AgentSummary, b: AgentSummary) {
  const rank = (x: AgentSummary) => (needsAttention(x.health) ? 0 : x.health === "running" ? 1 : 2);
  return rank(a) - rank(b) || a.name.localeCompare(b.name);
}

export default async function WorkshopOverviewPage() {
  const ctx = await requirePageOperator();
  const all = await listVisibleAgents(ctx.operatorId);
  const mine = all.filter((a) => a.isOwner).sort(byUrgency);
  const shared = all.filter((a) => !a.isOwner).sort(byUrgency);

  const running = all.filter((a) => a.health === "running").length;
  const attention = all.filter((a) => needsAttention(a.health)).length;
  const paused = all.filter((a) => a.health === "paused" || a.health === "stopped").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Welcome, ${ctx.displayName}`}
        title="Agents"
        description="Everything you run, and everything your partners have shared with you."
      >
        <AutoRefresh />
        <Link href="/workshop/agents/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden="true" />
          New agent
        </Link>
      </PageHeader>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Running" value={running} icon={Radio} tone="live" />
        <StatTile
          label="Needs attention"
          value={attention}
          icon={TriangleAlert}
          tone={attention ? "attention" : "default"}
          hint="Errors or gone quiet"
        />
        <StatTile label="Paused or stopped" value={paused} icon={CirclePause} />
        <StatTile label="Shared with you" value={shared.length} icon={Share2} />
      </section>

      <section aria-labelledby="mine-heading" className="mt-10">
        <h2 id="mine-heading" className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Your agents
        </h2>
        {mine.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border">
            <EmptyState
              as="h3"
              icon={Bot}
              title="Register your first agent"
              description="Create an agent to get a token, then have it send heartbeats. It shows up here the moment it reports in."
            >
              <Link href="/workshop/agents/new" className={buttonVariants()}>
                <Plus className="size-4" aria-hidden="true" />
                New agent
              </Link>
            </EmptyState>
          </div>
        )}
      </section>

      <section aria-labelledby="shared-heading" className="mt-10">
        <h2 id="shared-heading" className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Shared with you
        </h2>
        {shared.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shared.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Nothing shared with you yet. When a partner shares an agent, it appears here.
          </p>
        )}
      </section>
    </div>
  );
}
