import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessCodeForm } from "./access-code-form";

export default async function InitiationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const existing = await db.query.members.findFirst({
    where: eq(members.authUserId, user.id),
  });
  if (existing) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              A
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Initiation
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            To enter the House, you must present the family code.
          </p>
        </div>

        <AccessCodeForm />
      </div>
    </div>
  );
}
