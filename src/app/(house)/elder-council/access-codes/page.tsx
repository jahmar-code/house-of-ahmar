import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getHouseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ban, Check, Clock, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { CreateCodeForm } from "./create-code-form";
import { RevokeButton } from "./revoke-button";
import { CopyCodeButton } from "./copy-code-controls";

// Icon + word on every state, so the badge never depends on its tint alone.
const statusBadge = {
  active: { label: "Active", Icon: Check, className: "border-primary/30 bg-primary/10 text-primary" },
  used: { label: "Used up", Icon: Check, className: "border-border text-muted-foreground" },
  revoked: { label: "Revoked", Icon: Ban, className: "border-destructive/40 text-foreground" },
  expired: { label: "Expired", Icon: Clock, className: "border-border text-muted-foreground" },
} as const;

/**
 * Expiry is enforced at redemption but never written back to `status`, so a
 * lapsed code would otherwise still read "Active" here while the join screen
 * refuses it — the Elder Council must not say the opposite of what happens.
 */
function displayStatus(code: {
  status: keyof typeof statusBadge;
  expiresAt: Date | null;
}): keyof typeof statusBadge {
  if (code.status === "active" && code.expiresAt && code.expiresAt < new Date()) {
    return "expired";
  }
  return code.status;
}

export default async function AccessCodesPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const [codes, settings] = await Promise.all([
    db.query.accessCodes.findMany({ orderBy: desc(accessCodes.createdAt) }),
    getHouseSettings(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Elder Council"
        title="Invite Codes"
        description="Every code is one relative's way in. Send it to them — they create an account first, then enter the code."
      />

      <CreateCodeForm houseName={settings.houseName} />

      {codes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={KeyRound}
            title="No invite codes yet"
            description="Create a code above to bring someone into the House."
          />
        </div>
      ) : (
        <>
          <p className="mt-8 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {codes.length} {codes.length === 1 ? "code" : "codes"}
          </p>
          <div className="space-y-2">
            {codes.map((code) => {
              const state = displayStatus(code);
              const status = statusBadge[state];
              return (
                <Card
                  key={code.id}
                  className="border-border bg-card transition-colors hover:border-foreground/20"
                >
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-sm font-semibold tracking-wider text-foreground">
                          {code.code}
                        </code>
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] ${status.className}`}
                        >
                          <status.Icon className="h-2.5 w-2.5" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {code.label ?? "No label"}
                        {" · "}
                        Used {code.useCount}/{code.maxUses ?? "∞"}
                        {" · "}
                        Created {format(new Date(code.createdAt), "MMM d, yyyy")}
                        {code.expiresAt && (
                          <>
                            {" · "}
                            {state === "expired" ? "Expired " : "Expires "}
                            {format(new Date(code.expiresAt), "MMM d, yyyy")}
                          </>
                        )}
                      </p>
                    </div>
                    {state === "active" && (
                      <div className="flex shrink-0 items-center">
                        <CopyCodeButton code={code.code} />
                        <RevokeButton codeId={code.id} code={code.code} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
