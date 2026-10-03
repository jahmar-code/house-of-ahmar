"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateAccessCode } from "@/app/actions/onboarding";

export function AccessCodeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // onSubmit rather than `<form action>`: React resets an action form on
    // completion, which would clear the typed code on every failed attempt.
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const result = await validateAccessCode(formData);
      if (result.success) {
        // Store code in session storage for the next step
        const code = formData.get("code") as string;
        sessionStorage.setItem("hoa_access_code", code);
        router.push("/initiation/profile");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't check that code. Check your connection and allow browser storage, then try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="code" className="text-muted-foreground">
          Family code
        </Label>
        <Input
          id="code"
          name="code"
          type="text"
          placeholder="Type it here"
          required
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 border-border bg-card text-center text-lg tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground"
        />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Checking..." : "Continue"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No code? Ask whoever invited you.
      </p>
    </form>
  );
}
