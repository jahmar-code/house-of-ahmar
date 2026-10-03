import { beforeEach, describe, expect, it, vi } from "vitest";

const ACTOR = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const state = vi.hoisted(() => ({
  ctx: { memberId: "11111111-1111-4111-8111-111111111111", role: "elder", avatarUrl: null },
  actor: { isActive: true, role: "elder" },
  target: { role: "member", isActive: true, displayName: "Relative" } as Record<string, unknown> | undefined,
  elders: [{ id: "one" }], updates: [] as Record<string, unknown>[], locked: false,
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => state.ctx,
  requireRole: async () => { if (state.ctx.role !== "elder") throw new Error("Insufficient permissions"); return state.ctx; },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/db", () => {
  let reads = 0;
  const tx = {
    execute: async () => { state.locked = true; reads = 0; },
    query: { members: { findFirst: async () => { if (!state.locked) throw new Error("Missing invariant lock"); return reads++ === 0 ? state.actor : state.target; } } },
    select: () => ({ from: () => ({ where: async () => state.elders }) }),
    update: () => ({ set: (patch: Record<string, unknown>) => ({ where: async () => { state.updates.push(patch); } }) }),
  };
  return { db: { ...tx, transaction: async (fn: (tx: unknown) => unknown) => fn(tx) } };
});
const { updateMemberRole, deactivateMember, reactivateMember, updateProfile } = await import("./members");
beforeEach(() => {
  state.ctx.role = "elder"; state.actor = { role: "elder", isActive: true }; state.target = { role: "member", isActive: true, displayName: "Relative" };
  state.elders = [{ id: "one" }]; state.updates = []; state.locked = false;
});
describe("membership administration", () => {
  it("authorizes before changing a role", async () => {
    state.ctx.role = "member";
    await expect(updateMemberRole(TARGET, "elder")).rejects.toThrow("Insufficient permissions");
    expect(state.updates).toHaveLength(0);
  });
  it("rejects invalid UUID without querying Postgres", async () => {
    expect((await deactivateMember("invalid")).success).toBe(false);
    expect(state.locked).toBe(false);
  });
  it("rechecks the actor after taking the shared lock", async () => {
    state.actor.role = "member";
    expect((await updateMemberRole(TARGET, "elder")).success).toBe(false);
    expect(state.updates).toHaveLength(0);
  });
  it("refuses to demote the only active Elder", async () => {
    state.target!.role = "elder";
    expect((await updateMemberRole(TARGET, "member")).success).toBe(false);
    expect(state.updates).toHaveLength(0);
  });
  it("refuses to deactivate the only active Elder", async () => {
    state.target!.role = "elder";
    expect((await deactivateMember(TARGET)).success).toBe(false);
  });
  it("lets an inactive Elder's role change without counting them as active", async () => {
    state.target!.role = "elder"; state.target!.isActive = false;
    expect((await updateMemberRole(TARGET, "member")).success).toBe(true);
  });
  it("allows a role change when another active Elder remains", async () => {
    state.target!.role = "elder"; state.elders.push({ id: "two" });
    expect((await updateMemberRole(TARGET, "guest")).success).toBe(true);
    expect(state.updates[0].role).toBe("guest");
  });
  it("blocks self-deactivation", async () => {
    expect((await deactivateMember(ACTOR)).success).toBe(false);
  });
  it("reactivation is idempotent", async () => {
    expect((await reactivateMember(TARGET)).success).toBe(true);
    expect(state.updates).toHaveLength(0);
  });
  it("reactivates a paused member", async () => {
    state.target!.isActive = false;
    expect((await reactivateMember(TARGET)).success).toBe(true);
    expect(state.updates[0].isActive).toBe(true);
  });
  it("rejects another person's avatar", async () => {
    const fd = new FormData(); fd.set("displayName", "Relative"); fd.set("avatarUrl", `/api/media/feed-media/avatars/${TARGET}/photo.jpg`);
    expect((await updateProfile(fd)).success).toBe(false);
    expect(state.updates).toHaveLength(0);
  });
});
