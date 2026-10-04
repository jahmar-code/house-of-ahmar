"use client";

import { useSyncExternalStore } from "react";
import { differenceInCalendarDays, format, isFuture, isPast, startOfToday } from "date-fns";
import { formatGatheringDay, formatGatheringWhen } from "./format-gathering-when";
import { calendarDate } from "./calendar-date";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Keep the server's timezone out of a relative's calendar and avoid hydration drift. */
export function GatheringDate({ startsAt, endsAt = null, isAllDay = false, style = "short", part }: {
  startsAt: Date | string;
  endsAt?: Date | string | null;
  isAllDay?: boolean | null;
  /** `date` is the weekday and day alone, for compact summaries. */
  style?: "short" | "long" | "date";
  part?: "month" | "day";
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const start = new Date(startsAt);
  const text = !ready ? "…" : part
    ? format(isAllDay ? calendarDate(startsAt) : start, part === "month" ? "MMM" : "d")
    : style === "date"
      ? formatGatheringDay(startsAt, isAllDay)
      : formatGatheringWhen(startsAt, endsAt, isAllDay, style);

  return <time dateTime={isAllDay ? start.toISOString().slice(0, 10) : start.toISOString()} title={ready && !isAllDay ? start.toLocaleString(undefined, { timeZoneName: "short" }) : undefined}>{text}</time>;
}

/** "is today" / "is on Saturday" for the next gathering, on the viewer's calendar. */
export function GatheringDayPhrase({ startsAt, endsAt = null, isAllDay = false }: {
  startsAt: Date | string;
  endsAt?: Date | string | null;
  isAllDay?: boolean | null;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  if (!ready) return <>is coming up</>;
  const start = isAllDay ? calendarDate(startsAt) : new Date(startsAt);
  if (!isAllDay && isPast(start) && (!endsAt || isFuture(new Date(endsAt)))) {
    return <>is happening now</>;
  }
  const daysAway = differenceInCalendarDays(start, startOfToday());
  if (daysAway < 0) return <>is happening now</>;
  if (daysAway === 0) return <>is today</>;
  if (daysAway === 1) return <>is tomorrow</>;
  return <>is on {format(start, daysAway <= 6 ? "EEEE" : "MMM d")}</>;
}
