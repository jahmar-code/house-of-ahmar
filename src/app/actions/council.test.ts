import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_HIERARCHY, type HoaRole } from "@/lib/constants";

// Mocks the auth and db edges so the Council's authorization branches — the
// private-chamber gate, owner-or-elder deletes, and the elder-only chamber
// admin — are asserted directly, including that a refusal writes nothing.

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

  return {
    inserted,
    updated,
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return step(undefined, {
          returning: async () => [{ id: "new-id", ...row }],
        });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: Record<string, unknown>) => {
        updated.push(patch);
        return { where: vi.fn(() => step(undefined)) };
      }),
    })),
    liveRows: [] as { id: string }[],
    select: vi.fn(() => ({ from: () => ({ where: async () => dbMock.liveRows }) })),
    query: {
      channels: { findFirst: vi.fn() },
      messages: { findFirst: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { sendMessage, deleteMessage, archiveChannel, renameChannel, findRemovedMessages } =
  await import("./council");

const CHANNEL_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const MESSAGE_ID = "9f3c1e2a-5b6d-4c7e-8a9b-0c1d2e3f4a5b";
const PARENT_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function messageForm(fields: Record<string, string>) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

function openChamber(overrides: Record<string, unknown> = {}) {
  return {
    id: CHANNEL_ID,
    name: "General",
    slug: "general",
    type: "general",
    isArchived: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.inserted.length = 0;
  dbMock.updated.length = 0;
  auth.ctx.memberId = "member-1";
  auth.ctx.role = "member";
});

describe("sendMessage", () => {
  it("throws for a guest — guests are read-only", async () => {
    auth.ctx.role = "guest";
    await expect(
      sendMessage(CHANNEL_ID, messageForm({ content: "hi" }))
    ).rejects.toThrow("Insufficient permissions");
  });

  it("refuses a member posting in a private chamber", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(
      openChamber({ type: "private" })
    );

    const result = await sendMessage(CHANNEL_ID, messageForm({ content: "hi" }));

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("makes announcement chambers elder-write-only", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber({ type: "announcement" }));
    expect((await sendMessage(CHANNEL_ID, messageForm({ content: "hi" }))).success).toBe(false);
    expect(dbMock.insert).not.toHaveBeenCalled();
    auth.ctx.role = "elder";
    expect((await sendMessage(CHANNEL_ID, messageForm({ content: "hi" }))).success).toBe(true);
  });

  it("refuses an archived chamber", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(
      openChamber({ isArchived: true })
    );

    const result = await sendMessage(CHANNEL_ID, messageForm({ content: "hi" }));

    expect(result).toEqual({
      success: false,
      error: "This chamber is archived",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("sends a plain message", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());

    const result = await sendMessage(CHANNEL_ID, messageForm({ content: "hi" }));

    expect(result).toEqual({ success: true });
    expect(dbMock.inserted[0]).toMatchObject({
      channelId: CHANNEL_ID,
      authorId: "member-1",
      content: "hi",
      replyToId: null,
    });
  });

  it("refuses a reply whose parent is not in this chamber", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());
    dbMock.query.messages.findFirst.mockResolvedValue(undefined);

    const result = await sendMessage(
      CHANNEL_ID,
      messageForm({ content: "hi", replyToId: PARENT_ID })
    );

    expect(result).toEqual({
      success: false,
      error: "That message is no longer available",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("accepts a reply whose parent is live in this chamber", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());
    dbMock.query.messages.findFirst.mockResolvedValue({
      id: PARENT_ID,
      channelId: CHANNEL_ID,
      isDeleted: false,
    });

    const result = await sendMessage(
      CHANNEL_ID,
      messageForm({ content: "hi", replyToId: PARENT_ID })
    );

    expect(result).toEqual({ success: true });
    expect(dbMock.inserted[0]).toMatchObject({ replyToId: PARENT_ID });
  });
});

describe("deleteMessage (owner-or-elder)", () => {
  it("refuses a member who is not the author, and writes nothing", async () => {
    dbMock.query.messages.findFirst.mockResolvedValue({
      id: MESSAGE_ID,
      channelId: CHANNEL_ID,
      authorId: "someone-else",
      content: "hi",
    });

    const result = await deleteMessage(MESSAGE_ID);

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("lets the author remove their own message without an audit entry", async () => {
    dbMock.query.messages.findFirst.mockResolvedValue({
      id: MESSAGE_ID,
      channelId: CHANNEL_ID,
      authorId: "member-1",
      content: "hi",
    });

    const result = await deleteMessage(MESSAGE_ID);

    expect(result).toEqual({ success: true });
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("lets an Elder remove someone else's message and leaves a trail", async () => {
    auth.ctx.role = "elder";
    dbMock.query.messages.findFirst.mockResolvedValue({
      id: MESSAGE_ID,
      channelId: CHANNEL_ID,
      authorId: "someone-else",
      content: "hi",
    });

    const result = await deleteMessage(MESSAGE_ID);

    expect(result).toEqual({ success: true });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "message.deleted_by_elder" })
    );
  });
});

describe("chamber administration", () => {
  it("throws for a member archiving a chamber", async () => {
    await expect(archiveChannel(CHANNEL_ID)).rejects.toThrow(
      "Insufficient permissions"
    );
  });

  it("archives a chamber and audits", async () => {
    auth.ctx.role = "elder";
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());

    const result = await archiveChannel(CHANNEL_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.updated[0]).toEqual({ isArchived: true });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "channel.archived" })
    );
  });

  it("is idempotent — archiving an archived chamber writes nothing", async () => {
    auth.ctx.role = "elder";
    dbMock.query.channels.findFirst.mockResolvedValue(
      openChamber({ isArchived: true })
    );

    const result = await archiveChannel(CHANNEL_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("refuses a rename that collides with another chamber's name", async () => {
    auth.ctx.role = "elder";
    dbMock.query.channels.findFirst
      .mockResolvedValueOnce(openChamber())
      .mockResolvedValueOnce(openChamber({ id: "other", name: "Cousins" }));

    const result = await renameChannel(
      CHANNEL_ID,
      messageForm({ name: "Cousins" })
    );

    expect(result).toEqual({
      success: false,
      error: "A chamber with that name already exists",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("renames a chamber, leaves the slug alone, and audits", async () => {
    auth.ctx.role = "elder";
    dbMock.query.channels.findFirst
      .mockResolvedValueOnce(openChamber())
      .mockResolvedValueOnce(undefined);

    const result = await renameChannel(
      CHANNEL_ID,
      messageForm({ name: "Cousins" })
    );

    expect(result).toEqual({ success: true });
    expect(dbMock.updated[0]).toEqual({ name: "Cousins", description: null });
    expect(dbMock.updated[0]).not.toHaveProperty("slug");
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "channel.renamed",
        metadata: { from: "General", to: "Cousins" },
      })
    );
  });
});

describe("findRemovedMessages (recovery tombstone check)", () => {
  const OLDER = "2b1c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";

  it("reports loaded messages that are no longer live", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());
    dbMock.liveRows = [{ id: MESSAGE_ID }];
    const result = await findRemovedMessages(CHANNEL_ID, [MESSAGE_ID, OLDER]);
    expect(result).toEqual({ success: true, data: { removed: [OLDER] } });
  });

  it("applies the chamber's read rules", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber({ type: "private" }));
    expect(await findRemovedMessages(CHANNEL_ID, [MESSAGE_ID])).toEqual({ success: false, error: "Chamber not found" });
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber({ isArchived: true }));
    expect((await findRemovedMessages(CHANNEL_ID, [MESSAGE_ID])).success).toBe(false);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("refuses unbounded or malformed checks before reading", async () => {
    dbMock.query.channels.findFirst.mockResolvedValue(openChamber());
    expect((await findRemovedMessages(CHANNEL_ID, Array(501).fill(MESSAGE_ID))).success).toBe(false);
    expect((await findRemovedMessages(CHANNEL_ID, ["not-a-uuid"])).success).toBe(false);
    expect((await findRemovedMessages(CHANNEL_ID, "nope" as never)).success).toBe(false);
    expect(dbMock.query.channels.findFirst).not.toHaveBeenCalled();
  });
});
