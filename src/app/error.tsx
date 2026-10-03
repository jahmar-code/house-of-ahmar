"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

// Route-level error boundary — keeps any thrown error from white-screening a
// flow. This one sits ABOVE the (house) group, so the people it actually
// catches are signed-out or mid-initiation: it must never offer them a link
// the proxy will bounce. `/` is the one destination that works for everyone —
// signed-in visitors are forwarded on to the Great Hall from there.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <TriangleAlert
          className="h-6 w-6 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        That did not load.
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        It is not something you did. Try again — it usually works the second
        time.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Try again
        </button>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Take me home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
