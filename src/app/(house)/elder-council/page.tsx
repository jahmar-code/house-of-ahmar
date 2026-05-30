import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Users, Key, Settings, Shield, MessageSquare, ScrollText } from "lucide-react";

export default async function ElderCouncilPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const [allMembers, activeCodes] = await Promise.all([
    db.query.members.findMany(),
    db.query.accessCodes.findMany({
      where: eq(accessCodes.status, "active"),
    }),
  ]);

  const activeMembers = allMembers.filter((m) => m.isActive);
  const elders = allMembers.filter((m) => m.role === "elder" && m.isActive);

  const adminLinks = [
    {
      href: "/elder-council/members",
      icon: Users,
      title: "Manage Members",
      description: "View and manage member roles and access.",
    },
    {
      href: "/elder-council/access-codes",
      icon: Key,
      title: "Access Codes",
      description: "Create and manage family invite codes.",
    },
    {
      href: "/elder-council/channels",
      icon: MessageSquare,
      title: "Council Chambers",
      description: "Create and manage council chambers.",
    },
    {
      href: "/elder-council/settings",
      icon: Settings,
      title: "House Settings",
      description: "Configure the House of Ahmar.",
    },
    {
      href: "/elder-council/audit-log",
      icon: ScrollText,
      title: "Audit Log",
      description: "Recent administrative actions in the House.",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Elder Council"
        description="Administration and governance of the House."
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatsCard
          icon={Users}
          label="Active Members"
          value={activeMembers.length}
        />
        <StatsCard
          icon={Shield}
          label="Elders"
          value={elders.length}
        />
        <StatsCard
          icon={Key}
          label="Active Codes"
          value={activeCodes.length}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="border-border bg-card transition-colors hover:bg-secondary/30 h-full">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold/20 bg-gold/5">
                  <link.icon className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{link.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
