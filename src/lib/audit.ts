import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

// Every Elder action that touches the House or another relative's content
// leaves a row here. Labels live beside the union so the Audit Log page and the
// action set can never drift apart.
export const AUDIT_ACTION_LABELS = {
  // Members
  "member.role_changed": "Member role changed",
  "member.deactivated": "Member deactivated",
  "member.reactivated": "Member reactivated",
  // Access codes
  "access_code.created": "Invite created",
  "access_code.revoked": "Invite revoked",
  // The Wall
  "post.pinned": "Post pinned",
  "post.unpinned": "Post unpinned",
  "post.deleted_by_elder": "Post removed by an Elder",
  "comment.deleted_by_elder": "Comment removed by an Elder",
  // The Council
  "channel.created": "Chamber created",
  "channel.renamed": "Chamber renamed",
  "channel.archived": "Chamber archived",
  "channel.unarchived": "Chamber reopened",
  "message.deleted_by_elder": "Message removed by an Elder",
  // House settings
  "settings.updated": "House settings updated",
  // Gatherings
  "gathering.cancelled": "Gathering cancelled",
  "gathering.uncancelled": "Gathering restored",
  "gathering.archived_past": "Past gatherings archived",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;

/**
 * The accountability record each action may keep: who, which entity, and the
 * non-secret state needed to read the trail. Invitation codes, message/post/
 * comment text, contact details and Auth IDs are deliberately absent — the
 * entity id identifies the row, and the row itself holds (or tombstones) the
 * content. Adding a field here is a privacy decision, not a refactor.
 */
export interface AuditMetadataByAction {
  "member.role_changed": { from: string; to: string; displayName: string };
  "member.deactivated": { displayName: string };
  "member.reactivated": { displayName: string };
  "access_code.created": { label: string | null; maxUses: number | null; expiresInDays: number | null };
  "access_code.revoked": { label: string | null };
  "post.pinned": { authorId: string };
  "post.unpinned": { authorId: string };
  "post.deleted_by_elder": { authorId: string; hadText: boolean; photoCount: number };
  "comment.deleted_by_elder": { authorId: string; postId: string };
  "channel.created": { name: string; slug: string; type: string };
  "channel.renamed": { from: string; to: string };
  "channel.archived": { name: string; slug: string };
  "channel.unarchived": { name: string; slug: string };
  "message.deleted_by_elder": { authorId: string; channelId: string };
  "settings.updated": { keys: string[] };
  "gathering.cancelled": { title: string };
  "gathering.uncancelled": { title: string };
  "gathering.archived_past": { count: number; thresholdDays: number };
}

type MetadataKeys = { [A in AuditAction]: readonly (keyof AuditMetadataByAction[A])[] };

/** The runtime allow-list. TypeScript shapes are not a runtime guarantee. */
export const AUDIT_METADATA_KEYS = {
  "member.role_changed": ["from", "to", "displayName"],
  "member.deactivated": ["displayName"],
  "member.reactivated": ["displayName"],
  "access_code.created": ["label", "maxUses", "expiresInDays"],
  "access_code.revoked": ["label"],
  "post.pinned": ["authorId"],
  "post.unpinned": ["authorId"],
  "post.deleted_by_elder": ["authorId", "hadText", "photoCount"],
  "comment.deleted_by_elder": ["authorId", "postId"],
  "channel.created": ["name", "slug", "type"],
  "channel.renamed": ["from", "to"],
  "channel.archived": ["name", "slug"],
  "channel.unarchived": ["name", "slug"],
  "message.deleted_by_elder": ["authorId", "channelId"],
  "settings.updated": ["keys"],
  "gathering.cancelled": ["title"],
  "gathering.uncancelled": ["title"],
  "gathering.archived_past": ["count", "thresholdDays"],
} as const satisfies MetadataKeys;

type AuditValue = string | number | boolean | null | string[];
/** Labels and names are short by validation; anything longer is not a label. */
const MAX_AUDIT_TEXT = 200;

function safeValue(value: unknown): AuditValue | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.slice(0, MAX_AUDIT_TEXT);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.slice(0, 20).map((item) => item.slice(0, MAX_AUDIT_TEXT));
  }
  return undefined;
}

/** Keep only the action's allowed, primitive fields. */
export function auditMetadata<A extends AuditAction>(
  action: A,
  metadata: AuditMetadataByAction[A]
): Record<string, AuditValue> {
  const source = metadata as Record<string, unknown>;
  const safe: Record<string, AuditValue> = {};
  for (const key of AUDIT_METADATA_KEYS[action] as readonly string[]) {
    const value = safeValue(source[key]);
    if (value !== undefined) safe[key] = value;
  }
  return safe;
}

export type AuditEntry<A extends AuditAction = AuditAction> = {
  [K in A]: {
    actorId: string;
    action: K;
    entityType?: string;
    entityId?: string;
    metadata: AuditMetadataByAction[K];
  };
}[A];

export async function logAudit<A extends AuditAction>(entry: AuditEntry<A>): Promise<void> {
  // Best-effort — never block the caller on logging failures.
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: auditMetadata(entry.action, entry.metadata),
    });
  } catch {
    // Never leak database parameters into host logs when the best-effort
    // audit sink is unavailable.
    console.error("[audit] failed to write log entry", { action: entry.action });
  }
}
