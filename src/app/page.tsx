import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseSettings } from "@/lib/settings";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const settings = await getHouseSettings();
  const initial = "A";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        {/* Monogram */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
          <span className="text-2xl font-semibold tracking-tight text-foreground">
            {initial}
          </span>
        </div>

        {/* Title + tagline */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {settings.houseName}
          </h1>
          {settings.houseTagline && (
            <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {settings.houseTagline}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 w-full sm:w-auto sm:px-8"
            )}
          >
            Enter the House
          </Link>
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 w-full sm:w-auto sm:px-8"
            )}
          >
            Request Entry
          </Link>
        </div>
      </main>

      {/* Footer mark */}
      <footer className="pb-8 text-center">
        <p className="text-xs tracking-wide text-muted-foreground/70">
          Est. Ahmar
        </p>
      </footer>
    </div>
  );
}
