"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeAccessCode } from "@/app/actions/admin";
import { toast } from "sonner";
import { X } from "lucide-react";

export function RevokeButton({
  codeId,
  code,
}: {
  codeId: string;
  code: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    const result = await revokeAccessCode(codeId);
    if (result.success) {
      toast.success("Code revoked");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setConfirming(true)}
        aria-label={`Revoke code ${code}`}
        className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Revoke ${code}?`}
        description="Anyone still holding this code won't be able to use it. You can always create a new one."
        confirmLabel="Revoke it"
        cancelLabel="Keep it"
        onConfirm={handleConfirm}
      />
    </>
  );
}
