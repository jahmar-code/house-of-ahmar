import { ActivityTime } from "@/components/shared/activity-time";
import { cn } from "@/lib/utils";

type Run = {
  id: string;
  externalId: string;
  status: string;
  summary: string | null;
  metrics: Record<string, unknown> | null;
  startedAt: Date;
  endedAt: Date | null;
};

const STATUS_STYLE: Record<string, string> = {
  running: "text-success",
  succeeded: "text-foreground",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

function duration(run: Run): string {
  if (!run.endedAt) return "—";
  const sec = Math.max(0, Math.round((run.endedAt.getTime() - run.startedAt.getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function metricText(metrics: Record<string, unknown> | null): string | null {
  if (!metrics) return null;
  const parts = Object.entries(metrics)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}`);
  return parts.length ? parts.join(" · ") : null;
}

export function RunsTable({ runs }: { runs: Run[] }) {
  if (!runs.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No runs reported. Runs are optional: use them for discrete jobs you want to time and count.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Run</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2 font-medium">Started</th>
            <th scope="col" className="px-3 py-2 font-medium">Duration</th>
            <th scope="col" className="px-3 py-2 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {runs.map((run) => {
            const metrics = metricText(run.metrics);
            return (
              <tr key={run.id}>
                <td className="max-w-36 truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={run.externalId}>
                  {run.externalId}
                </td>
                <td className={cn("px-3 py-2 font-medium capitalize", STATUS_STYLE[run.status])}>{run.status}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  <ActivityTime value={run.startedAt} />
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{duration(run)}</td>
                <td className="px-3 py-2">
                  <span className="line-clamp-1 text-foreground">{run.summary ?? "—"}</span>
                  {metrics && <span className="block font-mono text-[11px] text-muted-foreground">{metrics}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
