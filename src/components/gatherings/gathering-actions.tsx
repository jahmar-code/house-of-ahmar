"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cancelGathering, uncancelGathering } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { MoreVertical, Pencil, RotateCcw, X } from "lucide-react";

interface GatheringActionsProps {
  gatheringId: string;
  title: string;
  isCancelled: boolean;
}

export function GatheringActions({
  gatheringId,
  title,
  isCancelled,
}: GatheringActionsProps) {
  const router = useRouter();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    const result = await cancelGathering(gatheringId);
    if (result.success) {
      toast.success("Gathering cancelled");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    return result.success;
  }

  async function handleUncancel() {
    setPending(true);
    try {
      const result = await uncancelGathering(gatheringId);
      if (result.success) {
        toast.success("Gathering is back on");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("That didn't save. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${title}`}
              className="size-11"
            />
          }
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* updateGathering refuses a cancelled row, so don't offer Edit until
              it's back on. */}
          {!isCancelled && (
            <>
              <DropdownMenuItem
                render={<Link href={`/gatherings/${gatheringId}/edit`} />}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isCancelled ? (
            <DropdownMenuItem onClick={handleUncancel} disabled={pending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              It&apos;s back on
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setConfirmingCancel(true)}>
              <X className="mr-2 h-4 w-4" />
              Cancel gathering
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title={`Cancel ${title}?`}
        description="Everyone who RSVP'd will see it marked cancelled. Their answers are kept, and you can put it back on later."
        confirmLabel="Cancel it"
        cancelLabel="Leave it on"
        onConfirm={handleCancel}
      />
    </>
  );
}
