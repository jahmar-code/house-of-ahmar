"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { archivePastGatherings } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { Archive } from "lucide-react";

export function ArchivePastButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
      const result = await archivePastGatherings();
      if (result.success && result.data) {
        toast.success(
          result.data.archived === 0
            ? "Nothing to tidy away"
            : `Tidied away ${result.data.archived} gathering${result.data.archived === 1 ? "" : "s"}`
        );
        // Fired from onClick, so the list won't repaint on its own.
        router.refresh();
      } else if (!result.success) {
        toast.error(result.error);
      }
    return result.success;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setConfirming(true)}
        className="h-11 text-muted-foreground hover:text-foreground sm:h-9"
      >
        <Archive className="h-4 w-4" />
        Archive past
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Tidy away older gatherings?"
        description="Everything that ended more than 7 days ago moves out of the list. Nothing is deleted — the pages and RSVPs stay exactly as they are."
        confirmLabel="Tidy them away"
        cancelLabel="Not now"
        destructive={false}
        onConfirm={handleConfirm}
      />
    </>
  );
}
