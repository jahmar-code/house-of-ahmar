"use client";

import { useState } from "react";
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

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

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
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="displayName">
          Display Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="displayName"
          name="displayName"
          placeholder="How the House knows you"
          required
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          name="fullName"
          placeholder="Your full name (optional)"
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthday">Birthday</Label>
        <Input
          id="birthday"
          name="birthday"
          type="date"
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          className="h-11 border-border bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">About You</Label>
        <Textarea
          id="bio"
          name="bio"
          placeholder="A few words about yourself..."
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
        {loading ? "Entering the House..." : "Complete Initiation"}
      </Button>
    </form>
  );
}
