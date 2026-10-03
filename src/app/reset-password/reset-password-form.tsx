"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const router = useRouter();

  // The recovery link signs the user in before it forwards them here, so a
  // missing session means the link was expired, already used, or opened in a
  // different browser. That is worth saying plainly rather than failing on submit.
  const [linkState, setLinkState] = useState<"checking" | "valid" | "expired">(
    "checking"
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) setLinkState(user ? "valid" : "expired");
      } catch {
        if (!cancelled) setLinkState("expired");
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(formData: FormData) {
    const next = String(formData.get("password") ?? "");
    const repeated = String(formData.get("confirmation") ?? "");

    setError(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Please use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (next !== repeated) {
      setError("Those two passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });

      if (updateError) {
        setError(
          /same/i.test(updateError.message)
            ? "That's your current password — please choose a different one."
            : "We couldn't save that password. Ask for a new reset link and try again."
        );
        setSaving(false);
        return;
      }

      // A member lands in the Great Hall; anyone who never finished joining is
      // sent on to the next step by the proxy.
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't save your password. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (linkState === "checking") {
    return (
      <p role="status" className="text-center text-sm text-muted-foreground">
        Checking your link...
      </p>
    );
  }

  if (linkState === "expired") {
    return (
      <div className="space-y-5">
        <p role="alert" className="text-center text-sm text-destructive">
          That reset link has expired or has already been used. Ask for a fresh
          one and open it on this device.
        </p>
        <Link
          href="/forgot-password"
          className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Email me a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "reset-password-error" : "reset-password-hint"}
          className="h-11 border-border bg-card"
        />
        {!error && (
          <p id="reset-password-hint" className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmation">Type it again</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "reset-password-error" : undefined}
          className="h-11 border-border bg-card"
        />
      </div>

      {error && (
        <p
          id="reset-password-error"
          role="alert"
          className="text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving} className="h-11 w-full">
        {saving ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
