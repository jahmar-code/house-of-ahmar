import { describe, expect, it } from "vitest";
import { workshopRewritePath } from "./routing";

const HOST = "agents.kabul-afghanistan.ca";

describe("workshopRewritePath", () => {
  it("leaves every other host alone", () => {
    expect(workshopRewritePath("/", "kabul-afghanistan.ca", HOST)).toBeNull();
    expect(workshopRewritePath("/feed", "house-of-ahmar.vercel.app", HOST)).toBeNull();
    expect(workshopRewritePath("/", HOST, undefined)).toBeNull();
  });

  it("maps the Workshop host's root and pages into /workshop", () => {
    expect(workshopRewritePath("/", HOST, HOST)).toBe("/workshop");
    expect(workshopRewritePath("/agents/123", HOST, HOST)).toBe("/workshop/agents/123");
    expect(workshopRewritePath("/sign-in", HOST, HOST)).toBe("/workshop/sign-in");
    expect(workshopRewritePath("/sign-up", HOST, HOST)).toBe("/workshop/sign-up");
  });

  it("never serves family pages on the Workshop host", () => {
    for (const path of ["/feed", "/dashboard", "/council/abc", "/elder-council", "/members"]) {
      expect(workshopRewritePath(path, HOST, HOST)).toBe(`/workshop${path}`);
    }
  });

  it("passes through Workshop paths and shared auth/API plumbing", () => {
    for (const path of ["/workshop", "/workshop/connect", "/api/agents/v1/heartbeat", "/auth/confirm", "/reset-password"]) {
      expect(workshopRewritePath(path, HOST, HOST)).toBeNull();
    }
  });

  it("does not expose House APIs such as media on the Workshop host", () => {
    expect(workshopRewritePath("/api/media/feed-media/a.jpg", HOST, HOST)).toBe("/workshop/api/media/feed-media/a.jpg");
  });
});
