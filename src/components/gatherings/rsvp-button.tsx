"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateRsvp } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { RSVP_META, RSVP_ORDER } from "./rsvp-meta";

interface RsvpButtonProps {
  gatheringId: string;
  currentStatus?: string;
}

export function RsvpButton({ gatheringId, currentStatus }: RsvpButtonProps) {
  // Tracks which answer is mid-flight so the tapped button — and only it —
  // reads as busy while the server round-trips.
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function handleRsvp(status: "attending" | "maybe" | "not_attending") {
    if (busy) return;
    setBusy(status);
    try {
      const result = await updateRsvp(gatheringId, status);
      if (result.success) {
        toast.success("Response updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Couldn't update your response. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {RSVP_ORDER.map((value) => {
        const { verb, Icon, activeClass } = RSVP_META[value];
        const active = currentStatus === value;
        return (
          <Button
            key={value}
            variant="outline"
            aria-pressed={active}
            aria-busy={busy === value}
            disabled={busy !== null}
            onClick={() => handleRsvp(value)}
            className={`h-11 min-w-0 ${
              active ? activeClass : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{verb}</span>
          </Button>
        );
      })}
    </div>
  );
}
