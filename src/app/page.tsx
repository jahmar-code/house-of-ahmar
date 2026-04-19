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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Optional cover image (set in House Settings) */}
      {settings.coverImageUrl && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${settings.coverImageUrl})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </>
      )}

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.78_0.12_85_/_0.04)_0%,transparent_70%)]" />

      {/* Decorative border lines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <main className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        {/* Crest / Emblem */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-gold/30 bg-card glow-gold">
          <span className="font-heading text-4xl font-bold text-gold">A</span>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {settings.houseName}
          </h1>
          <div className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        </div>

        {/* Tagline */}
        {settings.houseTagline && (
          <p className="max-w-md whitespace-pre-line text-lg text-muted-foreground">
            {settings.houseTagline}
          </p>
        )}

        {/* CTA */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="inline-flex h-12 items-center justify-center rounded-md border border-gold/40 bg-gold/10 px-8 text-sm font-medium text-gold transition-all hover:bg-gold/20 hover:border-gold/60"
          >
            Enter the House
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border px-8 text-sm font-medium text-muted-foreground transition-colors hover:border-gold/30 hover:text-foreground"
          >
            Request Entry
          </Link>
        </div>

        {/* Footer mark */}
        <p className="mt-16 text-xs tracking-widest text-muted-foreground/50 uppercase">
          Est. Ahmar
        </p>
      </main>
    </div>
  );
}
