"use client";

import { useState } from "react";
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
    activeClass: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  },
  {
    value: "maybe" as const,
    label: "Maybe",
    icon: HelpCircle,
    activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-400",
  },
  {
    value: "not_attending" as const,
    label: "Can't make it",
    icon: X,
    activeClass: "bg-red-500/20 border-red-500/40 text-red-400",
  },
];

export function RsvpButton({ gatheringId, currentStatus }: RsvpButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleRsvp(status: "attending" | "maybe" | "not_attending") {
    setLoading(true);
    const result = await updateRsvp(gatheringId, status);
    if (result.success) {
      toast.success("Response updated");
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map(({ value, label, icon: Icon, activeClass }) => (
        <Button
          key={value}
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => handleRsvp(value)}
          className={`${
            currentStatus === value
              ? activeClass
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}
