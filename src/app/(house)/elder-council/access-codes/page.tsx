import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound } from "lucide-react";
import { format } from "date-fns";
import { CreateCodeForm } from "./create-code-form";
import { RevokeButton } from "./revoke-button";

export default async function AccessCodesPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const codes = await db.query.accessCodes.findMany({
    orderBy: desc(accessCodes.createdAt),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Elder Council"
        title="Access Codes"
        description="Create and manage family invite codes."
      />

      <CreateCodeForm />

      {codes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={KeyRound}
            title="No access codes yet"
            description="Mint a code above to invite family into the House."
          />
        </div>
      ) : (
        <>
          <p className="mt-8 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {codes.length} {codes.length === 1 ? "code" : "codes"}
          </p>
          <div className="space-y-2">
            {codes.map((code) => (
              <Card
                key={code.id}
                className="border-border bg-card transition-colors hover:border-foreground/20"
              >
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm font-semibold tracking-wider text-foreground">
                        {code.code}
                      </code>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          code.status === "active"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : code.status === "used"
                              ? "border-border text-muted-foreground"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {code.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {code.label ?? "No label"}
                      {" · "}
                      Used {code.useCount}/{code.maxUses ?? "∞"}
                      {" · "}
                      Created {format(new Date(code.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  {code.status === "active" && <RevokeButton codeId={code.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
