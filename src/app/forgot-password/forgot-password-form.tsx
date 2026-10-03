"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getURL } from "@/lib/get-url";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

// One neutral confirmation for every outcome. Saying "no such account" would
// turn this form into a free membership oracle for anyone with an email list.
const SENT_NOTICE =
  "If that email belongs to someone in the House, a reset link is on its way. Check your inbox — and your spam folder.";

export function ForgotPasswordForm() {
  // Controlled: React 19 resets an uncontrolled `<form action={fn}>` when the
  // action resolves, wiping what was typed.
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        String(formData.get("email") ?? ""),
        { redirectTo: getURL("/auth/confirm?next=/reset-password") }
      );

      // Only a transport/throttle failure is ever surfaced — an unknown address
      // still gets the same neutral confirmation as a known one.
      if (resetError && /too many|rate limit/i.test(resetError.message)) {
        setError("Too many requests just now — give it a few minutes and try again.");
        setLoading(false);
        return;
      }

      if (resetError && (resetError.status === 0 || (resetError.status ?? 0) >= 500)) {
        setError("Couldn't request that email. Check your connection and try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't request that email. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <p role="status" className="text-center text-sm text-foreground">
          {SENT_NOTICE}
        </p>
        <Link
          href="/sign-in"
          className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <HydratedFieldset aria-label="Password recovery" className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "forgot-password-error" : undefined}
          className="h-11 border-border bg-card"
        />
      </div>

      {error && (
        <p
          id="forgot-password-error"
          role="alert"
          className="text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Sending..." : "Email me a reset link"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="text-primary underline underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
      </HydratedFieldset>
    </form>
  );
}
