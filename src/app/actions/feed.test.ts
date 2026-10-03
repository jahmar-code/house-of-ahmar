import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_HIERARCHY, type HoaRole } from "@/lib/constants";

// ─── Test doubles ────────────────────────────────────────────────────────────
// The Wall's actions are transport: auth gate → Zod → scope → Drizzle. These
// tests mock the two edges (auth + db) so the branches in between — especially
// the authorization ones — are asserted directly, including that the deny path
// performs NO write.

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
  requireAuth: async () => {
    if (!auth.ctx) throw new Error("Unauthorized");
    return auth.ctx;
  },
  requireRole: async (minimumRole: HoaRole) => {
    if (!auth.ctx) throw new Error("Unauthorized");
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
  // A Drizzle builder step that can be awaited directly OR chained further.
  const step = (value: unknown, extra: Record<string, unknown> = {}) => ({
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
    ...extra,
  });

  const inserted: Record<string, unknown>[] = [];

  return {
    step,
    inserted,
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row);
        return step(undefined, {
          returning: async () => [{ id: "new-id", ...row }],
          onConflictDoNothing: () => step(undefined),
          onConflictDoUpdate: () => step(undefined),
        });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => step(undefined, { returning: async () => [] })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => dbMock.step(undefined)) })),
    query: {
      posts: { findFirst: vi.fn() },
      comments: { findFirst: vi.fn() },
      reactions: { findFirst: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { createPost, deletePost, deleteComment, toggleReaction, togglePostPin } =
  await import("./feed");

const POST_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const COMMENT_ID = "9f3c1e2a-5b6d-4c7e-8a9b-0c1d2e3f4a5b";

function asElder() {
  auth.ctx.role = "elder";
}
function asMember() {
  auth.ctx.role = "member";
}

function postForm(fields: Record<string, string>) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.inserted.length = 0;
  auth.ctx.memberId = "member-1";
  asMember();
});

