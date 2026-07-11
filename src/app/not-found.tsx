import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card">
          <Compass className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          You have wandered beyond the walls.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This path does not lead anywhere within the House.
        </p>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8")}
        >
          Return to the Great Hall
        </Link>
      </div>
    </div>
  );
}
