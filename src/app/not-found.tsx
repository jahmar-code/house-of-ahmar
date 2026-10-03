import Link from "next/link";
import { DoorClosed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

// Serves signed-out visitors and members alike, so the way out is `/` — the
// landing page forwards anyone already signed in straight to the Great Hall.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card">
          <DoorClosed
            className="h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          There is nothing at this door.
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          The link may be old, or whatever was here has moved. Everything else
          is right where you left it.
        </p>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-8"
          )}
        >
          Take me home
        </Link>
      </div>
    </main>
  );
}
