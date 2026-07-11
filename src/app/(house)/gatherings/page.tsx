import Link from "next/link";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GatheringCard } from "@/components/gatherings/gathering-card";
import { ArchivePastButton } from "@/components/gatherings/archive-past-button";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";

export default async function GatheringsPage() {
  const ctx = await getAuthContext();

  const allGatherings = await db.query.gatherings.findMany({
    where: isNull(gatherings.archivedAt),
    orderBy: desc(gatherings.startsAt),
    with: {
      creator: true,
      rsvps: { with: { member: true } },
    },
  });

  const upcoming = allGatherings.filter(
    (g) => !g.isCancelled && new Date(g.startsAt) >= new Date()
  );
  const past = allGatherings.filter(
    (g) => !g.isCancelled && new Date(g.startsAt) < new Date()
  );

  return (
    <div>
      <PageHeader title="Gatherings" description="Family events and meetups.">
        {ctx?.role === "elder" && <ArchivePastButton />}
        {ctx?.role !== "guest" && (
          <Button render={<Link href="/gatherings/new" />}>
            <Plus className="h-4 w-4" />
            New Gathering
          </Button>
        )}
      </PageHeader>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No gatherings yet"
          description="Plan a gathering to bring the family together."
        >
          {ctx?.role !== "guest" && (
            <Button render={<Link href="/gatherings/new" />}>
              <Plus className="h-4 w-4" />
              New Gathering
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upcoming
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {upcoming.length}
                </span>
              </h2>
              <div className="space-y-4">
                {upcoming.map((g) => (
                  <GatheringCard
                    key={g.id}
                    gathering={g}
                    currentMemberId={ctx?.memberId ?? ""}
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Past
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {past.length}
                </span>
              </h2>
              <div className="space-y-4 opacity-60">
                {past.map((g) => (
                  <GatheringCard
                    key={g.id}
                    gathering={g}
                    currentMemberId={ctx?.memberId ?? ""}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
