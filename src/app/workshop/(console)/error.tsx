"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkshopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-foreground">The Workshop couldn&apos;t load</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Your agents are unaffected. Try again in a moment.</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
