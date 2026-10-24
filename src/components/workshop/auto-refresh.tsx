"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Re-renders the server page on an interval while the tab is visible. Every
 * refresh re-runs the page's own operator check, so a revoked share or a
 * deactivated operator stops seeing data on the next tick.
 */
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [pending, startTransition] = useTransition();
  // Null until the first client tick: a render-time clock would differ between server and client.
  const [lastTick, setLastTick] = useState<number | null>(null);

  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      setLastTick(Date.now());
    };
    const id = window.setInterval(tick, seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, seconds, router]);

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted-foreground",
          live && "text-foreground"
        )}
        aria-live="off"
        title={lastTick ? `Last refreshed ${new Date(lastTick).toLocaleTimeString()}` : undefined}
      >
        <RefreshCw className={cn("size-3.5", pending && "motion-safe:animate-spin")} aria-hidden="true" />
        {live ? `Live · every ${seconds}s` : "Paused"}
      </span>
      <button
        type="button"
        onClick={() => setLive((v) => !v)}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={live ? "Pause live updates" : "Resume live updates"}
        aria-pressed={!live}
      >
        {live ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
      </button>
    </div>
  );
}
