import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function InitiationCompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-primary/40 bg-card glow-gold">
          <span className="text-4xl font-bold tracking-tight text-primary">
            A
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome to the House
          </h1>
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <p className="text-muted-foreground">
            You are now a member of the House of Ahmar.
            <br />
            <span className="text-primary/80">The gates open for you.</span>
          </p>
        </div>

        <Link
          href="/dashboard"
          className={cn(buttonVariants({ size: "lg" }), "h-11 px-8")}
        >
          Enter the Great Hall
        </Link>
      </div>
    </div>
  );
}
