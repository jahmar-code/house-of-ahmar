import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseSettings } from "@/lib/settings";

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
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-800">
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
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
              {settings.houseTagline}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-2.5 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Enter the House
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-800 px-6 text-sm font-medium text-neutral-400 transition-colors hover:border-neutral-700 hover:text-foreground"
          >
            Request Entry
          </Link>
        </div>
      </main>

      {/* Footer mark */}
      <footer className="pb-8 text-center">
        <p className="text-xs tracking-wide text-neutral-600">Est. Ahmar</p>
      </footer>
    </div>
  );
}
