"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { createGathering, updateGathering } from "@/app/actions/gatherings";
import { toast } from "sonner";
import { calendarDayStart, calendarDayEnd, calendarInputValue } from "./calendar-date";
import { HydratedFieldset } from "@/components/shared/hydrated-fieldset";

export interface GatheringFormInitial {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isAllDay: boolean;
}

interface GatheringFormProps {
  initial?: GatheringFormInitial;
}

const pad = (n: number) => String(n).padStart(2, "0");
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

// HTML datetime-local expects "YYYY-MM-DDTHH:mm" without timezone
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GatheringForm({ initial }: GatheringFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [allDay, setAllDay] = useState(initial?.isAllDay ?? false);
  const [starts, setStarts] = useState(() =>
    initial?.isAllDay
      ? calendarInputValue(initial.startsAt)
      : toLocalInputValue(initial?.startsAt ?? null)
  );
  const [ends, setEnds] = useState(() =>
    initial?.isAllDay
      ? calendarInputValue(initial.endsAt)
      : toLocalInputValue(initial?.endsAt ?? null)
  );
  const [timeError, setTimeError] = useState("");
  const editing = Boolean(initial);
  const submitRef = useRef<HTMLButtonElement>(null);
  const refocusSubmit = useRef(false);
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);

  // Save stays focusable while pending (aria-disabled), so focus is normally
  // still there after a failure. Safari does not focus clicked buttons; only
  // then is focus handed back, never pulled from wherever the person moved it.
  useEffect(() => {
    if (loading || !refocusSubmit.current) return;
    refocusSubmit.current = false;
    if (!document.activeElement || document.activeElement === document.body) submitRef.current?.focus();
  }, [loading]);

  // Switching the toggle re-shapes both inputs, so carry the day across rather
  // than silently blanking what the user already picked.
  function handleAllDayChange(next: boolean) {
    setAllDay(next);
    setTimeError("");
    setStarts((v) => (v ? (next ? v.slice(0, 10) : `${v.slice(0, 10)}T18:00`) : v));
    setEnds((v) => (v ? (next ? v.slice(0, 10) : `${v.slice(0, 10)}T21:00`) : v));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (!starts) {
      setTimeError("Pick when it starts.");
      return;
    }

    const startDate = allDay ? calendarDayStart(starts) : new Date(starts);
    const endDate = allDay ? calendarDayEnd(ends || starts) : ends ? new Date(ends) : null;

    if (Number.isNaN(startDate.getTime())) {
      setTimeError("That start date doesn't look right.");
      return;
    }
    if (endDate && Number.isNaN(endDate.getTime())) {
      setTimeError("That end date doesn't look right.");
      return;
    }
    // Tell them here rather than after a round-trip. The server refines the
    // same rule — this is the friendly half, not the boundary.
    if (endDate && endDate.getTime() <= startDate.getTime()) {
      setTimeError(
        allDay
          ? "The last day can't be before the first day."
          : "The end time has to come after the start time."
      );
      return;
    }
    setTimeError("");

    formData.set("startsAt", startDate.toISOString());
    if (endDate) formData.set("endsAt", endDate.toISOString());
    else formData.delete("endsAt");
    formData.set("isAllDay", allDay ? "true" : "false");

    // The request carries the values captured above. Freeze every field and
    // Cancel until it settles, so nothing typed now can be silently dropped by
    // a successful save, and Cancel never implies the save was stopped.
    setLoading(true);
    let saved = false;

    try {
      if (editing && initial) {
        const result = await updateGathering(initial.id, formData);
        if (result.success) {
          saved = true;
          toast.success("Gathering updated");
          router.push(`/gatherings/${initial.id}`);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createGathering(formData);
        if (result.success && result.data) {
          saved = true;
          toast.success("Gathering created");
          router.push(`/gatherings/${result.data.id}`);
        } else if (!result.success) {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("That didn't save. Check your connection and try again.");
    } finally {
      // On failure the draft is still in the fields, editable and retryable.
      // After a success the form stays frozen until the navigation replaces it:
      // edits typed now would be lost, and a second Create would duplicate it.
      if (!saved) {
        refocusSubmit.current = true;
        setLoading(false);
      }
    }
  }

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <HydratedFieldset disabled={loading} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              maxLength={100}
              defaultValue={initial?.title}
              placeholder="Family Dinner, Eid Celebration..."
              required
              className="h-11 text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              maxLength={5000}
              defaultValue={initial?.description ?? ""}
              placeholder="What's the occasion?"
              rows={3}
              className="resize-none text-base sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              maxLength={200}
              defaultValue={initial?.location ?? ""}
              placeholder="Uncle's house, Park, etc."
              className="h-11 text-base sm:text-sm"
            />
          </div>

          <Label
            htmlFor="isAllDay"
            className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm font-normal text-foreground"
          >
            <input
              id="isAllDay"
              type="checkbox"
              checked={allDay}
              onChange={(e) => handleAllDayChange(e.target.checked)}
              className="size-5 shrink-0 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            All day — no start or end time
          </Label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">
                {allDay ? "First day" : "Start"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startsAt"
                type={allDay ? "date" : "datetime-local"}
                value={starts}
                onChange={(e) => {
                  setStarts(e.target.value);
                  setTimeError("");
                }}
                required
                aria-describedby="gathering-time-error"
                className="h-11 text-base [color-scheme:dark] sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">{allDay ? "Last day" : "End"}</Label>
              <Input
                id="endsAt"
                type={allDay ? "date" : "datetime-local"}
                value={ends}
                onChange={(e) => {
                  setEnds(e.target.value);
                  setTimeError("");
                }}
                aria-describedby="gathering-time-error"
                className="h-11 text-base [color-scheme:dark] sm:text-sm"
              />
            </div>
          </div>

          {!allDay && <p className="text-xs text-muted-foreground">Times use the timezone on your device.</p>}

          {/* Always rendered so an error never shifts the buttons under a thumb */}
          <p
            id="gathering-time-error"
            role="alert"
            className="min-h-4 text-xs text-foreground/80"
          >
            {timeError}
          </p>

          </HydratedFieldset>
          <div className="mt-5 flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            {/* A pending save cannot be stopped, so Cancel must not imply it. */}
            <Button
              type="button"
              variant="outline"
              disabled={!hydrated || loading}
              onClick={() => router.push(initial ? `/gatherings/${initial.id}` : "/gatherings")}
              className="h-11 w-full sm:h-9 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              ref={submitRef}
              type="submit"
              disabled={!hydrated}
              aria-disabled={loading || undefined}
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
