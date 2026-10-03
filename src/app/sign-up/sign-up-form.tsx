"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getURL } from "@/lib/get-url";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

type SignUpProblem = { message: string; alreadyRegistered: boolean };

/** Plain-language versions of Supabase's developer-facing auth errors. */
function readSignUpError(raw: string): SignUpProblem {
  const message = raw.toLowerCase();

  if (message.includes("already registered") || message.includes("already exists")) {
    return {
      message: "You already have an account with this email.",
      alreadyRegistered: true,
    };
  }
  if (message.includes("password")) {
    return {
      message: "That password is too short — please use at least 8 characters.",
      alreadyRegistered: false,
    };
  }
  if (message.includes("too many") || message.includes("rate limit")) {
    return {
      message: "Too many tries just now — give it a minute and have another go.",
      alreadyRegistered: false,
    };
  }
  return {
    message: "We couldn't set that up just now. Please try again in a moment.",
    alreadyRegistered: false,
  };
}

export function SignUpForm() {
  const router = useRouter();

  // Controlled on purpose: React 19 resets an uncontrolled `<form action={fn}>`
  // when the action resolves, which would wipe a rejected submission.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setAlreadyRegistered(false);

    try {
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
        const problem = readSignUpError(authError.message);
        setError(problem.message);
        setAlreadyRegistered(problem.alreadyRegistered);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/initiation");
        router.refresh();
        return;
      }

      setNotice(
        "Check your email for a link from us — open it and you'll come straight back here. Look in your spam folder if it hasn't arrived."
      );
    } catch {
      setError("Couldn't create your account. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <HydratedFieldset aria-label="Create your account" className="space-y-5">
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
          aria-describedby={error ? "sign-up-error" : undefined}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "sign-up-error" : "sign-up-password-hint"}
          className="h-11 border-border bg-card"
        />
        {!error && (
          <p id="sign-up-password-hint" className="text-xs text-muted-foreground">
            At least 8 characters.
          </p>
        )}
      </div>

      {error && (
        <p
          id="sign-up-error"
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

      {alreadyRegistered && (
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href="/sign-in"
            className="text-primary underline underline-offset-4 hover:underline"
          >
            Sign in instead
          </Link>{" "}
          or{" "}
          <Link
            href="/forgot-password"
            className="text-primary underline underline-offset-4 hover:underline"
          >
            set a new password
          </Link>
          .
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Creating..." : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already a member?{" "}
        <Link
          href="/sign-in"
          className="text-primary underline underline-offset-4 hover:underline"
        >
          Enter the House
        </Link>
      </p>
      </HydratedFieldset>
    </form>
  );
}
