import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        title="Access Codes"
        description="Create and manage family invite codes."
      />

      <CreateCodeForm />

      <div className="mt-6 space-y-2">
        {codes.map((code) => (
          <Card key={code.id} className="border-border bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-bold text-gold tracking-wider">
                    {code.code}
                  </code>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      code.status === "active"
                        ? "border-emerald-500/30 text-emerald-400"
                        : code.status === "used"
                          ? "border-amber-500/30 text-amber-400"
                          : "border-destructive/30 text-destructive"
                    }`}
                  >
                    {code.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
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
    </div>
  );
}
