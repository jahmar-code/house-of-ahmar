"use client";

import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { formatGatheringWhen } from "./format-gathering-when";
import { calendarDate } from "./calendar-date";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Keep the server's timezone out of a relative's calendar and avoid hydration drift. */
export function GatheringDate({ startsAt, endsAt = null, isAllDay = false, style = "short", part }: {
  startsAt: Date | string;
  endsAt?: Date | string | null;
  isAllDay?: boolean | null;
  style?: "short" | "long";
  part?: "month" | "day";
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const start = new Date(startsAt);
  const text = !ready ? "…" : part
    ? format(isAllDay ? calendarDate(startsAt) : start, part === "month" ? "MMM" : "d")
    : formatGatheringWhen(startsAt, endsAt, isAllDay, style);

  return <time dateTime={isAllDay ? start.toISOString().slice(0, 10) : start.toISOString()} title={ready && !isAllDay ? start.toLocaleString(undefined, { timeZoneName: "short" }) : undefined}>{text}</time>;
}
