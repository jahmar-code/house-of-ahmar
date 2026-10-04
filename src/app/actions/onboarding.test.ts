import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1", email: "owner@example.test" } as { id: string; email: string } | null,
  member: null as Record<string, unknown> | null,
  memberCount: 0,
  invite: { id: "invite", status: "active", maxUses: 1, useCount: 0, expiresAt: null } as Record<string, unknown> | null,
  inserted: [] as Record<string, unknown>[],
  redemptions: 0,
  lockQueries: 0,
  queue: Promise.resolve(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ HOA_DEFAULT_ACCESS_CODE: "FOUNDING" }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }), recordFailedAttempt: vi.fn(), clearRateLimit: vi.fn() }));
vi.mock("@/lib/db", () => {
  const db = {
    execute: async () => { state.lockQueries++; },
    query: { members: { findFirst: async () => state.member }, accessCodes: { findFirst: async () => state.invite } },
    select: () => ({ from: () => ({
      then: (resolve: (v: unknown) => unknown) => Promise.resolve([{ count: state.memberCount }]).then(resolve),
      where: () => ({ for: async () => state.invite ? [state.invite] : [] }),
    }) }),
    insert: () => ({ values: (row: Record<string, unknown>) => ({
      onConflictDoNothing: async () => {},
      returning: async () => {
        state.inserted.push(row);
        state.member = { id: "new-member", isActive: true, ...row };
        state.memberCount++;
        return [state.member];
      },
    }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => { state.redemptions++; return [{ id: "invite" }]; } }) }) }),
    transaction: async (fn: (tx: unknown) => unknown) => {
      const turn = state.queue.then(() => fn(db));
      state.queue = turn.then(() => undefined, () => undefined);
      return turn;
    },
  };
  return { db };
});
const { completeInitiation, validateAccessCode } = await import("./onboarding");
function form(code = "FOUNDING") {
  const data = new FormData(); data.set("displayName", "Founding Relative"); data.set("accessCode", code); return data;
}
beforeEach(() => {
  state.user = { id: "user-1", email: "owner@example.test" };
  state.member = null; state.memberCount = 0; state.inserted = []; state.redemptions = 0; state.lockQueries = 0;
  state.queue = Promise.resolve();
  state.invite = { id: "invite", status: "active", maxUses: 1, useCount: 0, expiresAt: null };
});
describe("invite redemption", () => {
  it("rejects anonymous callers", async () => {
    state.user = null;
    expect((await completeInitiation(form())).success).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });
  it("creates the founding Elder and consumes the invite once", async () => {
    expect((await completeInitiation(form())).success).toBe(true);
    expect(state.inserted[0].role).toBe("elder");
    expect(state.redemptions).toBe(1);
    expect(state.lockQueries).toBe(1);
  });
  it("retires the bootstrap code once any member exists", async () => {
    state.memberCount = 1;
    expect((await completeInitiation(form())).success).toBe(false);
    const data = new FormData(); data.set("code", "FOUNDING");
    expect((await validateAccessCode(data)).success).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });
  it("gives later invitees the member role", async () => {
    state.memberCount = 2;
    expect((await completeInitiation(form("OTHER-CODE"))).success).toBe(true);
    expect(state.inserted[0].role).toBe("member");
  });
  it("rechecks same-user retries after acquiring the transaction lock", async () => {
    const results = await Promise.all([completeInitiation(form()), completeInitiation(form())]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(state.inserted).toHaveLength(1);
    expect(state.redemptions).toBe(1);
  });
  it.each(["revoked", "used"])("rejects a %s invite without a membership write", async (status) => {
    state.invite!.status = status;
    expect((await completeInitiation(form("OTHER-CODE"))).success).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });
  it("rejects an expired invite", async () => {
    state.invite!.expiresAt = new Date(0);
    expect((await completeInitiation(form("OTHER-CODE"))).success).toBe(false);
  });
  it("does not let a paused member revive themselves", async () => {
    state.member = { id: "old-member", isActive: false };
    expect((await completeInitiation(form())).success).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });
  it("rejects File input instead of throwing on trim", async () => {
    const data = form(); data.set("accessCode", new File(["test"], "code.txt"));
    expect((await completeInitiation(data)).success).toBe(false);
  });
});
