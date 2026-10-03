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

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  // Best-effort — never block the caller on logging failures.
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // Never leak access codes, private message previews, or database parameters
    // into host logs when the best-effort audit sink is unavailable.
    console.error("[audit] failed to write log entry", { action: entry.action });
  }
}
