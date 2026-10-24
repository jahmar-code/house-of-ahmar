import { cn } from "@/lib/utils";
import { HEALTH_META, type Health, type HealthTone } from "@/lib/workshop/status";

const TONE: Record<HealthTone, { pill: string; dot: string }> = {
  live: { pill: "border-success/30 bg-success/10 text-success", dot: "bg-success" },
  ok: { pill: "border-border bg-secondary text-foreground", dot: "bg-success/70" },
  attention: { pill: "border-destructive/30 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  muted: { pill: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
};

/** Status pill. The label carries the meaning; the dot and colour only reinforce it. */
export function HealthBadge({ health, className }: { health: Health; className?: string }) {
  const meta = HEALTH_META[health];
  const tone = TONE[meta.tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        tone.pill,
        className
      )}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {meta.tone === "live" && (
          <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", tone.dot)} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", tone.dot)} />
      </span>
      {meta.label}
    </span>
  );
}

const PENDING_LABEL = { pause: "Pause requested", stop: "Stop requested", run: "Resume requested" } as const;

export function PendingControl({ pending }: { pending: keyof typeof PENDING_LABEL | null }) {
  if (!pending) return null;
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 text-xs font-medium text-warning">
      {PENDING_LABEL[pending]}
    </span>
  );
}
