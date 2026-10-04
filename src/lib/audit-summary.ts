/**
 * One readable line per audit entry for the Elder Council's Audit Log.
 *
 * Rows written before the typed allow-list may still carry an invitation code
 * or a removed message/post/comment preview. Only named, primitive fields are
 * rendered here, so those historical secrets never reach the page even before
 * the separate redaction runbook has been applied.
 */
type Metadata = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** An invite is named by its label, else by a short non-secret row reference. */
function inviteName(m: Metadata, entityId: string | null) {
  const label = text(m.label);
  if (label) return label;
  return entityId ? `Invite ${entityId.slice(0, 8)}` : "Invite";
}

export function summarizeAuditEntry(
  action: string,
  metadata: unknown,
  entityId: string | null = null
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Metadata;

  switch (action) {
    case "member.role_changed": {
      const name = text(m.displayName) ?? "—";
      const from = text(m.from);
      const to = text(m.to);
      return from && to ? `${name}: ${from} → ${to}` : name;
    }
    case "member.deactivated":
    case "member.reactivated":
      return text(m.displayName);
    case "access_code.created": {
      const uses = count(m.maxUses);
      return `${inviteName(m, entityId)}${uses === null ? "" : ` (${uses} ${uses === 1 ? "use" : "uses"})`}`;
    }
    case "access_code.revoked":
      return inviteName(m, entityId);
    case "channel.created":
    case "channel.archived":
    case "channel.unarchived": {
      const slug = text(m.slug) ?? text(m.name);
      return slug ? `#${slug}` : null;
    }
    case "channel.renamed": {
      const from = text(m.from);
      const to = text(m.to);
      return from && to ? `${from} → ${to}` : null;
    }
    case "settings.updated":
      return Array.isArray(m.keys) && m.keys.every((key) => typeof key === "string")
        ? (m.keys as string[]).join(", ")
        : null;
    case "gathering.cancelled":
    case "gathering.uncancelled":
      return text(m.title);
    case "gathering.archived_past":
      return `${count(m.count) ?? 0} archived (older than ${count(m.thresholdDays) ?? 7} days)`;
    case "post.deleted_by_elder": {
      const photos = count(m.photoCount);
      return photos ? `${photos} ${photos === 1 ? "photo" : "photos"} removed with the post` : null;
    }
    default:
      // Removed content is identified by its entity, never by a copy of it.
      return null;
  }
}
