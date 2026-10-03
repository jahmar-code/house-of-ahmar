import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const settings = await getHouseSettings();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Cover photo, faded into the background behind the monogram. Decorative
          only — the gradient reaches the page background before any copy, so
          nothing here is read over the image. */}
      {settings.coverImageUrl && !settings.coverImageUrl.startsWith("/api/media/") && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.coverImageUrl}
            alt=""
            className="h-full w-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/85 to-background" />
        </div>
      )}

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <HouseMonogram houseName={settings.houseName} size="md" />

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

        {/* Actions. Almost everyone arriving here was sent a link and is
            holding a code, so the invite-holder path carries the emphasis;
            "Sign in" is the one label a returning member never has to guess. */}
        <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-11 w-full sm:w-auto sm:px-8"
            )}
          >
            I have an invite code
          </Link>
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-11 w-full sm:w-auto sm:px-8"
            )}
          >
            Sign in
          </Link>
        </div>
      </main>

      <footer className="relative pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Your family’s conversations, photos, and gatherings stay inside.
        </p>
      </footer>
    </div>
  );
}
