"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccessCode } from "@/app/actions/admin";
import { CopyInviteButton } from "./copy-code-controls";

export function CreateCodeForm({ houseName }: { houseName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // The code we just minted, kept on screen so it can be handed on rather than
  // squinted at and retyped.
  const [newCode, setNewCode] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    // Capture the form before awaiting — React nulls e.currentTarget after the
    // synchronous phase, so reading it post-await throws.
    const form = e.currentTarget;
    try {
      const result = await createAccessCode(new FormData(form));
      if (result.success && result.data) {
        setNewCode(result.data.code);
        toast.success("Invite code ready");
        form.reset();
        router.refresh();
      } else if (!result.success) {
        toast.error(result.error);
      }
    } catch {
      toast.error("Couldn't create that invite. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="label" className="text-xs">
                Who is it for?
              </Label>
              <Input
                id="label"
                name="label"
                placeholder="Uncle Karim"
                className="h-11 w-48 bg-muted/40 text-base sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxUses" className="text-xs">
                Max Uses
              </Label>
              <Input
                id="maxUses"
                name="maxUses"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={1}
                className="h-11 w-24 bg-muted/40 text-base sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiresInDays" className="text-xs">
                Expires (days)
              </Label>
              <Input
                id="expiresInDays"
                name="expiresInDays"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                placeholder="Never"
                className="h-11 w-28 bg-muted/40 text-base sm:text-sm"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {loading ? "Creating..." : "Create Code"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {newCode && (
        <Card className="border-primary/20 bg-card ring-1 ring-primary/30">
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                New invite code
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tracking-[0.2em] text-foreground">
                {newCode}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <CopyInviteButton code={newCode} houseName={houseName} />
              <CopyInviteButton
                code={newCode}
                houseName={houseName}
                mode="code"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Send it however you normally talk to them. They create an account
              first, then enter this code.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
