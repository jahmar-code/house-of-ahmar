import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "default" | "live" | "attention";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <Icon
          className={cn(
            "size-4",
            tone === "live" && "text-success",
            tone === "attention" && "text-destructive",
            tone === "default" && "text-muted-foreground"
          )}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