describe("createPost", () => {
  it("refuses a non-Elder announcement instead of downgrading it silently", async () => {
    const result = await createPost(
      postForm({ content: "Big news", type: "announcement" })
    );

    expect(result).toEqual({
      success: false,
      error: "Only Elders can post announcements",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("lets an Elder post an announcement and reports the real type back", async () => {
    asElder();

    const result = await createPost(
      postForm({ content: "Big news", type: "announcement" })
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.type).toBe("announcement");
    expect(dbMock.inserted[0]).toMatchObject({
      authorId: "member-1",
      type: "announcement",
    });
  });

  it("rejects a post with neither text nor a photo", async () => {
    const result = await createPost(postForm({ content: "" }));
    expect(result).toEqual({
      success: false,
      error: "Write something or add a photo",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("accepts a photo-only post — the photo IS the post", async () => {
    // The composer sends no `content` field at all for a photo-only post.
    const fd = new FormData();
    fd.append("type", "photo");
    fd.append("mediaUrls", JSON.stringify(["/api/media/feed-media/member-1/a.jpg"]));

    const result = await createPost(fd);

    expect(result.success).toBe(true);
    expect(dbMock.inserted[0]).toMatchObject({
      authorId: "member-1",
      type: "photo",
      content: null,
      mediaUrls: ["/api/media/feed-media/member-1/a.jpg"],
    });
  });

  it("stores a whitespace-only caption as null rather than a blank line", async () => {
    const fd = new FormData();
    fd.append("content", "   ");
    fd.append("type", "photo");
    fd.append("mediaUrls", JSON.stringify(["/api/media/feed-media/member-1/a.jpg"]));

    const result = await createPost(fd);

    expect(result.success).toBe(true);
    expect(dbMock.inserted[0]).toMatchObject({ content: null });
  });

  it("throws for a guest — guests are read-only", async () => {
    auth.ctx.role = "guest";
    await expect(createPost(postForm({ content: "hi" }))).rejects.toThrow(
      "Insufficient permissions"
    );
  });
});

describe("deletePost (owner-or-elder)", () => {
  it("refuses a member who is not the author, and writes nothing", async () => {
    dbMock.query.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      authorId: "someone-else",
      content: "hi",
      isDeleted: false,
    });

    const result = await deletePost(POST_ID);

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("lets the author remove their own post without an audit entry", async () => {
    dbMock.query.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      authorId: "member-1",
      content: "hi",
      isDeleted: false,
    });

    const result = await deletePost(POST_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("lets an Elder remove someone else's post and leaves a trail", async () => {
    asElder();
    dbMock.query.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      authorId: "someone-else",
      content: "a family photo caption",
      isDeleted: false,
    });

    const result = await deletePost(POST_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "member-1",
        action: "post.deleted_by_elder",
        entityId: POST_ID,
      })
    );
  });

  it("rejects a non-UUID id before touching the database", async () => {
    const result = await deletePost("not-a-uuid");
    expect(result).toEqual({ success: false, error: "Invalid post" });
    expect(dbMock.query.posts.findFirst).not.toHaveBeenCalled();
  });
});

describe("deleteComment (owner-or-elder)", () => {
  it("refuses a member who is not the author, and writes nothing", async () => {
    dbMock.query.comments.findFirst.mockResolvedValue({
      id: COMMENT_ID,
      postId: POST_ID,
      authorId: "someone-else",
      content: "oops",
      isDeleted: false,
    });

    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: false, error: "Not authorized" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("lets the author remove their own comment", async () => {
    dbMock.query.comments.findFirst.mockResolvedValue({
      id: COMMENT_ID,
      postId: POST_ID,
      authorId: "member-1",
      content: "oops",
      isDeleted: false,
    });

    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: true });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(audit.logAudit).not.toHaveBeenCalled();
  });

  it("lets an Elder remove someone else's comment and leaves a trail", async () => {
    asElder();
    dbMock.query.comments.findFirst.mockResolvedValue({
      id: COMMENT_ID,
      postId: POST_ID,
      authorId: "someone-else",
      content: "something hurtful",
      isDeleted: false,
    });

    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: true });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "comment.deleted_by_elder" })
    );
  });

  it("treats an already-deleted comment as missing", async () => {
    dbMock.query.comments.findFirst.mockResolvedValue({
      id: COMMENT_ID,
      postId: POST_ID,
      authorId: "member-1",
      content: "oops",
      isDeleted: true,
    });

    const result = await deleteComment(COMMENT_ID);

    expect(result).toEqual({ success: false, error: "Comment not found" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("toggleReaction", () => {
  it("rejects a reaction key the House does not offer", async () => {
    const result = await toggleReaction(POST_ID, "thumbsup");

    expect(result).toEqual({ success: false, error: "Invalid reaction" });
    expect(dbMock.query.reactions.findFirst).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects the raw glyph — the column stores the key", async () => {
    const result = await toggleReaction(POST_ID, "❤️");
    expect(result).toEqual({ success: false, error: "Invalid reaction" });
  });

  it("adds a reaction the member has not left yet", async () => {
    dbMock.query.reactions.findFirst.mockResolvedValue(undefined);

    const result = await toggleReaction(POST_ID, "heart");

    expect(result).toEqual({ success: true });
    expect(dbMock.inserted[0]).toMatchObject({
      postId: POST_ID,
      memberId: "member-1",
      emoji: "heart",
    });
  });

  it("removes a reaction the member already left", async () => {
    dbMock.query.reactions.findFirst.mockResolvedValue({ id: "reaction-1" });

    const result = await toggleReaction(POST_ID, "heart");

    expect(result).toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("togglePostPin", () => {
  it("throws for a member — pinning is an Elder power", async () => {
    await expect(togglePostPin(POST_ID)).rejects.toThrow(
      "Insufficient permissions"
    );
  });

  it("pins and audits", async () => {
    asElder();
    dbMock.query.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      authorId: "someone-else",
      isPinned: false,
      isDeleted: false,
    });

    const result = await togglePostPin(POST_ID);

    expect(result).toEqual({ success: true });
    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "post.pinned" })
    );
  });

  it("unpins and audits", async () => {
    asElder();
    dbMock.query.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      authorId: "someone-else",
      isPinned: true,
      isDeleted: false,
    });

    await togglePostPin(POST_ID);

    expect(audit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "post.unpinned" })
    );
  });
});
