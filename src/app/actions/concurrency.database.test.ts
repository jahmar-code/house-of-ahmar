import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { ROLE_HIERARCHY, type HoaRole } from "@/lib/constants";
import {
  contention,
  createIsolatedDatabase,
  instrumentedDb,
  requestIdentity,
  waitFor,
  type Db,
  type Injection,
  type IsolatedDatabase,
} from "@/test/isolated-database";

// Opt-in (OP-04). Real onboarding and membership actions run concurrent
// transactions on independent PostgreSQL connections. Only the per-request
// identity, cache invalidation, environment and audit edges are stubbed.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ HOA_DEFAULT_ACCESS_CODE: "RACE-FOUNDING-CODE" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        const identity = requestIdentity.getStore();
        return { data: { user: identity ? { id: identity.userId, email: identity.email } : null } };
      },
    },
  }),
}));
vi.mock("@/lib/auth", () => {
  const current = () => {
    const identity = requestIdentity.getStore();
    if (!identity) throw new Error("Unauthorized");
    return { userId: identity.userId, memberId: identity.memberId, displayName: "Fixture", role: identity.role, avatarUrl: null };
  };
  return {
    requireAuth: async () => current(),
    requireRole: async (minimum: HoaRole) => {
      const ctx = current();
      if (ROLE_HIERARCHY[ctx.role as HoaRole] < ROLE_HIERARCHY[minimum]) throw new Error("Insufficient permissions");
      return ctx;
    },
  };
});

const { completeInitiation } = await import("./onboarding");
const { updateMemberRole, deactivateMember } = await import("./members");

type Identity = { userId: string; memberId: string; role: string; email: string };
const relative = (role = "member"): Identity => {
  const userId = randomUUID();
  return { userId, memberId: randomUUID(), role, email: `${userId}@race.test` };
};
const as = <T,>(identity: Identity, run: () => Promise<T>) => requestIdentity.run(identity, run);
const joinForm = (code: string) => {
  const form = new FormData();
  form.set("displayName", "Race fixture");
  form.set("accessCode", code);
  return form;
};
const outcomes = <T,>(results: PromiseSettledResult<T>[]) => results.map((result) => (result.status === "fulfilled" ? result.value : result.reason));

let database: IsolatedDatabase;
async function seedMember(identity: Identity, role: HoaRole, isActive = true) {
  await database.db.insert(schema.members).values({ id: identity.memberId, authUserId: identity.userId, displayName: "Race fixture", role, isActive });
}
function raceDb(injection: Injection = {}, onFirstHolding?: () => void): Db {
  const db = instrumentedDb(database.db, contention(database, onFirstHolding), injection);
  state.db = db;
  return db;
}
const count = async (where?: ReturnType<typeof and>) =>
  (await database.db.select({ id: schema.members.id }).from(schema.members).where(where)).length;
const activeElders = () => count(and(eq(schema.members.role, "elder"), eq(schema.members.isActive, true)));

