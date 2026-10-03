"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

/**
 * The only way off the /initiation screens. Without it a relative who signed
 * up with the wrong email — or who has no code yet — is held here by the proxy
 * with no exit but clearing browser data, and a shared family tablet can never
 * be handed to the next person.
 */
export function SignOutLink() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-70"
      >
        {loading ? "Signing out..." : "Sign out and use a different account"}
      </button>
    </div>
  );
}
