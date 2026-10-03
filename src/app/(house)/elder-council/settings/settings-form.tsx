"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { updateHouseSettings } from "@/app/actions/settings";
import { toast } from "sonner";
import type { HouseSettings } from "@/lib/settings";

interface SettingsFormProps {
  initial: HouseSettings;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await updateHouseSettings(formData);
      if (result.success) {
        toast.success("House settings saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-border bg-card">
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="houseName">
              House Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="houseName"
              name="houseName"
              defaultValue={initial.houseName}
              required
              maxLength={80}
              className="h-11 bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Shown in the sidebar, the header, and on the landing page.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="houseTagline">Tagline</Label>
            <Textarea
              id="houseTagline"
              name="houseTagline"
              defaultValue={initial.houseTagline}
              rows={2}
              maxLength={280}
              className="resize-none bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Shown on the landing page under the House name. Line breaks are
              kept.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              name="welcomeMessage"
              defaultValue={initial.welcomeMessage}
              rows={2}
              maxLength={500}
              className="resize-none bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              The greeting everyone reads at the top of The Great Hall.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImageUrl">Cover Photo</Label>
            <Input
              id="coverImageUrl"
              name="coverImageUrl"
              inputMode="url"
              defaultValue={initial.coverImageUrl}
              placeholder="https://..."
              className="h-11 bg-muted/40"
            />
            <p className="text-xs text-muted-foreground">
              Optional. A family photo shown across the top of The Great Hall
              and behind the landing page. External cover links are public; use a
              photo you are comfortable showing to visitors.
            </p>
            {initial.coverImageUrl && (
              // The cover is an Elder-typed URL on an arbitrary host, so
              // next/image would need a wildcard remotePattern — which turns
              // the optimizer into an open image proxy. A plain <img> is the
              // correct trade here; it is one preview on an admin screen.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={initial.coverImageUrl}
                alt="Current cover photo"
                className="mt-3 max-h-40 w-full rounded-lg border border-border object-cover"
              />
            )}
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={loading} className="h-11">
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
