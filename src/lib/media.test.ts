import { describe, expect, it } from "vitest";
import { isSafeStoragePath, ownedMediaUrl, parseMediaUrl, privateMediaUrl } from "./media";
describe("private media addresses", () => {
  it("round-trips names safely", () => {
    const url = privateMediaUrl("feed-media", "member/photo one.jpg");
    expect(parseMediaUrl(url)).toEqual({ bucket: "feed-media", path: "member/photo one.jpg" });
  });
  it.each(["../secret", "member/../secret", "member//file", "member\\file", "a?download=1", "a#frag", "a\u0000b"])("rejects unsafe path %j", (path) => expect(isSafeStoragePath(path)).toBe(false));
  it("requires the configured Storage origin for legacy URLs", () => {
    expect(parseMediaUrl("https://house.supabase.co/storage/v1/object/public/feed-media/a.jpg", "https://house.supabase.co")?.path).toBe("a.jpg");
    expect(parseMediaUrl("https://tracker.test/storage/v1/object/public/feed-media/a.jpg", "https://house.supabase.co")).toBeNull();
  });
  it("rejects another member's photo and external tracker", () => {
    expect(ownedMediaUrl("/api/media/feed-media/other/a.jpg", "me")).toBeNull();
    expect(ownedMediaUrl("https://tracker.test/photo", "me")).toBeNull();
  });
  it("accepts separate avatar and post namespaces", () => {
    expect(ownedMediaUrl("/api/media/feed-media/me/a.jpg", "me")).toBe("/api/media/feed-media/me/a.jpg");
    expect(ownedMediaUrl("/api/media/feed-media/avatars/me/a.jpg", "me", true)).toBe("/api/media/feed-media/avatars/me/a.jpg");
    expect(ownedMediaUrl("/api/media/feed-media/avatars/me/a.jpg", "me")).toBeNull();
  });
  it("does not accept traversal after percent decoding", () => {
    expect(parseMediaUrl("/api/media/feed-media/me/%2e%2e/secret")).toBeNull();
  });
});
