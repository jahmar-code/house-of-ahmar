"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateRsvp } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { Check, HelpCircle, X } from "lucide-react";

interface RsvpButtonProps {
  gatheringId: string;
  currentStatus?: string;
}

const statuses = [
  {
    value: "attending" as const,
    label: "Attending",
    icon: Check,
    activeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
  },
  {
    value: "maybe" as const,
    label: "Maybe",
    icon: HelpCircle,
    activeClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
  },
  {
    value: "not_attending" as const,
    label: "Can't make it",
    icon: X,
    activeClass:
      "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
  },
];

export function RsvpButton({ gatheringId, currentStatus }: RsvpButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRsvp(status: "attending" | "maybe" | "not_attending") {
    setLoading(true);
    const result = await updateRsvp(gatheringId, status);
    if (result.success) {
      toast.success("Response updated");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {statuses.map(({ value, label, icon: Icon, activeClass }) => {
        const active = currentStatus === value;
        return (
          <Button
            key={value}
            variant="outline"
            aria-pressed={active}
            disabled={loading}
            onClick={() => handleRsvp(value)}
            className={`h-11 min-w-0 ${
              active ? activeClass : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
