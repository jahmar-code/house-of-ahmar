"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CirclePause, CirclePlay, CircleStop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { setDesiredState } from "@/app/actions/workshop";

/**
 * Owner-only controls. They set the *desired* state; the agent picks it up on
 * its next heartbeat or control poll, so the badge changes only once the agent
 * acknowledges. Stopping asks first because it usually ends the process.
 */
export function AgentControls({ agentId, desiredState }: { agentId: string; desiredState: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmStop, setConfirmStop] = useState(false);

  async function send(state: "run" | "pause" | "stop") {
    const result = await setDesiredState(agentId, state);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(
      state === "run" ? "Resume sent" : state === "pause" ? "Pause sent" : "Stop sent",
      { description: "The agent applies it on its next check-in." }
    );
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {desiredState === "run" ? (
        <Button variant="outline" disabled={pending} onClick={() => send("pause")}>
          <CirclePause className="size-4" aria-hidden="true" />
          Pause
        </Button>
      ) : (
        <Button disabled={pending} onClick={() => send("run")}>
          <CirclePlay className="size-4" aria-hidden="true" />
          Resume
        </Button>
      )}
      {desiredState !== "stop" && (
        <Button variant="outline" disabled={pending} onClick={() => setConfirmStop(true)} className="text-destructive">
          <CircleStop className="size-4" aria-hidden="true" />
          Stop
        </Button>
      )}
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop this agent?"
        description="The agent is asked to finish its current step and shut down. If its process exits, resuming needs it started again."
        confirmLabel="Stop agent"
        onConfirm={() => send("stop")}
      />
    </div>
  );
}
