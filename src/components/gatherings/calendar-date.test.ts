import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarDate, calendarDayEnd, calendarDayStart, calendarInputValue } from "./calendar-date";
import { formatGatheringWhen } from "./format-gathering-when";

describe.each(["America/Toronto", "Pacific/Honolulu", "Pacific/Auckland"])("all-day calendar dates in %s", (timezone) => {
  beforeEach(() => vi.stubEnv("TZ", timezone));
  afterEach(() => vi.unstubAllEnvs());

  it("stores a selected day with the same UTC date in every timezone", () => {
    expect(calendarDayStart("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(calendarDayEnd("2026-01-01").toISOString()).toBe("2026-01-01T23:59:59.999Z");
  });

  it("edits and renders the chosen date without shifting to the previous day", () => {
    const iso = "2026-01-01T00:00:00.000Z";
    expect(calendarInputValue(iso)).toBe("2026-01-01");
    expect(calendarDate(iso).getFullYear()).toBe(2026);
    expect(calendarDate(iso).getMonth()).toBe(0);
    expect(calendarDate(iso).getDate()).toBe(1);
    expect(formatGatheringWhen(iso, "2026-01-01T23:59:59.999Z", true, "short")).toBe("Thu 1 Jan, all day");
  });

  it("keeps both dates of a multi-day all-day gathering", () => {
    expect(formatGatheringWhen("2026-01-01T00:00:00.000Z", "2026-01-03T23:59:59.999Z", true, "short")).toBe("Thu 1 Jan – Sat 3 Jan, all day");
  });
});
