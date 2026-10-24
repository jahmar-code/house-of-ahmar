import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { getOperatorContext } from "@/lib/workshop/access";
import { createClient } from "@/lib/supabase/server";
import { WorkshopAuthFrame } from "@/components/workshop/auth-frame";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "No access" };

export default async function WorkshopNoAccessPage() {
  if (await getOperatorContext()) redirect("/workshop");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/workshop/sign-in");

  return (
    <WorkshopAuthFrame
      title="You're not on the operator list"
      description="Your account is signed in, but the Workshop hasn't been opened to it."
    >
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <ShieldOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>
            Ask a Workshop admin to add <span className="font-medium text-foreground">{user.email}</span> to the
            operator list, then sign in again. If you just signed up, confirm your email first.
          </p>
        </div>
        <SignOutButton />
      </div>
    </WorkshopAuthFrame>
  );
}
