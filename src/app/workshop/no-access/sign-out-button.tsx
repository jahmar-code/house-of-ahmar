"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Couldn't sign out. Try again.");
      setPending(false);
      return;
    }
    router.push("/workshop/sign-in");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="h-11 w-full" onClick={signOut} disabled={pending}>
        {pending ? "Signing out..." : "Use a different account"}
      </Button>
      {error && <p role="alert" className="text-center text-destructive">{error}</p>}
    </div>
  );
}
