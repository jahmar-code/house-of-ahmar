"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getURL } from "@/lib/get-url";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

type SignInProblem = { message: string; offerResend: boolean };

/**
 * Supabase's raw error strings are for developers ("Invalid login credentials").
 * Relatives get plain language plus the way out.
 */
function readSignInError(raw: string): SignInProblem {
  const message = raw.toLowerCase();

  if (message.includes("not confirmed")) {
    return {
      message:
        "You haven't confirmed your email address yet. We can send you a fresh link.",
      offerResend: true,
    };
  }
  if (message.includes("invalid login credentials")) {
    return {
      message:
        "That email and password don't match. Check the email, or set a new password below.",
      offerResend: false,
    };
  }
  if (message.includes("too many") || message.includes("rate limit")) {
    return {
      message: "Too many tries just now — give it a minute and have another go.",
      offerResend: false,
    };
  }
  return {
    message: "We couldn't sign you in just now. Please try again in a moment.",
    offerResend: false,
  };
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmationFailed = searchParams.get("error") === "confirmation_failed";

  // Controlled on purpose: React 19 resets an uncontrolled `<form action={fn}>`
  // when the action resolves, so a rejected sign-in would wipe the email a
  // relative just typed.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    confirmationFailed
      ? "That confirmation link has expired. Enter your email and we'll send a new one."
      : null
  );
  const [offerResend, setOfferResend] = useState(confirmationFailed);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setOfferResend(false);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });

      if (authError) {
        const problem = readSignInError(authError.message);
        setError(problem.message);
        setOfferResend(problem.offerResend);
        setLoading(false);
        return;
      }

      // `next` is attacker-controlled — only same-site paths are followed.
      router.push(safeRedirectPath(searchParams.get("next"), "/dashboard"));
      router.refresh();
    } catch {
      setError("Couldn't sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setNotice(null);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: getURL("/auth/confirm?next=/initiation"),
        },
      });

      if (resendError) {
        setError("We couldn't send that email just now. Please try again shortly.");
        setResending(false);
        return;
      }

      setError(null);
      setOfferResend(false);
      setNotice("Sent. Check your inbox — and your spam folder, just in case.");
    } catch {
      setError("Couldn't send that email. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <HydratedFieldset aria-label="Sign in" className="space-y-5">
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
          aria-describedby={error ? "sign-in-error" : undefined}
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-in-error" : undefined}
          className="h-11 border-border bg-card"
        />
      </div>

      {error && (
        <p
          id="sign-in-error"
          role="alert"
          className="text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-center text-sm text-primary">
          {notice}
        </p>
      )}

      {offerResend && (
        <Button
          type="button"
          variant="outline"
          onClick={handleResend}
          disabled={resending || email.length === 0}
          className="h-11 w-full"
        >
          {resending ? "Sending..." : "Send me a new confirmation email"}
        </Button>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Entering..." : "Enter the House"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        New here?{" "}
        <Link
          href="/sign-up"
          className="text-primary underline underline-offset-4 hover:underline"
        >
          Set up your account
        </Link>
      </p>
      </HydratedFieldset>
    </form>
  );
}
