import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Compass } from "lucide-react";

// Without this, a notFound() from any house route falls through to the ROOT
// not-found and tears down the whole shell — sidebar, header and tab bar —
// leaving a relative stranded with no way back.
export default function HouseNotFound() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <Compass className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        There&apos;s nothing here
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        This page may have been removed, or the link you followed is out of
        date. Everything else in the House is still where you left it.
      </p>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ size: "lg" }), "mt-6")}
      >
        Back to the Great Hall
      </Link>
    </div>
  );
}
