import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { summarizeAuditEntry } from "@/lib/audit-summary";
import { PUBLIC_MEMBER_COLUMNS } from "@/types";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default async function AuditLogPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const entries = await db.query.auditLogs.findMany({
    orderBy: desc(auditLogs.createdAt),
    limit: 200,
    // Byline only: the trail needs a name and face, not the actor's contact row.
    with: { actor: { columns: PUBLIC_MEMBER_COLUMNS } },
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
            const label =
              (AUDIT_ACTION_LABELS as Record<string, string>)[entry.action] ??
              entry.action;
            const summary = summarizeAuditEntry(entry.action, entry.metadata, entry.entityId);
            const date = new Date(entry.createdAt);
            return (
              <Card
                key={entry.id}
                className="border-border bg-card transition-colors hover:border-foreground/20"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Avatar className="mt-0.5 h-8 w-8">
                    <AvatarImage src={entry.actor.avatarUrl ?? undefined} alt="" />
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
                        className="text-[10px] text-muted-foreground"
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
