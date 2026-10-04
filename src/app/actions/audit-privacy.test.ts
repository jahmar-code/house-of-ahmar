import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs } from "@/lib/db/schema";

// Real actions and the real audit allow-list; only auth, cache and the
// database edge are stubbed. These began as deliberately red DS-02 contracts:
// each action succeeded while copying a secret into the audit trail.
const ELDER = { userId: "user-1", memberId: "elder-1", displayName: "Aza", role: "elder", avatarUrl: null };
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ELDER, requireRole: async () => ELDER }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const SECRET_TEXT = "Only the family should ever read these words";
const db = vi.hoisted(() => {
  const audit: Record<string, unknown>[] = [];
  const other: Record<string, unknown>[] = [];
  const step = (value: unknown) => ({
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(value).then(resolve, reject),
    where: () => Promise.resolve(undefined),
  });
  return {
    audit,
    other,
    auditTable: null as unknown,
    insert: vi.fn((table: unknown) => ({
      values: (row: Record<string, unknown>) => {
        (table === db.auditTable ? audit : other).push(row);
        return { ...step(undefined), returning: async () => [{ id: "0f8fad5b-d9cb-469f-a165-70867728950e", ...row }] };
      },
    })),
    update: vi.fn(() => ({ set: () => step(undefined) })),
    query: {
      accessCodes: { findFirst: vi.fn() },
      messages: { findFirst: vi.fn() },
      posts: { findFirst: vi.fn() },
      comments: { findFirst: vi.fn() },
    },
  };
});
db.auditTable = auditLogs;
vi.mock("@/lib/db", () => ({ db }));

const { createAccessCode, revokeAccessCode } = await import("./admin");
const { deleteMessage } = await import("./council");
const { deletePost, deleteComment } = await import("./feed");

const ID = "9f3c1e2a-5b6d-4c7e-8a9b-0c1d2e3f4a5b";
const auditRow = () => {
  expect(db.audit).toHaveLength(1);
  return db.audit[0];
};

beforeEach(() => {
  db.audit.length = 0;
  db.other.length = 0;
  vi.clearAllMocks();
});

describe("audit trail privacy", () => {
  it("records a created invite by label and entity, never by its code", async () => {
    const form = new FormData();
    form.set("label", "Cousins");
    form.set("maxUses", "3");
    const result = await createAccessCode(form);
    expect(result.success).toBe(true);
    const code = result.success ? result.data!.code : "";
    expect(code).toMatch(/^[0-9A-F]{16}$/);
    expect(db.other[0]).toMatchObject({ code, label: "Cousins", maxUses: 3 });
    const row = auditRow();
    expect(row).toMatchObject({ action: "access_code.created", entityId: "0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(row.metadata).toEqual({ label: "Cousins", maxUses: 3, expiresInDays: null });
    expect(JSON.stringify(row)).not.toContain(code);
  });

  it("records a revoked invite without its code", async () => {
    db.query.accessCodes.findFirst.mockResolvedValue({ id: ID, code: "A1B2C3D4E5F60718", label: "Aunts" });
    expect(await revokeAccessCode(ID)).toEqual({ success: true });
    const row = auditRow();
    expect(row).toMatchObject({ action: "access_code.revoked", entityId: ID, metadata: { label: "Aunts" } });
    expect(JSON.stringify(row)).not.toContain("A1B2C3D4E5F60718");
  });

  it("records an Elder's message removal without the removed words", async () => {
    db.query.messages.findFirst.mockResolvedValue({ id: ID, channelId: "channel-1", authorId: "member-2", content: SECRET_TEXT });
    expect(await deleteMessage(ID)).toEqual({ success: true });
    const row = auditRow();
    expect(row).toMatchObject({ action: "message.deleted_by_elder", entityId: ID, metadata: { authorId: "member-2", channelId: "channel-1" } });
    expect(JSON.stringify(row)).not.toContain(SECRET_TEXT);
  });

  it("records an Elder's post and comment removals without their text", async () => {
    db.query.posts.findFirst.mockResolvedValue({ id: ID, authorId: "member-2", content: SECRET_TEXT, mediaUrls: ["/api/media/feed-media/member-2/a.jpg"], isDeleted: false });
    expect(await deletePost(ID)).toEqual({ success: true });
    expect(auditRow()).toMatchObject({ action: "post.deleted_by_elder", metadata: { authorId: "member-2", hadText: true, photoCount: 1 } });
    expect(JSON.stringify(db.audit)).not.toMatch(new RegExp(`${SECRET_TEXT}|feed-media`));

    db.audit.length = 0;
    db.query.comments.findFirst.mockResolvedValue({ id: ID, postId: "post-1", authorId: "member-2", content: SECRET_TEXT, isDeleted: false });
    expect(await deleteComment(ID)).toEqual({ success: true });
    expect(auditRow()).toMatchObject({ action: "comment.deleted_by_elder", metadata: { authorId: "member-2", postId: "post-1" } });
    expect(JSON.stringify(db.audit)).not.toContain(SECRET_TEXT);
  });

  it("still completes the moderation when the audit sink fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.insert.mockImplementationOnce(() => ({ values: async () => { throw new Error(`insert failed: ${SECRET_TEXT}`); } }) as never);
    db.query.messages.findFirst.mockResolvedValue({ id: ID, channelId: "channel-1", authorId: "member-2", content: SECRET_TEXT });
    expect(await deleteMessage(ID)).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain(SECRET_TEXT);
    error.mockRestore();
  });
});
