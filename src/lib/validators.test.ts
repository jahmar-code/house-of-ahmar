import { describe, expect, it } from "vitest";
import {
  accessCodeSchema,
  channelSchema,
  commentSchema,
  createAccessCodeSchema,
  gatheringSchema,
  houseSettingsSchema,
  messageSchema,
  postSchema,
  profileSchema,
} from "./validators";

describe("accessCodeSchema", () => {
  it("trims and uppercases the code", () => {
    const result = accessCodeSchema.parse({ code: "  ahmar2002  " });
    expect(result.code).toBe("AHMAR2002");
  });

  it("rejects codes shorter than 4 chars", () => {
    expect(() => accessCodeSchema.parse({ code: "abc" })).toThrow();
  });

  it("rejects codes longer than 32 chars", () => {
    expect(() => accessCodeSchema.parse({ code: "x".repeat(33) })).toThrow();
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

  it("rejects more than 5 media urls", () => {
    expect(() =>
      messageSchema.parse({
        content: "hi",
        mediaUrls: Array(6).fill("https://example.com/a.jpg"),
      })
    ).toThrow();
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
