"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getURL } from "@/lib/get-url";

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
      options: {
        // Send the confirmation link back to our callback on the *current*
        // origin so it never points at localhost in production.
        emailRedirectTo: getURL("/auth/confirm?next=/initiation"),
      },
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
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-center text-sm text-primary">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Creating..." : "Request Entry"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already a member?{" "}
        <Link
          href="/sign-in"
          className="text-primary underline-offset-4 hover:underline"
        >
          Enter the House
        </Link>
      </p>
    </form>
  );
}
