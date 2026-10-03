import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { and, eq, gt, isNull, or } from "drizzle-orm";
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
      // Expiry never flips `status`, so an active-but-lapsed code would be
      // counted as a live invite the join screen actually refuses.
      where: and(
        eq(accessCodes.status, "active"),
        or(isNull(accessCodes.expiresAt), gt(accessCodes.expiresAt, new Date()))
      ),
    }),
  ]);

  const activeMembers = allMembers.filter((m) => m.isActive);
  const elders = allMembers.filter((m) => m.role === "elder" && m.isActive);

  const adminLinks = [
    {
      href: "/elder-council/members",
      icon: Users,
      title: "Members",
      description: "Who is in the House, and what each person can do.",
    },
    {
      href: "/elder-council/access-codes",
      icon: Key,
      title: "Invite Codes",
      description: "Create and revoke the codes that let family in.",
    },
    {
      href: "/elder-council/channels",
      icon: MessageSquare,
      title: "Council Chambers",
      description: "Open and look after the rooms in the Council.",
    },
    {
      href: "/elder-council/settings",
      icon: Settings,
      title: "House Settings",
      description: "The name, the welcome, and the cover photo.",
    },
    {
      href: "/elder-council/audit-log",
      icon: ScrollText,
      title: "Audit Log",
      description: "A record of what Elders have changed.",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Elder Council"
        description="Look after the House — invites, roles, chambers and settings."
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
              <Card className="group/card h-full border-border bg-card transition-colors hover:border-foreground/20 hover:bg-secondary/20">
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
