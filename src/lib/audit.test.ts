import { beforeEach, describe, expect, it, vi } from "vitest";

// The real logAudit and its allow-list; only the database insert is stubbed.
const sink = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], fail: false }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (sink.fail) throw new Error("connection refused: postgres://user:secret@host/db");
        sink.rows.push(row);
      },
    }),
  },
}));

const { auditMetadata, logAudit, AUDIT_ACTION_LABELS, AUDIT_METADATA_KEYS } = await import("./audit");
const { summarizeAuditEntry } = await import("./audit-summary");

beforeEach(() => {
  sink.rows.length = 0;
  sink.fail = false;
  vi.restoreAllMocks();
});

describe("audit metadata allow-list", () => {
  it("defines an allow-list for every labelled action", () => {
    expect(Object.keys(AUDIT_METADATA_KEYS).sort()).toEqual(Object.keys(AUDIT_ACTION_LABELS).sort());
  });

  it("drops fields an action does not allow, even when a caller passes them at runtime", () => {
    const smuggled = { label: "Cousins", maxUses: 3, expiresInDays: null, code: "ABCDEF0123456789", email: "a@b.c" };
    expect(auditMetadata("access_code.created", smuggled as never)).toEqual({ label: "Cousins", maxUses: 3, expiresInDays: null });
    const preview = { authorId: "m-1", channelId: "c-1", preview: "private words", content: "private words" };
    expect(auditMetadata("message.deleted_by_elder", preview as never)).toEqual({ authorId: "m-1", channelId: "c-1" });
  });

  it("keeps only primitive values and bounds text", () => {
    const value = auditMetadata("gathering.cancelled", { title: { nested: "x" } } as never);
    expect(value).toEqual({});
    expect(auditMetadata("gathering.cancelled", { title: "x".repeat(500) }).title).toHaveLength(200);
    expect(auditMetadata("gathering.archived_past", { count: Number.NaN, thresholdDays: 7 })).toEqual({ thresholdDays: 7 });
  });
});

describe("logAudit sink", () => {
  it("persists accountability fields without the secret ones", async () => {
    await logAudit({
      actorId: "elder-1",
      action: "access_code.revoked",
      entityType: "access_code",
      entityId: "11111111-2222-4333-8444-555555555555",
      metadata: { label: "Aunts", code: "SECRET-CODE" } as never,
    });
    expect(sink.rows).toEqual([{
      actorId: "elder-1",
      action: "access_code.revoked",
      entityType: "access_code",
      entityId: "11111111-2222-4333-8444-555555555555",
      metadata: { label: "Aunts" },
    }]);
  });

  it("reports a failed sink with the action only, never parameters", async () => {
    sink.fail = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(logAudit({
      actorId: "elder-1",
      action: "message.deleted_by_elder",
      entityId: "11111111-2222-4333-8444-555555555555",
      metadata: { authorId: "m-1", channelId: "c-1", preview: "private words" } as never,
    })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("message.deleted_by_elder");
    expect(logged).not.toMatch(/private words|secret|postgres:\/\/|m-1/);
  });
});

describe("audit log summaries", () => {
  const INVITE = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("never renders a historical invitation code", () => {
    const legacy = { code: "A1B2C3D4E5F60718", label: null, maxUses: 1 };
    expect(summarizeAuditEntry("access_code.created", legacy, INVITE)).toBe("Invite 0f8fad5b (1 use)");
    expect(summarizeAuditEntry("access_code.revoked", { code: "A1B2C3D4E5F60718", label: "Cousins" }, INVITE)).toBe("Cousins");
    expect(summarizeAuditEntry("access_code.revoked", { code: "A1B2C3D4E5F60718" }, null)).toBe("Invite");
  });

  it("never renders historical removed-content previews", () => {
    for (const action of ["message.deleted_by_elder", "comment.deleted_by_elder", "post.deleted_by_elder"]) {
      expect(summarizeAuditEntry(action, { preview: "private words", authorId: "m-1" }) ?? "").not.toContain("private words");
    }
    expect(summarizeAuditEntry("post.deleted_by_elder", { authorId: "m-1", hadText: true, photoCount: 2 })).toBe("2 photos removed with the post");
  });

  it("summarizes current shapes and tolerates malformed ones", () => {
    expect(summarizeAuditEntry("member.role_changed", { from: "member", to: "elder", displayName: "Aza" })).toBe("Aza: member → elder");
    expect(summarizeAuditEntry("channel.renamed", { from: "General", to: "Family" })).toBe("General → Family");
    expect(summarizeAuditEntry("settings.updated", { keys: ["houseName"] })).toBe("houseName");
    expect(summarizeAuditEntry("settings.updated", { keys: [{ raw: 1 }] })).toBeNull();
    expect(summarizeAuditEntry("member.deactivated", ["not", "an", "object"])).toBeNull();
    expect(summarizeAuditEntry("gathering.archived_past", { count: 2, thresholdDays: 7 })).toBe("2 archived (older than 7 days)");
  });
});
