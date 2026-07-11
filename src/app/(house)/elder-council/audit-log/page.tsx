import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  "member.role_changed": "Member role changed",
  "member.deactivated": "Member deactivated",
  "member.reactivated": "Member reactivated",
  "access_code.created": "Access code created",
  "access_code.revoked": "Access code revoked",
  "channel.created": "Channel created",
  "settings.updated": "Settings updated",
  "gathering.cancelled": "Gathering cancelled",
  "gathering.archived_past": "Archived past gatherings",
  "relationship.added": "Family relationship added",
  "relationship.removed": "Family relationship removed",
};

function summarizeMetadata(
  action: string,
  metadata: unknown
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;

  switch (action) {
    case "member.role_changed":
      return `${m.displayName ?? "—"}: ${m.from} → ${m.to}`;
    case "member.deactivated":
    case "member.reactivated":
      return (m.displayName as string) ?? null;
    case "access_code.created":
      return `${m.code ?? "—"}${m.label ? ` · ${m.label}` : ""} (${m.maxUses} uses)`;
    case "access_code.revoked":
      return `${m.code ?? "—"}${m.label ? ` · ${m.label}` : ""}`;
    case "channel.created":
      return `#${m.slug ?? m.name ?? "—"}`;
    case "settings.updated":
      if (Array.isArray(m.keys)) return (m.keys as string[]).join(", ");
      return null;
    case "gathering.cancelled":
      return (m.title as string) ?? null;
    case "gathering.archived_past":
      return `${m.count ?? 0} archived (older than ${m.thresholdDays ?? 7} days)`;
    case "relationship.added":
    case "relationship.removed":
      if (m.parentName && m.childName)
        return `${m.parentName} → ${m.childName}`;
      return null;
    default:
      return null;
  }
}

export default async function AuditLogPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const entries = await db.query.auditLogs.findMany({
    orderBy: desc(auditLogs.createdAt),
    limit: 200,
    with: { actor: true },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Elder Council"
        title="Audit Log"
        description="The last 200 administrative actions in the House."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No activity yet"
          description="Admin actions will appear here as they happen."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const label = ACTION_LABELS[entry.action] ?? entry.action;
            const summary = summarizeMetadata(entry.action, entry.metadata);
            const date = new Date(entry.createdAt);
            return (
              <Card
                key={entry.id}
                className="border-border bg-card transition-colors hover:border-foreground/20"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Avatar className="mt-0.5 h-8 w-8">
                    <AvatarImage src={entry.actor.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-secondary text-xs text-foreground">
                      {entry.actor.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {entry.actor.displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-border text-[10px] text-muted-foreground"
                      >
                        {label}
                      </Badge>
                      <span
                        className="text-[10px] text-muted-foreground/70"
                        title={format(date, "PPpp")}
                      >
                        {formatDistanceToNow(date, { addSuffix: true })}
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {summary}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
