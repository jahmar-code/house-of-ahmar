import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ member: { role: "member" } as { role: string } | null, download: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthContext: async () => state.member }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: () => ({ download: state.download }) } }) }));
const { GET } = await import("./route");
const read = (bucket = "feed-media", path = ["member", "photo.jpg"]) => GET(new Request("http://localhost/api/media"), { params: Promise.resolve({ bucket, path }) });
beforeEach(() => {
  state.member = { role: "member" }; state.download.mockReset();
  state.download.mockResolvedValue({ data: new Blob(["photo"], { type: "image/jpeg" }), error: null });
});
describe("private media transport", () => {
  it("requires current membership before contacting Storage", async () => {
    state.member = null;
    expect((await read()).status).toBe(401);
    expect(state.download).not.toHaveBeenCalled();
  });
  it("rejects other buckets and traversal", async () => {
    expect((await read("other")).status).toBe(404);
    expect((await read("feed-media", ["member", "..", "secret"])).status).toBe(404);
    expect((await read("feed-media", ["member", "%2e%2e", "secret"])).status).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
  it("serves images without shared caches or reusable signed URLs", async () => {
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });
  it("does not serve active HTML/SVG content as images", async () => {
    state.download.mockResolvedValue({ data: new Blob(["<svg/>"], { type: "image/svg+xml" }), error: null });
    expect((await read()).status).toBe(415);
  });
  it("hides Storage error details", async () => {
    state.download.mockResolvedValue({ data: null, error: { message: "internal secret" } });
    const response = await read();
    expect(response.status).toBe(404); expect(await response.text()).toBe("Not found");
  });
});
