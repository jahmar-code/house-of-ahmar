"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeInitiation } from "@/app/actions/onboarding";

export function ProfileForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The code only lives in sessionStorage, which dies on a closed tab and on
  // iOS when Safari reclaims a backgrounded one. Check it before the longest
  // form in the flow is filled in, not after it is submitted. The server
  // snapshot assumes a code so the first paint is the form, matching SSR.
  const hasCode = useSyncExternalStore(
    () => () => {},
    () => {
      try { return Boolean(sessionStorage.getItem("hoa_access_code")); }
      catch { return false; }
    },
    () => true
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit via onSubmit rather than `<form action>`: React resets an action
    // form on completion, which would wipe every field on a failed submit.
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      // Attach the access code from session storage
      const accessCode = sessionStorage.getItem("hoa_access_code");
      if (accessCode) {
        formData.set("accessCode", accessCode);
      }

      const result = await completeInitiation(formData);
      if (result.success) {
        sessionStorage.removeItem("hoa_access_code");
        router.push("/initiation/complete");
      } else {
        setError(result.error);
      }
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasCode) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-5 text-center">
        <p className="text-sm font-medium text-foreground">
          We lost track of your family code.
        </p>
        <p className="text-sm text-muted-foreground">
          That happens when the tab closes or reopens. Enter it once more and
          you will pick up right here.
        </p>
        <Button
          render={<Link href="/initiation" />}
          className="h-11 w-full"
        >
          Enter the code again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="displayName"
          name="displayName"
              maxLength={50}
          placeholder="What the family calls you"
          required
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
              maxLength={100}
          placeholder="Optional"
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday">Birthday</Label>
        <Input
          id="birthday"
          name="birthday"
          type="date"
          aria-describedby="birthday-hint"
          className="h-11 border-border bg-card"
        />
        <p id="birthday-hint" className="text-xs text-muted-foreground">
          It shows up in the Great Hall as it comes around, so no one forgets.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
              maxLength={20}
          type="tel"
          placeholder="Optional"
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">About you</Label>
        <Textarea
          id="bio"
          name="bio"
              maxLength={500}
          placeholder="A few words, if you like"
          rows={3}
          className="border-border bg-card resize-none"
        />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Joining..." : "Join the House"}
      </Button>
    </form>
  );
}
