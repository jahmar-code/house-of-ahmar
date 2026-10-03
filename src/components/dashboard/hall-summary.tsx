import { CalendarHeart } from "lucide-react";
import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import type { Gathering, Member } from "@/types";
import { calendarDate } from "@/components/gatherings/calendar-date";

interface HallSummaryProps {
  members: Member[];
  /** Upcoming gatherings, soonest first. */
  gatherings: Gathering[];
}

/**
 * The one warm line at the top of the Great Hall: the next birthday and the
 * next gathering, in a sentence. This is what a family actually opens the app
 * to find out — it replaces a row of counters that never moved.
 */
export function HallSummary({ members, gatherings }: HallSummaryProps) {
  const today = startOfToday();
  const currentYear = today.getFullYear();

  // Same local-calendar parse as UpcomingBirthdays: never `new Date(str)` on a
  // 'YYYY-MM-DD' birthday, which lands a day early west of UTC.
  const nextBirthday = members
    .filter((m) => m.birthday)
    .map((m) => {
      const [, mo, d] = m.birthday!.split("-").map(Number);
      let next = new Date(currentYear, mo - 1, d);
      if (differenceInCalendarDays(next, today) < 0) {
        next = new Date(currentYear + 1, mo - 1, d);
      }
      return {
        name: m.displayName,
        daysUntil: differenceInCalendarDays(next, today),
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];

  const nextGathering = gatherings[0];

  const parts: string[] = [];

  // Only worth saying if it is actually near.
  if (nextBirthday && nextBirthday.daysUntil <= 30) {
    parts.push(
      nextBirthday.daysUntil === 0
        ? `${nextBirthday.name}'s birthday is today`
        : nextBirthday.daysUntil === 1
          ? `${nextBirthday.name}'s birthday is tomorrow`
          : `${nextBirthday.name}'s birthday is in ${nextBirthday.daysUntil} days`
    );
  }

  if (nextGathering) {
    const startsAt = nextGathering.isAllDay ? calendarDate(nextGathering.startsAt) : new Date(nextGathering.startsAt);
    const daysAway = differenceInCalendarDays(startsAt, today);
    const when =
      daysAway < 0
        ? "is happening now"
        : daysAway === 0
        ? "is today"
        : daysAway === 1
          ? "is tomorrow"
          : daysAway <= 6
            ? `is on ${format(startsAt, "EEEE")}`
            : `is on ${format(startsAt, "MMM d")}`;
    parts.push(`${nextGathering.title} ${when}`);
  }

  if (parts.length === 0) return null;

  return (
    <p className="mb-6 flex items-start gap-2.5 text-sm text-foreground">
      <CalendarHeart
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
        aria-hidden="true"
      />
      <span>{parts.join(" · ")}</span>
    </p>
  );
}
