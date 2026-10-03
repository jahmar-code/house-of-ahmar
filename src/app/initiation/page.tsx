import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { AccessCodeForm } from "./access-code-form";
import { SignOutLink } from "./sign-out-link";

export default async function InitiationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [existing, settings] = await Promise.all([
    db.query.members.findFirst({
      where: eq(members.authUserId, user.id),
    }),
    getHouseSettings(),
  ]);
  if (existing?.isActive) redirect("/dashboard");

  // The database membership check is authoritative, including deactivation.
  if (existing && !existing.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 px-6 text-center">
          <HouseMonogram
            houseName={settings.houseName}
            size="md"
            className="mx-auto"
          />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your access has been paused
          </h1>
          <p className="text-sm text-muted-foreground">
            You are not in {settings.houseName} at the moment. If that is a
            mistake, message whoever looks after the House and they can let you
            back in.
          </p>
          <SignOutLink />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <HouseMonogram
            houseName={settings.houseName}
            size="md"
            className="mx-auto mb-5"
          />
          <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Step 2 of 3
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Join the House
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the code someone in the family sent you.
          </p>
        </div>

        <AccessCodeForm />

        <SignOutLink />
      </div>
    </div>
  );
}
