"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setAgentShare } from "@/app/actions/workshop";

type Target = { id: string; displayName: string; shared: boolean };

/** Owner-only. A share lets that operator watch the agent; it never grants control. */
export function SharePanel({ agentId, targets }: { agentId: string; targets: Target[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState(() => new Map(targets.map((t) => [t.id, t.shared])));

  async function toggle(target: Target, shared: boolean) {
    setBusy(target.id);
    setState((m) => new Map(m).set(target.id, shared));
    try {
      const result = await setAgentShare(agentId, target.id, shared);
      if (!result.success) throw new Error(result.error);
      toast.success(shared ? `Shared with ${target.displayName}` : `Stopped sharing with ${target.displayName}`);
      router.refresh();
    } catch (error) {
      setState((m) => new Map(m).set(target.id, !shared));
      toast.error(error instanceof Error ? error.message : "Couldn't update sharing");
    } finally {
      setBusy(null);
    }
  }

  if (!targets.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No other operators yet. A Workshop admin can add your partners on the Operators page.
      </p>
    );
  }

  return (
    <fieldset className="space-y-1">
      <legend className="sr-only">Share with</legend>
      {targets.map((target) => {
        const checked = state.get(target.id) ?? false;
        return (
          <label
            key={target.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-secondary/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          >
            <span className="min-w-0 truncate text-sm font-medium text-foreground">{target.displayName}</span>
            <input
              type="checkbox"
              className="peer sr-only"
              checked={checked}
              disabled={busy === target.id}
              onChange={(e) => toggle(target, e.target.checked)}
            />
            <span
              aria-hidden="true"
              className="relative h-5 w-9 shrink-0 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-foreground after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-primary-foreground motion-reduce:after:transition-none"
            />
          </label>
        );
      })}
    </fieldset>
  );
}
