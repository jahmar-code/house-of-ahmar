import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

export type AuditAction =
  // Members
  | "member.role_changed"
  | "member.deactivated"
  | "member.reactivated"
  // Access codes
  | "access_code.created"
  | "access_code.revoked"
  // Channels
  | "channel.created"
  // House settings
  | "settings.updated"
  // Gatherings
  | "gathering.cancelled"
  | "gathering.archived_past"
  // Family tree
  | "relationship.added"
  | "relationship.removed";

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
  } catch (err) {
    console.error("[audit] failed to write log entry", { entry, err });
  }
}
