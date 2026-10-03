"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DoorClosed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Error boundary *inside* the House shell. The root `app/error.tsx` sits above
 * the (house) route group, so without this one a hiccup in a single page tears
 * down the sidebar, the mobile header and the bottom tab bar and leaves the
 * member on a bare panel. Here the chrome stays put: a room did not open, the
 * house is fine.
 */
export default function HouseError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <DoorClosed className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        This room did not open.
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Nothing is lost — it just did not load. Try again, or head back to the
        Great Hall.
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
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          The Great Hall
        </Link>
      </div>
      {error.digest && (
        // Gives whoever looks after the House something to search the logs for.
        <p className="mt-8 font-mono text-[11px] text-muted-foreground">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
