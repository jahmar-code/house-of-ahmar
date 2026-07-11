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

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await validateAccessCode(formData);
    if (result.success) {
      // Store code in session storage for the next step
      const code = formData.get("code") as string;
      sessionStorage.setItem("hoa_access_code", code);
      router.push("/initiation/profile");
    } else {
      setError(result.error);
    }
    setLoading(false);
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="code" className="text-muted-foreground">
          House Code
        </Label>
        <Input
          id="code"
          name="code"
          type="text"
          placeholder="Enter your family code"
          required
          autoFocus
          className="h-12 border-border bg-card text-center text-lg tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/50"
        />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="h-11 w-full">
        {loading ? "Verifying..." : "Present Code"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have a code? Ask a family elder.
      </p>
    </form>
  );
}
