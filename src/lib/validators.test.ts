import { describe, expect, it } from "vitest";
import {
  accessCodeSchema,
  archiveThresholdSchema,
  channelSchema,
  commentSchema,
  createAccessCodeSchema,
  gatheringSchema,
  houseSettingsSchema,
  messageSchema,
  postSchema,
  profileSchema,
  renameChannelSchema,
} from "./validators";
import { MILESTONE_KINDS } from "./constants";

describe("accessCodeSchema", () => {
  it("trims and uppercases the code", () => {
    const result = accessCodeSchema.parse({ code: "  local-test-code  " });
    expect(result.code).toBe("LOCAL-TEST-CODE");
  });

  it("rejects codes shorter than 4 chars", () => {
    expect(() => accessCodeSchema.parse({ code: "abc" })).toThrow();
  });

  it("rejects codes longer than 32 chars", () => {
    expect(() => accessCodeSchema.parse({ code: "x".repeat(33) })).toThrow();
  });
});

describe("profileSchema.birthday", () => {
  it("rejects a day that does not exist — Postgres `date` would reject it too", () => {
    // Date.parse("2000-02-31") silently rolls to March 2nd; the old initiation
    // validator accepted it, then Settings refused to re-save the same profile.
    const result = profileSchema.safeParse({
      displayName: "Layla",
      birthday: "2000-02-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a birthday in the future", () => {
    const nextYear = new Date().getFullYear() + 1;
    const result = profileSchema.safeParse({
      displayName: "Layla",
      birthday: `${nextYear}-06-01`,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a real past date", () => {
    const result = profileSchema.safeParse({
      displayName: "Layla",
      birthday: "1991-02-28",
    });
    expect(result.success).toBe(true);
  });

  it("stays optional — a relative may skip it at initiation", () => {
    const result = profileSchema.safeParse({ displayName: "Layla" });
    expect(result.success).toBe(true);
  });
});

describe("profileSchema", () => {
  it("accepts the minimum required fields", () => {
    const result = profileSchema.parse({ displayName: "Aza" });
    expect(result.displayName).toBe("Aza");
    expect(result.fullName).toBeUndefined();
  });

  it("trims displayName", () => {
    const result = profileSchema.parse({ displayName: "  Aza  " });
    expect(result.displayName).toBe("Aza");
  });

  it("rejects displayName under 2 chars", () => {
    expect(() => profileSchema.parse({ displayName: "A" })).toThrow();
  });

  it("rejects bio over 500 chars", () => {
    expect(() =>
      profileSchema.parse({ displayName: "Aza", bio: "x".repeat(501) })
    ).toThrow();
  });

  it("accepts a past calendar birthday", () => {
    const result = profileSchema.parse({
      displayName: "Aza",
      birthday: "1990-06-15",
    });
    expect(result.birthday).toBe("1990-06-15");
  });

  it("rejects a birthday that is not a calendar date", () => {
    expect(() =>
      profileSchema.parse({ displayName: "Aza", birthday: "not-a-date" })
    ).toThrow();
  });

  it("rejects an impossible calendar date", () => {
    expect(() =>
      profileSchema.parse({ displayName: "Aza", birthday: "1990-13-45" })
    ).toThrow();
  });

  it("rejects a birthday in the future", () => {
    expect(() =>
      profileSchema.parse({ displayName: "Aza", birthday: "2099-01-01" })
    ).toThrow();
  });
});

describe("postSchema", () => {
  it("defaults type to 'text'", () => {
    const result = postSchema.parse({ content: "hello" });
    expect(result.type).toBe("text");
  });

  it("accepts photo type with mediaUrls", () => {
    const result = postSchema.parse({
      content: "look",
      type: "photo",
      mediaUrls: ["https://example.com/a.jpg"],
    });
    expect(result.mediaUrls).toEqual(["https://example.com/a.jpg"]);
  });

  it("rejects empty content", () => {
    expect(() => postSchema.parse({ content: "" })).toThrow();
  });

  it("rejects more than 10 media urls", () => {
    expect(() =>
      postSchema.parse({
        content: "x",
        mediaUrls: Array(11).fill("https://example.com/a.jpg"),
      })
    ).toThrow();
  });

  it("rejects unknown post type", () => {
    expect(() =>
      postSchema.parse({ content: "x", type: "video" })
    ).toThrow();
  });

  // The enum is derived from MILESTONE_KINDS, so this pins them together.
  it.each(MILESTONE_KINDS.map((m) => m.key))(
    "accepts the '%s' milestone kind",
    (kind) => {
      const result = postSchema.parse({ content: "x", milestoneKind: kind });
      expect(result.milestoneKind).toBe(kind);
    }
  );

  it("rejects a milestone kind that is not in MILESTONE_KINDS", () => {
    expect(() =>
      postSchema.parse({ content: "x", milestoneKind: "retirement" })
    ).toThrow();
  });
});

describe("commentSchema", () => {
  it("rejects empty comment", () => {
    expect(() => commentSchema.parse({ content: "" })).toThrow();
  });

  it("rejects comments over 2000 chars", () => {
    expect(() =>
      commentSchema.parse({ content: "x".repeat(2001) })
    ).toThrow();
  });
});

describe("gatheringSchema", () => {
  it("normalizes all-day inputs to UTC calendar bounds on the server", () => {
    const result = gatheringSchema.parse({ title: "Family day", startsAt: "2026-05-01T19:00:00.000Z", isAllDay: true });
    expect(result.startsAt).toBe("2026-05-01T00:00:00.000Z");
    expect(result.endsAt).toBe("2026-05-01T23:59:59.999Z");
  });

  it("rejects reversed calendar days for all-day gatherings", () => {
    expect(gatheringSchema.safeParse({ title: "Family day", startsAt: "2026-05-02T00:00:00.000Z", endsAt: "2026-05-01T23:59:59.999Z", isAllDay: true }).success).toBe(false);
  });

  it("accepts a minimal valid gathering", () => {
    const result = gatheringSchema.parse({
      title: "Eid",
      startsAt: "2026-05-01T19:00:00.000Z",
    });
    expect(result.title).toBe("Eid");
    expect(result.isAllDay).toBe(false);
  });

  it("rejects non-ISO startsAt", () => {
    expect(() =>
      gatheringSchema.parse({ title: "Eid", startsAt: "2026-05-01 19:00" })
    ).toThrow();
  });

  it("rejects title under 2 chars", () => {
    expect(() =>
      gatheringSchema.parse({
        title: "x",
        startsAt: "2026-05-01T19:00:00.000Z",
      })
    ).toThrow();
  });

  it("accepts an endsAt one millisecond after startsAt", () => {
    const result = gatheringSchema.parse({
      title: "Eid",
      startsAt: "2026-05-01T19:00:00.000Z",
      endsAt: "2026-05-01T19:00:00.001Z",
    });
    expect(result.endsAt).toBe("2026-05-01T19:00:00.001Z");
  });

  it("rejects an endsAt before startsAt", () => {
    const parsed = gatheringSchema.safeParse({
      title: "Family Dinner",
      startsAt: "2026-09-05T23:00:00.000Z",
      endsAt: "2026-09-05T21:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        "End time must be after the start time"
      );
      expect(parsed.error.issues[0].path).toEqual(["endsAt"]);
    }
  });

  it("rejects an endsAt equal to startsAt", () => {
    expect(() =>
      gatheringSchema.parse({
        title: "Eid",
        startsAt: "2026-05-01T19:00:00.000Z",
        endsAt: "2026-05-01T19:00:00.000Z",
      })
    ).toThrow();
  });

  it("accepts an omitted endsAt", () => {
    const result = gatheringSchema.parse({
      title: "Eid",
      startsAt: "2026-05-01T19:00:00.000Z",
    });
    expect(result.endsAt).toBeUndefined();
  });
});

describe("messageSchema", () => {
  it("accepts replyToId as a UUID", () => {
    const id = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const result = messageSchema.parse({ content: "hi", replyToId: id });
    expect(result.replyToId).toBe(id);
  });

  it("rejects replyToId that isn't a UUID", () => {
    expect(() =>
      messageSchema.parse({ content: "hi", replyToId: "not-a-uuid" })
    ).toThrow();
  });

  it("rejects empty content", () => {
    expect(() => messageSchema.parse({ content: "" })).toThrow();
  });

  // mediaUrls was removed: the Council composer has no media UI and sendMessage
  // never persisted it, so the schema must not advertise it.
  it("drops any mediaUrls it is handed", () => {
    const result = messageSchema.parse({
      content: "hi",
      mediaUrls: ["https://example.com/a.jpg"],
    });
    expect(result).not.toHaveProperty("mediaUrls");
  });
});

describe("renameChannelSchema", () => {
  it("trims the name", () => {
    const result = renameChannelSchema.parse({ name: "  Cousins  " });
    expect(result.name).toBe("Cousins");
  });

  it("rejects a name under 2 chars", () => {
    expect(() => renameChannelSchema.parse({ name: "x" })).toThrow();
  });
});

describe("archiveThresholdSchema", () => {
  it("accepts a sane day count", () => {
    expect(archiveThresholdSchema.parse(7)).toBe(7);
  });

  it("rejects a negative threshold (it would archive future gatherings)", () => {
    expect(() => archiveThresholdSchema.parse(-30)).toThrow();
  });

  it("rejects zero", () => {
    expect(() => archiveThresholdSchema.parse(0)).toThrow();
  });

  it("rejects NaN", () => {
    expect(() => archiveThresholdSchema.parse(Number.NaN)).toThrow();
  });

  it("rejects a fractional threshold", () => {
    expect(() => archiveThresholdSchema.parse(1.5)).toThrow();
  });

  it("rejects more than 365 days", () => {
    expect(() => archiveThresholdSchema.parse(366)).toThrow();
  });
});

describe("channelSchema", () => {
  it("defaults type to 'general'", () => {
    const result = channelSchema.parse({ name: "Cousins" });
    expect(result.type).toBe("general");
  });

  it("rejects unknown channel type", () => {
    expect(() =>
      channelSchema.parse({ name: "Cousins", type: "video" })
    ).toThrow();
  });
});

describe("createAccessCodeSchema", () => {
  it("defaults maxUses to 1", () => {
    const result = createAccessCodeSchema.parse({});
    expect(result.maxUses).toBe(1);
  });

  it("rejects maxUses over 100", () => {
    expect(() => createAccessCodeSchema.parse({ maxUses: 101 })).toThrow();
  });

  it("coerces a numeric FormData string", () => {
    const result = createAccessCodeSchema.parse({ maxUses: "5" });
    expect(result.maxUses).toBe(5);
  });

  it("rejects a zero maxUses instead of silently making it 1", () => {
    const parsed = createAccessCodeSchema.safeParse({ maxUses: "0" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unparseable maxUses instead of silently making it 1", () => {
    const parsed = createAccessCodeSchema.safeParse({ maxUses: "abc" });
    expect(parsed.success).toBe(false);
  });
});

describe("houseSettingsSchema", () => {
  it("requires houseName", () => {
    expect(() => houseSettingsSchema.parse({ houseName: "x" })).toThrow();
  });

  it("accepts empty optional fields with defaults", () => {
    const result = houseSettingsSchema.parse({ houseName: "House of Ahmar" });
    expect(result.houseTagline).toBe("");
    expect(result.coverImageUrl).toBe("");
  });

  it("accepts a valid cover image URL", () => {
    const result = houseSettingsSchema.parse({
      houseName: "House of Ahmar",
      coverImageUrl: "https://example.com/cover.jpg",
    });
    expect(result.coverImageUrl).toBe("https://example.com/cover.jpg");
  });

  it("accepts an empty cover image URL", () => {
    const result = houseSettingsSchema.parse({
      houseName: "House of Ahmar",
      coverImageUrl: "",
    });
    expect(result.coverImageUrl).toBe("");
  });

  it("rejects a non-URL cover image value", () => {
    expect(() =>
      houseSettingsSchema.parse({
        houseName: "House of Ahmar",
        coverImageUrl: "not a url",
      })
    ).toThrow();
  });
});


describe("trimmed required fields", () => {
  it("rejects whitespace-only names, messages, comments, and channel names", () => {
    expect(profileSchema.safeParse({ displayName: "  " }).success).toBe(false);
    expect(messageSchema.safeParse({ content: " \n " }).success).toBe(false);
    expect(commentSchema.safeParse({ content: "  " }).success).toBe(false);
    expect(channelSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(houseSettingsSchema.safeParse({ houseName: "  " }).success).toBe(false);
  });
});
