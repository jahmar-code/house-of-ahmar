"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { revokeAccessCode } from "@/app/actions/admin";
import { toast } from "sonner";
import { X } from "lucide-react";

export function RevokeButton({ codeId }: { codeId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("Revoke this access code? This cannot be undone.")) return;
    setLoading(true);
    const result = await revokeAccessCode(codeId);
    if (result.success) toast.success("Code revoked");
    else toast.error(result.error);
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={handleClick}
      aria-label="Revoke access code"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}
