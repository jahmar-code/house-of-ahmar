import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/30 bg-card">
            <span className="font-heading text-2xl font-bold text-gold">A</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Your Identity
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell the House who you are.
          </p>
        </div>

        <ProfileForm />
      </div>
    </div>
  );
}
