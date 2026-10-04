import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_HIERARCHY, type HoaRole } from "@/lib/constants";

// Same shape as feed.test.ts: mock the auth and db edges, assert the branches
// in between — and that a refused mutation writes nothing.

const auth = vi.hoisted(() => ({
  ctx: {
    userId: "user-1",
    memberId: "member-1",
    displayName: "Aza",
    role: "member" as HoaRole,
    avatarUrl: null,
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthContext: async () => auth.ctx,
  requireAuth: async () => auth.ctx,
  requireRole: async (minimumRole: HoaRole) => {
    if (ROLE_HIERARCHY[auth.ctx.role] < ROLE_HIERARCHY[minimumRole]) {
      throw new Error("Insufficient permissions");
    }
    return auth.ctx;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const audit = vi.hoisted(() => ({ logAudit: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: audit.logAudit }));

const dbMock = vi.hoisted(() => {
  const step = (value: unknown, extra: Record<string, unknown> = {}) => ({
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
    ...extra,
  });

  const inserted: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  // Rows a conditional UPDATE ... RETURNING matched (none = lost a race).
  const archiveResult: { rows: { id: string }[] } = { rows: [] };

  return {
    inserted,
    updated,
    archiveResult,
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return step(undefined, {
          returning: async () => [{ id: "new-id", ...row }],
          onConflictDoUpdate: () => step(undefined),
          onConflictDoNothing: () => step(undefined),
        });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        updated.push(patch);
        return {
          where: vi.fn(() =>
            step(undefined, { returning: async () => archiveResult.rows })
          ),
        };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => step(undefined)) })),
    query: { gatherings: { findFirst: vi.fn() } },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const {
  createGathering,
  updateGathering,
  cancelGathering,
  uncancelGathering,
  archivePastGatherings,
} = await import("./gatherings");

const GATHERING_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function gatheringForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("title", "Eid Dinner");
  fd.append("startsAt", "2026-05-01T19:00:00.000Z");
  Object.entries(overrides).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

function liveGathering(overrides: Record<string, unknown> = {}) {
  return {
    id: GATHERING_ID,
    title: "Eid Dinner",
    createdBy: "member-1",
    isCancelled: false,
    archivedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.inserted.length = 0;
  dbMock.updated.length = 0;
  dbMock.archiveResult.rows = [];
  auth.ctx.memberId = "member-1";
  auth.ctx.role = "member";
});

describe("createGathering", () => {
  it("throws for a guest — gatherings are a member write, not a read", async () => {
    auth.ctx.role = "guest";
    await expect(createGathering(gatheringForm())).rejects.toThrow(
      "Insufficient permissions"
    );
  });

  it("creates a gathering for a member", async () => {
    const result = await createGathering(gatheringForm());

    expect(result.success).toBe(true);
    expect(dbMock.inserted[0]).toMatchObject({
      title: "Eid Dinner",
      createdBy: "member-1",
    });
  });

  it("refuses a gathering that ends before it starts", async () => {
    const result = await createGathering(
      gatheringForm({ endsAt: "2026-05-01T17:00:00.000Z" })
    );

    expect(result).toEqual({
      success: false,
      error: "End time must be after the start time",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateGathering", () => {
  it("refuses a member who did not create it, and writes nothing", async () => {
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ createdBy: "someone-else" })
    );

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("lets an Elder edit someone else's gathering", async () => {
    auth.ctx.role = "elder";
    dbMock.archiveResult.rows = [{ id: GATHERING_ID }];
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ createdBy: "someone-else" })
    );

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result).toEqual({ success: true });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it("reports an archive that landed after the read instead of acknowledging the edit", async () => {
    dbMock.query.gatherings.findFirst
      .mockResolvedValueOnce(liveGathering())
      .mockResolvedValueOnce(liveGathering({ archivedAt: new Date("2026-01-01") }));

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result).toEqual({
      success: false,
      error: "This gathering was archived while you were working on it. Your changes weren't saved.",
    });
  });

  it("reports a cancellation that landed after the read", async () => {
    dbMock.query.gatherings.findFirst
      .mockResolvedValueOnce(liveGathering())
      .mockResolvedValueOnce(liveGathering({ isCancelled: true }));

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result.success).toBe(false);
    expect(!result.success && result.error).toMatch(/cancelled while you were working on it/);
  });

  it("refuses to edit a cancelled gathering", async () => {
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ isCancelled: true })
    );

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result).toEqual({
      success: false,
      error: "This gathering is cancelled — restore it before editing",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("refuses to edit an archived gathering", async () => {
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ archivedAt: new Date("2026-01-01") })
    );

    const result = await updateGathering(GATHERING_ID, gatheringForm());

    expect(result).toEqual({
      success: false,
      error: "This gathering has been archived",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("guests and gatherings they created", () => {
  it("refuses a guest editing or cancelling, even as the creator", async () => {
    auth.ctx.role = "guest";
    dbMock.query.gatherings.findFirst.mockResolvedValue(liveGathering());
    await expect(updateGathering(GATHERING_ID, gatheringForm())).rejects.toThrow("Insufficient permissions");
    await expect(cancelGathering(GATHERING_ID)).rejects.toThrow("Insufficient permissions");
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("cancelGathering / uncancelGathering", () => {
  it("refuses a member who did not create it", async () => {
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ createdBy: "someone-else" })
    );

    const result = await cancelGathering(GATHERING_ID);

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("cancels and audits", async () => {
    dbMock.archiveResult.rows = [{ id: GATHERING_ID }];
    dbMock.query.gatherings.findFirst.mockResolvedValue(liveGathering());

    const result = await cancelGathering(GATHERING_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.updated[0]).toMatchObject({ isCancelled: true });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "gathering.cancelled" })
    );
  });

  it("restores a cancelled gathering and audits", async () => {
    dbMock.archiveResult.rows = [{ id: GATHERING_ID }];
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ isCancelled: true })
    );

    const result = await uncancelGathering(GATHERING_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.updated[0]).toMatchObject({ isCancelled: false });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "gathering.uncancelled" })
    );
  });

  it("refuses a cancellation when an archive landed after the read, without an audit entry", async () => {
    dbMock.query.gatherings.findFirst
      .mockResolvedValueOnce(liveGathering())
      .mockResolvedValueOnce(liveGathering({ archivedAt: new Date("2026-01-01") }));

    const result = await cancelGathering(GATHERING_ID);

    expect(result).toEqual({
      success: false,
      error: "This gathering was archived while you were working on it. Nothing was changed.",
    });
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("treats a concurrent identical cancellation as success without a second audit entry", async () => {
    dbMock.query.gatherings.findFirst
      .mockResolvedValueOnce(liveGathering())
      .mockResolvedValueOnce(liveGathering({ isCancelled: true }));

    expect(await cancelGathering(GATHERING_ID)).toEqual({ success: true });
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("is idempotent — cancelling a cancelled gathering writes nothing", async () => {
    dbMock.query.gatherings.findFirst.mockResolvedValue(
      liveGathering({ isCancelled: true })
    );

    const result = await cancelGathering(GATHERING_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(audit.logAudit).not.toHaveBeenCalled();
  });
});

describe("archivePastGatherings", () => {
  it("throws for a member — archiving is an Elder power", async () => {
    await expect(archivePastGatherings()).rejects.toThrow(
      "Insufficient permissions"
    );
  });

  it("refuses a negative threshold, which would archive every FUTURE gathering", async () => {
    auth.ctx.role = "elder";

    const result = await archivePastGatherings(-30);

    expect(result).toEqual({
      success: false,
      error: "Threshold must be at least 1 day",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it.each([0, 1.5, Number.NaN, 366])(
    "refuses the out-of-range threshold %s",
    async (threshold) => {
      auth.ctx.role = "elder";

      const result = await archivePastGatherings(threshold);

      expect(result.success).toBe(false);
      expect(dbMock.update).not.toHaveBeenCalled();
    }
  );

  it("archives with the default 7-day threshold and reports the count", async () => {
    auth.ctx.role = "elder";
    dbMock.archiveResult.rows = [{ id: "g1" }, { id: "g2" }];

    const result = await archivePastGatherings();

    expect(result).toEqual({ success: true, data: { archived: 2 } });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "gathering.archived_past",
        metadata: { count: 2, thresholdDays: 7 },
      })
    );
  });
});
