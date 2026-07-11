import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Users,
  Key,
  Settings,
  Shield,
  MessageSquare,
  ScrollText,
  ChevronRight,
} from "lucide-react";

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
        eyebrow="Elder Council"
        title="Administration"
        description="Governance and stewardship of the House."
      />

      <section className="mb-8">
        <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Overview
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatsCard
            icon={Users}
            label="Active Members"
            value={activeMembers.length}
          />
          <StatsCard icon={Shield} label="Elders" value={elders.length} />
          <StatsCard
            icon={Key}
            label="Active Codes"
            value={activeCodes.length}
          />
        </div>
      </section>

      <section>
        <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Manage the House
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Card className="h-full border-border bg-card transition-colors hover:border-foreground/20 hover:bg-secondary/20">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted transition-colors group-hover/card:border-primary/30 group-hover/card:bg-primary/10">
                    <link.icon className="h-5 w-5 text-muted-foreground transition-colors group-hover/card:text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight text-foreground">
                      {link.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-all group-hover/card:translate-x-0.5 group-hover/card:text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
