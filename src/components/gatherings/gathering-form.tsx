"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createGathering, updateGathering } from "@/app/actions/gatherings";
import { toast } from "sonner";

export interface GatheringFormInitial {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
}

interface GatheringFormProps {
  initial?: GatheringFormInitial;
}

// HTML datetime-local expects "YYYY-MM-DDTHH:mm" without timezone
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GatheringForm({ initial }: GatheringFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const editing = Boolean(initial);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // datetime-local returns "YYYY-MM-DDTHH:mm". Convert to ISO for the validator.
    for (const key of ["startsAt", "endsAt"] as const) {
      const raw = formData.get(key);
      if (typeof raw === "string" && raw.length > 0) {
        formData.set(key, new Date(raw).toISOString());
      } else {
        formData.delete(key);
      }
    }

    if (editing && initial) {
      const result = await updateGathering(initial.id, formData);
      if (result.success) {
        toast.success("Gathering updated");
        router.push(`/gatherings/${initial.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } else {
      const result = await createGathering(formData);
      if (result.success && result.data) {
        toast.success("Gathering created");
        router.push(`/gatherings/${result.data.id}`);
      } else if (!result.success) {
        toast.error(result.error);
      }
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              defaultValue={initial?.title}
              placeholder="Family Dinner, Eid Celebration..."
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ""}
              placeholder="What's the occasion?"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              defaultValue={initial?.location ?? ""}
              placeholder="Uncle's house, Park, etc."
              className="h-11"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">
                Start <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalInputValue(initial?.startsAt ?? null)}
                required
                className="h-11 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">End</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={toLocalInputValue(initial?.endsAt ?? null)}
                className="h-11 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              {loading
                ? editing
                  ? "Saving..."
                  : "Creating..."
                : editing
                  ? "Save Changes"
                  : "Create Gathering"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
