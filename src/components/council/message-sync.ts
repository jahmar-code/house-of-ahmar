import type { Member, MessageWithAuthor } from "@/types";
import { compareMessages, messageMicros, timestampMicros } from "@/lib/message-order";

/** The raw `messages` row shape Supabase Realtime hands us. */
export type MessageRowPayload = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  media_urls: string[] | null;
  is_deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
};

/** The only author columns the client Data API is allowed to read. */
export type AuthorRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: Member["role"];
};

/**
 * Fold a freshly-rendered server payload into what's on screen.
 *
 * `revalidatePath` only helps if the list actually listens to the new prop —
 * seeding `useState` once made the websocket the *only* way a message could
 * ever appear. Messages inside the window the server just re-sent but missing
 * from it have been deleted, so they're dropped; anything outside that window
 * (older history, or newer arrivals the server hasn't seen yet) is kept.
 */
export function reconcile(
  current: MessageWithAuthor[],
  incoming: MessageWithAuthor[],
  snapshotAt: string
): MessageWithAuthor[] {
  const incomingIds = new Set(incoming.map((m) => m.id));
  // Fewer than 100 rows means this is the complete history. A full page only
  // authoritatively covers its oldest row onward; preserve earlier history.
  const oldest = incoming.length >= 100 ? incoming[0] : null;
  const cutoff = BigInt(timestampMicros(snapshotAt));

  const byId = new Map<string, MessageWithAuthor>();
  for (const m of current) {
    if (incomingIds.has(m.id)) continue;
    const at = messageMicros(m);
    const inWindow = !oldest || compareMessages(m, oldest) >= 0;
    if (inWindow && at <= cutoff) continue; // deleted since we loaded it
    byId.set(m.id, m);
  }
  for (const m of incoming) byId.set(m.id, m);

  const merged = [...byId.values()].sort(compareMessages);
  // Always use the server's row data: unchanged IDs can still carry updated
  // author names, avatars, roles, or content.
  return merged;
}

export function insertByCreatedAt(
  current: MessageWithAuthor[],
  message: MessageWithAuthor
): MessageWithAuthor[] {
  // Realtime INSERTs can resolve out of order, so place by time rather than
  // pushing — a reply must never render above the message it answers.
  const next = [...current, message];
  next.sort(compareMessages);
  return next;
}

/**
 * Only the fields a message renders. The rest of the member row is deliberately
 * left null — the client Data API never sends PII (email/phone/bio/birthday).
 */
export function toAuthor(row: AuthorRow): Member {
  const now = new Date();
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    authUserId: "",
    fullName: null,
    email: null,
    phone: null,
    bio: null,
    birthday: null,
    isActive: true,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
