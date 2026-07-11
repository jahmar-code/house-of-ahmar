"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archivePastGatherings } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { Archive } from "lucide-react";

export function ArchivePastButton() {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleClick() {
    if (
      !confirm(
        "Archive all gatherings older than 7 days? They'll be hidden from the list (data is preserved)."
      )
    ) {
      return;
    }
    setBusy(true);
    startTransition(async () => {
      const result = await archivePastGatherings();
      if (result.success && result.data) {
        toast.success(
          result.data.archived === 0
            ? "Nothing to archive"
            : `Archived ${result.data.archived} gathering${result.data.archived === 1 ? "" : "s"}`
        );
      } else if (!result.success) {
        toast.error(result.error);
      }
      setBusy(false);
    });
  }

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={pending || busy}
      className="text-muted-foreground hover:text-foreground"
    >
      <Archive className="h-4 w-4" />
      Archive past
    </Button>
  );
}
