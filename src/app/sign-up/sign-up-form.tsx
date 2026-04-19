"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/initiation");
      router.refresh();
      return;
    }

    setNotice("Check your email to confirm your account, then sign in.");
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 border-border bg-card"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-gold text-center">{notice}</p>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full bg-gold text-gold-foreground hover:bg-gold/90"
      >
        {loading ? "Creating..." : "Request Entry"}
      </Button>

      <p className="text-center text-xs text-muted-foreground/60">
        Already a member?{" "}
        <Link href="/sign-in" className="text-gold hover:underline">
          Enter the House
        </Link>
      </p>
    </form>
  );
}