describe.skipIf(process.env.HOA_DATABASE_TESTS !== "1")("invitation and Elder invariants under real contention", () => {
  beforeEach(async () => {
    database = await createIsolatedDatabase(["members", "access_codes"]);
  });
  afterEach(async () => {
    state.db = null;
    await database.drop();
  });

  async function inviteRace(injection: Injection = {}) {
    await seedMember(relative("elder"), "elder");
    await database.db.insert(schema.accessCodes).values({ code: "RACE-LAST-USE", maxUses: 1 });
    raceDb(injection);
    const results = outcomes(await Promise.allSettled([relative(), relative()].map((identity) =>
      as(identity, () => completeInitiation(joinForm("RACE-LAST-USE"))))));
    const [code] = await database.db.select().from(schema.accessCodes).where(eq(schema.accessCodes.code, "RACE-LAST-USE"));
    return { results, members: await count(), code };
  }

  it("admits exactly one of two relatives racing for an invite's last use", async () => {
    const { results, members, code } = await inviteRace();
    expect(results.filter((result) => result?.success === true)).toHaveLength(1);
    expect(results.filter((result) => result?.success === false)).toEqual([
      { success: false, error: "That code isn't valid. Ask whoever invited you for a new one." },
    ]);
    expect(members).toBe(2);
    expect(code).toMatchObject({ useCount: 1, status: "used" });
  });

  it("still admits one relative when the locks are removed: the redemption guard rolls back the loser (failure injection)", async () => {
    // Without locks both requests pass every read; only the guard on the
    // redemption UPDATE (zero rows → roll back) keeps the invite single-use.
    const { results, members, code } = await inviteRace({ skipLocks: true });
    expect(members).toBe(2);
    expect(results).toContainEqual({ success: false, error: "That code has already been used. Ask for a fresh one." });
    expect(code).toMatchObject({ useCount: 1, status: "used" });
  });

  async function retryRace(injection: Injection = {}) {
    await seedMember(relative("elder"), "elder");
    await database.db.insert(schema.accessCodes).values({ code: "RACE-RETRY", maxUses: 5 });
    raceDb(injection);
    const phone = relative();
    const results = outcomes(await Promise.allSettled([1, 2].map(() => as(phone, () => completeInitiation(joinForm("RACE-RETRY"))))));
    const [code] = await database.db.select().from(schema.accessCodes).where(eq(schema.accessCodes.code, "RACE-RETRY"));
    return { results, joined: await count(eq(schema.members.authUserId, phone.userId)), code };
  }

  it("lets one relative's duplicate retry return the same membership and consume one use", async () => {
    const { results, joined, code } = await retryRace();
    expect(results.every((result) => result?.success === true)).toBe(true);
    expect(new Set(results.map((result) => result.data.memberId)).size).toBe(1);
    expect(joined).toBe(1);
    expect(code).toMatchObject({ useCount: 1, status: "active" });
  });

  it("detects a missing retry recheck under the lock (failure injection)", async () => {
    const { results } = await retryRace({ skipLocks: true });
    expect(results.every((result) => result?.success === true)).toBe(false);
  });

  it("creates one founding Elder when two people open an empty House at once", async () => {
    raceDb();
    const results = outcomes(await Promise.allSettled([relative(), relative()].map((identity) =>
      as(identity, () => completeInitiation(joinForm("RACE-FOUNDING-CODE"))))));
    expect(results.filter((result) => result?.success === true)).toHaveLength(1);
    expect(results.filter((result) => result?.success === false)).toHaveLength(1);
    expect(await count()).toBe(1);
    expect(await activeElders()).toBe(1);
    const codes = await database.db.select().from(schema.accessCodes);
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatchObject({ code: "RACE-FOUNDING-CODE", useCount: 1, status: "used" });
  });

  async function reciprocal(change: "demote" | "deactivate" | "mixed", injection: Injection = {}) {
    const first = relative("elder");
    const second = relative("elder");
    await seedMember(first, "elder");
    await seedMember(second, "elder");
    raceDb(injection);
    const act = (actor: Identity, target: Identity, kind: "demote" | "deactivate") =>
      as(actor, () => (kind === "demote" ? updateMemberRole(target.memberId, "member") : deactivateMember(target.memberId)));
    const results = outcomes(await Promise.allSettled([
      act(first, second, change === "deactivate" ? "deactivate" : "demote"),
      act(second, first, change === "demote" ? "demote" : "deactivate"),
    ]));
    return { results, elders: await activeElders() };
  }

  it.each(["demote", "deactivate", "mixed"] as const)("keeps an active Elder when two Elders %s each other", async (change) => {
    const { results, elders } = await reciprocal(change);
    expect(results).toContainEqual({ success: true });
    expect(results).toContainEqual({ success: false, error: "Insufficient permissions" });
    expect(elders).toBe(1);
  });

  it.each(["demote", "deactivate", "mixed"] as const)("detects a missing Elder lock when Elders %s each other (failure injection)", async (change) => {
    const { elders } = await reciprocal(change, { skipLocks: true });
    expect(elders).toBe(0);
  });

  async function staleActor(injection: Injection = {}) {
    const [first, second, third] = [relative("elder"), relative("elder"), relative("elder")];
    for (const elder of [first, second, third]) await seedMember(elder, "elder");
    let holding = false;
    raceDb(injection, () => { holding = true; });
    const demoteSecond = as(first, () => updateMemberRole(second.memberId, "member"));
    // The second request starts while the first holds the lock mid-transaction.
    await waitFor(() => holding, "the first Elder change to hold its lock");
    const demoteThird = as(second, () => updateMemberRole(third.memberId, "member"));
    const results = outcomes(await Promise.allSettled([demoteSecond, demoteThird]));
    const [thirdRow] = await database.db.select().from(schema.members).where(eq(schema.members.id, third.memberId));
    return { results, third: thirdRow };
  }

  it("rejects an Elder demoted while their own request waited", async () => {
    const { results, third } = await staleActor();
    expect(results).toEqual([{ success: true }, { success: false, error: "Insufficient permissions" }]);
    expect(third.role).toBe("elder");
  });

  it.each([{ skipActorRecheck: true }, { skipLocks: true }])("detects a missing stale-actor guard (failure injection %o)", async (injection) => {
    const { results, third } = await staleActor(injection);
    expect(results[1]).toEqual({ success: true });
    expect(third.role).toBe("member");
  });
});
