import { format, isSameDay } from "date-fns";
import { calendarDate } from "./calendar-date";

/** The viewer's calendar day for a gathering: local for timed, stored for all-day. */
export function formatGatheringDay(startsAt: Date | string, isAllDay: boolean | null): string {
  return format(isAllDay ? calendarDate(startsAt) : new Date(startsAt), "EEEE, MMMM d");
}

/**
 * One place that turns a gathering's start/end/all-day trio into words.
 *
 * Both the card and the detail page used to print the end *time* only, so a
 * dinner that runs from Friday evening to Sunday read as "6:00 PM — 1:00 PM".
 * All-day gatherings had no representation at all even though the column and
 * the validator carry `isAllDay`.
 */
export function formatGatheringWhen(
  startsAt: Date | string,
  endsAt: Date | string | null,
  isAllDay: boolean | null,
  style: "long" | "short"
): string {
  const allDay = Boolean(isAllDay);
  const start = allDay ? calendarDate(startsAt) : new Date(startsAt);
  const end = endsAt ? (allDay ? calendarDate(endsAt) : new Date(endsAt)) : null;
  // An end that lands on the start day adds nothing beyond a closing time.
  const spansDays = end !== null && !isSameDay(start, end);

  if (style === "short") {
    if (allDay) {
      return spansDays && end
        ? `${format(start, "EEE d MMM")} – ${format(end, "EEE d MMM")}, all day`
        : `${format(start, "EEE d MMM")}, all day`;
    }
    if (spansDays && end) {
      return `${format(start, "EEE h:mm a")} – ${format(end, "EEE h:mm a")}`;
    }
    return format(start, "EEE, h:mm a");
  }

  if (allDay) {
    return spansDays && end
      ? `${format(start, "EEEE, MMMM d")} – ${format(end, "EEEE, MMMM d, yyyy")} · All day`
      : `${format(start, "EEEE, MMMM d, yyyy")} · All day`;
  }
  if (spansDays && end) {
    return `${format(start, "EEEE, MMMM d, yyyy 'at' h:mm a")} — ${format(end, "EEEE, MMMM d, yyyy 'at' h:mm a")}`;
  }
  if (end) {
    return `${format(start, "EEEE, MMMM d, yyyy 'at' h:mm a")} — ${format(end, "h:mm a")}`;
  }
  return format(start, "EEEE, MMMM d, yyyy 'at' h:mm a");
}
