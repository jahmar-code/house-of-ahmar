import Link from "next/link";
import { Activity, Share2, TriangleAlert } from "lucide-react";
import { ActivityTime } from "@/components/shared/activity-time";
import { cn } from "@/lib/utils";
import { needsAttention } from "@/lib/workshop/status";
import type { AgentSummary } from "@/lib/workshop/queries";
import { HealthBadge, PendingControl } from "./health-badge";

export function AgentCard({ agent }: { agent: AgentSummary }) {
  const attention = needsAttention(agent.health);
  return (
    <Link
      href={`/workshop/agents/${agent.id}`}
      className={cn(
        "group flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        attention ? "border-destructive/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-foreground group-hover:text-primary">
            {agent.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {agent.isOwner ? "Yours" : `Shared by ${agent.ownerName}`}
            {agent.version && <> · v{agent.version}</>}
            {agent.host && <> · {agent.host}</>}
          </p>
        </div>
        <HealthBadge health={agent.health} />
      </div>

      <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {agent.statusMessage ?? agent.description ?? "No status message yet."}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="size-3.5" aria-hidden="true" />
          {agent.lastHeartbeatAt ? <ActivityTime value={agent.lastHeartbeatAt} /> : "No heartbeat yet"}
        </span>
        {agent.errors24h > 0 && (
          <span className="inline-flex items-center gap-1.5 text-destructive">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {agent.errors24h} error{agent.errors24h === 1 ? "" : "s"} today
          </span>
        )}
        {agent.isOwner && agent.shareCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Share2 className="size-3.5" aria-hidden="true" />
            Shared with {agent.shareCount}
          </span>
        )}
        <PendingControl pending={agent.pending} />
      </div>
    </Link>
  );
}
