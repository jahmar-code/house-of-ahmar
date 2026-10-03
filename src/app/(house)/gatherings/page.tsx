import Link from "next/link";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { asc, isNull, isNotNull } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GatheringCard } from "@/components/gatherings/gathering-card";
import { ArchivePastButton } from "@/components/gatherings/archive-past-button";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";

export default async function GatheringsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requirePageAuth();
  const archived = (await searchParams).view === "archived";

  const allGatherings = await db.query.gatherings.findMany({
    where: archived ? isNotNull(gatherings.archivedAt) : isNull(gatherings.archivedAt),
    orderBy: asc(gatherings.startsAt),
    with: {
      creator: true,
      rsvps: { with: { member: true } },
    },
  });

  // Soonest first under Upcoming — the next family event belongs at the top.
  // Cancelled gatherings stay in the list, badged, so anyone who RSVP'd sees
  // that it was called off instead of finding it silently gone.
  const now = new Date();
  const upcoming = allGatherings.filter((g) => new Date(g.endsAt ?? g.startsAt) >= now);
  const past = allGatherings
    .filter((g) => new Date(g.endsAt ?? g.startsAt) < now)
    .reverse(); // most recent first

  return (
    <div>
      <PageHeader title="Gatherings" description={archived ? "Earlier gatherings and the memories we keep." : "Family events and meetups."}>
        {!archived && ctx?.role === "elder" && <ArchivePastButton />}
        {ctx?.role !== "guest" && (
          <Button render={<Link href="/gatherings/new" />}>
            <Plus className="h-4 w-4" />
            New Gathering
          </Button>
        )}
      </PageHeader>
      <nav aria-label="Gathering views" className="mb-6 flex gap-2">
        <Button variant={archived ? "outline" : "secondary"} className="h-11" render={<Link href="/gatherings" aria-current={!archived ? "page" : undefined} />}>Current</Button>
        <Button variant={archived ? "secondary" : "outline"} className="h-11" render={<Link href="/gatherings?view=archived" aria-current={archived ? "page" : undefined} />}>Archived</Button>
      </nav>

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={archived ? "No archived gatherings" : "No gatherings yet"}
          description={archived ? "Gatherings moved out of the current list will appear here." : "Plan a gathering to bring the family together."}
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
              <div className="space-y-4">
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
