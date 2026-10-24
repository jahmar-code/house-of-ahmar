import Link from "next/link";
import { ActivityTime } from "@/components/shared/activity-time";
import { cn } from "@/lib/utils";
import { EVENT_LEVELS, type EventLevel } from "@/lib/workshop/constants";

type Event = {
  id: string;
  level: string;
  message: string;
  data: Record<string, unknown> | null;
  occurredAt: Date;
  runExternalId: string | null;
  actorName: string | null;
};

const LEVEL_STYLE: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

export function EventLog({ agentId, events, level }: { agentId: string; events: Event[]; level?: EventLevel }) {
  const filters: { label: string; value?: EventLevel }[] = [{ label: "All" }, ...EVENT_LEVELS.map((v) => ({ label: v, value: v }))];
  return (
    <div>
      <nav aria-label="Filter activity by level" className="mb-3 flex flex-wrap gap-1.5">
        {filters.map((f) => {
          const active = f.value === level;
          return (
            <Link
              key={f.label}
              href={f.value ? `/workshop/agents/${agentId}?level=${f.value}` : `/workshop/agents/${agentId}`}
              scroll={false}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium capitalize transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>
      {events.length ? (
        <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background font-mono text-xs">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[4.5rem_3rem_1fr] gap-3 px-3 py-2 sm:grid-cols-[6.5rem_3.5rem_1fr]">
              <span className="truncate text-muted-foreground">
                <ActivityTime value={e.occurredAt} showTodayTime />
              </span>
              <span className={cn("uppercase", LEVEL_STYLE[e.level])}>{e.level}</span>
              <span className="min-w-0">
                <span className={cn("break-words whitespace-pre-wrap", LEVEL_STYLE[e.level])}>{e.message}</span>
                {(e.runExternalId || e.actorName) && (
                  <span className="mt-0.5 block text-muted-foreground">
                    {e.runExternalId && <>run {e.runExternalId}</>}
                    {e.runExternalId && e.actorName && " · "}
                    {e.actorName && <>by {e.actorName}</>}
                  </span>
                )}
                {e.data && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">data</summary>
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2 text-[11px] text-muted-foreground">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  </details>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {level ? `No ${level} events.` : "No activity yet. Events and status changes appear here as the agent reports them."}
        </p>
      )}
    </div>
  );
}
