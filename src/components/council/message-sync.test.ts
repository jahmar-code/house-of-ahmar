import { describe, expect, it } from "vitest";
import { insertByCreatedAt, reconcile, toAuthor } from "./message-sync";
import type { MessageWithAuthor } from "@/types";
import { timestampMicros } from "@/lib/message-order";

const snapshotAt = "2026-10-03T12:00:00Z";
function message(id: string, createdAt = "2026-10-03T11:00:00Z", content = id): MessageWithAuthor {
  return {
    id, channelId: "channel", authorId: "author", content,
    createdAt: new Date(createdAt), updatedAt: new Date(createdAt),
    createdAtMicros: timestampMicros(createdAt),
    mediaUrls: [], isDeleted: false, replyToId: null,
    author: toAuthor({ id: "author", display_name: "A relative", avatar_url: null, role: "member" }),
  };
}

describe("Council snapshot reconciliation", () => {
  it("removes a deleted last message even when the server snapshot is empty", () => {
    expect(reconcile([message("deleted")], [], snapshotAt)).toEqual([]);
  });
  it("preserves realtime arrivals newer than the start of a server snapshot", () => {
    const arrival = message("new", "2026-10-03T12:00:01Z");
    expect(reconcile([message("deleted"), arrival], [], snapshotAt)).toEqual([arrival]);
  });
  it("refreshes changed content and author data even when IDs remain identical", () => {
    const original = message("same");
    const updated = { ...original, content: "Corrected", author: { ...original.author, displayName: "Updated name" } };
    expect(reconcile([original], [updated], snapshotAt)).toEqual([updated]);
  });
  it("removes a deleted newest row beyond the newest incoming timestamp", () => {
    const retained = message("retained", "2026-10-03T10:00:00Z");
    expect(reconcile([retained, message("deleted")], [retained], snapshotAt)).toEqual([retained]);
  });
  it("preserves loaded history older than a full server page", () => {
    const old = message("old", "2026-10-02T00:00:00Z");
    const page = Array.from({ length: 100 }, (_, index) => message(`page-${String(index).padStart(3, "0")}`));
    expect(reconcile([old, ...page], page, snapshotAt)).toEqual([old, ...page]);
  });
  it("retains older cursor rows sharing the first snapshot timestamp", () => {
    const earlier = message("a-before-page");
    const page = Array.from({ length: 100 }, (_, index) => message(`page-${String(index).padStart(3, "0")}`));
    expect(reconcile([earlier, ...page], page, snapshotAt)).toEqual([earlier, ...page]);
  });
  it("places out-of-order realtime arrivals chronologically with stable timestamp ties", () => {
    const first = message("a");
    const second = message("b");
    expect(insertByCreatedAt([second], first)).toEqual([first, second]);
  });
  it("keeps the true oldest row as the history cursor within one millisecond", () => {
    const older = message("z-older", "2026-10-03T11:00:00.123100Z");
    const newer = message("a-newer", "2026-10-03T11:00:00.123900Z");
    expect(insertByCreatedAt([newer], older)).toEqual([older, newer]);
    expect(reconcile([newer, older], [older, newer], snapshotAt)[0]).toEqual(older);
  });
  it("preserves precise history just before the oldest full-page row", () => {
    const older = message("z-history", "2026-10-03T11:00:00.123100Z");
    const page = Array.from({ length: 100 }, (_, index) => message(`page-${String(index).padStart(3, "0")}`, "2026-10-03T11:00:00.123900Z"));
    expect(reconcile([older, ...page], page, snapshotAt)[0]).toEqual(older);
  });
});
