import { describe, expect, it } from "vitest";
import { compareMessages, timestampMicros } from "./message-order";

describe("precise Council ordering", () => {
  it("keeps PostgreSQL microseconds from Realtime ISO timestamps", () => {
    expect(BigInt(timestampMicros("2026-10-03T12:00:00.123900Z")) - BigInt(timestampMicros("2026-10-03T12:00:00.123100Z"))).toBe(BigInt(800));
  });
  it("normalizes timezone offsets and variable fractional lengths", () => {
    expect(timestampMicros("2026-10-03T08:00:00.1239-04:00")).toBe(timestampMicros("2026-10-03T12:00:00.123900+00:00"));
    expect(timestampMicros("2026-10-03T12:00:00.1Z")).toBe(timestampMicros(new Date("2026-10-03T12:00:00.100Z")));
  });
  it("places different microseconds before UUID ties", () => {
    const createdAt = new Date("2026-10-03T12:00:00.123Z");
    const older = { id: "z", createdAt, createdAtMicros: timestampMicros("2026-10-03T12:00:00.123100Z") };
    const newer = { id: "a", createdAt, createdAtMicros: timestampMicros("2026-10-03T12:00:00.123900Z") };
    expect([newer, older].sort(compareMessages)).toEqual([older, newer]);
  });
});
