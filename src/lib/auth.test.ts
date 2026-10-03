import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "auth-user", user_metadata: { hoa_member_id: "forged", hoa_role: "elder" } } as unknown,
  member: { id: "member-id", displayName: "Relative", role: "guest", avatarUrl: null } as Record<string, unknown> | null,
  findFirst: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) }));
vi.mock("@/lib/db", () => ({ db: { query: { members: { findFirst: state.findFirst } } } }));
const { getAuthContext, requirePageAuth, requireRole } = await import("./auth");
beforeEach(() => {
  state.user = { id: "auth-user", user_metadata: { hoa_member_id: "forged", hoa_role: "elder" } };
  state.member = { id: "member-id", displayName: "Relative", role: "guest", avatarUrl: null };
  state.findFirst.mockReset().mockImplementation(async () => state.member);
});
describe("database-backed authorization", () => {
  it("ignores user-editable metadata membership and roles", async () => {
    expect(await getAuthContext()).toMatchObject({ userId: "auth-user", memberId: "member-id", role: "guest" });
    await expect(requireRole("elder")).rejects.toThrow("Insufficient permissions");
  });
  it("allows active guests to read protected pages", async () => {
    expect((await requirePageAuth()).role).toBe("guest");
  });
  it("redirects unjoined or deactivated identities before page reads", async () => {
    state.member = null;
    await expect(requirePageAuth()).rejects.toThrow("REDIRECT:/initiation");
  });
  it("never queries private member data for anonymous requests", async () => {
    state.user = null;
    expect(await getAuthContext()).toBeNull();
    expect(state.findFirst).not.toHaveBeenCalled();
  });
});
