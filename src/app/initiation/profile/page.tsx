import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHouseSettings } from "@/lib/settings";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { SignOutLink } from "../sign-out-link";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const settings = await getHouseSettings();

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
            Step 3 of 3
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tell us who you are
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is how the family will see you. Only your name is required.
          </p>
        </div>

        <ProfileForm />

        <SignOutLink />
      </div>
    </div>
  );
}
