"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cancelGathering } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { MoreVertical, Pencil, X } from "lucide-react";

interface GatheringActionsProps {
  gatheringId: string;
}

export function GatheringActions({ gatheringId }: GatheringActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this gathering? Members will no longer see it as upcoming.")) {
      return;
    }
    setPending(true);
    const result = await cancelGathering(gatheringId);
    if (result.success) {
      toast.success("Gathering cancelled");
      router.push("/gatherings");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setPending(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="h-8 w-8" />
        }
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={<Link href={`/gatherings/${gatheringId}/edit`} />}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={handleCancel}
          disabled={pending}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel Gathering
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
