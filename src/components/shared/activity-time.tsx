"use client";

import { useSyncExternalStore } from "react";
import { format, formatDistanceToNow, isToday } from "date-fns";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Relative text and local clock times must not compare two hydration clocks. */
export function ActivityTime({ value, showTodayTime = false }: {
  value: Date | string;
  showTodayTime?: boolean;
}) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const date = new Date(value);
  const text = !ready ? "…" : showTodayTime && isToday(date)
    ? format(date, "h:mm a")
    : formatDistanceToNow(date, { addSuffix: true });

  return <time dateTime={date.toISOString()} title={ready ? date.toLocaleString() : undefined}>{text}</time>;
}
