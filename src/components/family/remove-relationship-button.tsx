"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { removeRelationship } from "@/app/actions/family";
import { toast } from "sonner";
import { X } from "lucide-react";

interface RemoveRelationshipButtonProps {
  parentId: string;
  childId: string;
  label?: string;
}

export function RemoveRelationshipButton({
  parentId,
  childId,
  label = "Remove",
}: RemoveRelationshipButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Remove this family link? The members are not deleted.")) {
      return;
    }
    startTransition(async () => {
      const result = await removeRelationship(parentId, childId);
      if (result.success) {
        toast.success("Relationship removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={pending}
      aria-label={label}
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}
