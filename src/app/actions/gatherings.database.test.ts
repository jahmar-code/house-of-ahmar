import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { ROLE_HIERARCHY, type HoaRole } from "@/lib/constants";
import { createIsolatedDatabase, requestIdentity, waitFor, type Db, type IsolatedDatabase } from "@/test/isolated-database";

// Opt-in (DS-03). Real gathering actions and real PostgreSQL writes; a
// competing Elder/owner action is committed at the exact point between the
// edit's state read and its write. Only identity, cache and audit are stubbed.
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
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

const { updateGathering, cancelGathering, archivePastGatherings } = await import("./gatherings");

const owner = { userId: randomUUID(), memberId: randomUUID(), role: "member", email: "owner@race.test" };
const elder = { userId: randomUUID(), memberId: randomUUID(), role: "elder", email: "elder@race.test" };
const asOwner = <T,>(run: () => Promise<T>) => requestIdentity.run(owner, run);
const asElder = <T,>(run: () => Promise<T>) => requestIdentity.run(elder, run);
const PAST = new Date(Date.now() - 30 * 86_400_000);
const FUTURE = "2099-06-01T18:00:00.000Z";

function editForm(title = "Rescheduled dinner", startsAt = FUTURE) {
  const form = new FormData();
  form.set("title", title);
  form.set("startsAt", startsAt);
  return form;
}

let database: IsolatedDatabase;
let gatheringId: string;
const row = async () => (await database.db.select().from(schema.gatherings).where(eq(schema.gatherings.id, gatheringId)))[0];

/** Run `competitor` to completion right after the action's first gathering read. */
function interleaveAfterFirstRead(competitor: () => Promise<unknown>): Db {
  let pending = true;
  const query = new Proxy(database.db.query, {
    get(target, table) {
      const relation = Reflect.get(target, table, target);
      if (table !== "gatherings") return relation;
      return {
        ...relation,
        findFirst: async (...args: Parameters<typeof relation.findFirst>) => {
          const result = await relation.findFirst(...args);
          if (pending) {
            pending = false;
            state.db = database.db; // the competitor uses an ordinary connection
            await competitor();
            state.db = wrapped;
          }
          return result;
        },
      };
    },
  });
  const wrapped = new Proxy(database.db, {
    get: (target, property) => (property === "query" ? query : Reflect.get(target, property, target)),
  }) as Db;
  return wrapped;
}

describe.skipIf(process.env.HOA_DATABASE_TESTS !== "1")("gathering state transitions against PostgreSQL", () => {
  beforeEach(async () => {
    database = await createIsolatedDatabase(["gatherings"]);
    const [created] = await database.db.insert(schema.gatherings)
      .values({ title: "Old dinner", startsAt: PAST, createdBy: owner.memberId })
      .returning({ id: schema.gatherings.id });
    gatheringId = created.id;
  });
  afterEach(async () => {
    state.db = null;
    await database.drop();
  });

  it("refuses an edit when an Elder archives the gathering after it was loaded", async () => {
    state.db = interleaveAfterFirstRead(() => asElder(() => archivePastGatherings(7)));
    const result = await asOwner(() => updateGathering(gatheringId, editForm()));
    expect(result).toEqual({
      success: false,
      error: "This gathering was archived while you were working on it. Your changes weren't saved.",
    });
    const persisted = await row();
    expect(persisted.archivedAt).not.toBeNull();
    expect(persisted.title).toBe("Old dinner");
    expect(persisted.startsAt.getTime()).toBe(PAST.getTime());
  });

  it("does not archive a gathering that was rescheduled first", async () => {
    state.db = database.db;
    expect(await asOwner(() => updateGathering(gatheringId, editForm()))).toEqual({ success: true });
    expect(await asElder(() => archivePastGatherings(7))).toEqual({ success: true, data: { archived: 0 } });
    expect((await row()).archivedAt).toBeNull();
  });

  it("rechecks the end time when a reschedule commits while the archiver waits for the row", async () => {
    state.db = database.db;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked = false;
    const reschedule = database.client.begin(async (tx) => {
      await tx.unsafe("update gatherings set starts_at = $1, ends_at = null where id = $2", [FUTURE, gatheringId]);
      locked = true;
      await held;
    });
    await waitFor(() => locked, "the reschedule to hold its row lock");
    const archiving = asElder(() => archivePastGatherings(7));
    await waitFor(async () => (await database.lockWaiters()) > 0, "the archiver to wait for that row");
    release();
    await reschedule;
    expect(await archiving).toEqual({ success: true, data: { archived: 0 } });
    expect((await row()).archivedAt).toBeNull();
  });

  it("refuses an edit when the gathering is cancelled after it was loaded", async () => {
    await database.db.update(schema.gatherings).set({ startsAt: new Date(FUTURE) }).where(eq(schema.gatherings.id, gatheringId));
    state.db = interleaveAfterFirstRead(() => asElder(() => cancelGathering(gatheringId)));
    const result = await asOwner(() => updateGathering(gatheringId, editForm("Renamed")));
    expect(result.success).toBe(false);
    expect(!result.success && result.error).toMatch(/cancelled while you were working on it/);
    expect(await row()).toMatchObject({ isCancelled: true, title: "Old dinner" });
  });

  it("keeps an edit that landed before a cancellation", async () => {
    state.db = database.db;
    expect(await asOwner(() => updateGathering(gatheringId, editForm("Renamed")))).toEqual({ success: true });
    expect(await asElder(() => cancelGathering(gatheringId))).toEqual({ success: true });
    expect(await row()).toMatchObject({ isCancelled: true, title: "Renamed", archivedAt: null });
  });

  it("refuses a cancellation when an Elder archives the gathering after it was loaded", async () => {
    state.db = interleaveAfterFirstRead(() => asElder(() => archivePastGatherings(7)));
    const result = await asOwner(() => cancelGathering(gatheringId));
    expect(result).toEqual({
      success: false,
      error: "This gathering was archived while you were working on it. Nothing was changed.",
    });
    const persisted = await row();
    expect(persisted.isCancelled).toBe(false);
    expect(persisted.archivedAt).not.toBeNull();
  });
});
