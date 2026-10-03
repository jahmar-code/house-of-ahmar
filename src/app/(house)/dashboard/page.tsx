import { db } from "@/lib/db";
import { members, posts, gatherings } from "@/lib/db/schema";
import { eq, gte, desc, and, or, isNull } from "drizzle-orm";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import { requirePageAuth } from "@/lib/auth";
import { getHouseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { HallSummary } from "@/components/dashboard/hall-summary";
import { FirstRunCard } from "@/components/dashboard/first-run-card";
import { OnlineMembers } from "@/components/dashboard/online-members";
import { UpcomingGatherings } from "@/components/dashboard/upcoming-gatherings";
import { RecentPosts } from "@/components/dashboard/recent-posts";
import { UpcomingBirthdays } from "@/components/dashboard/upcoming-birthdays";
import { Users, CalendarHeart } from "lucide-react";

export default async function DashboardPage() {
  const ctx = await requirePageAuth();
  const now = new Date();
  const presenceThreshold = new Date(now.getTime() - PRESENCE_TIMEOUT_MS);

  // Parallel data fetching
  const [
    allMembers,
    onlineMembers,
    upcomingGatheringsList,
    recentPostsList,
    settings,
  ] = await Promise.all([
    db.query.members.findMany({
      where: eq(members.isActive, true),
    }),
    db.query.members.findMany({
      where: and(
        eq(members.isActive, true),
        gte(members.lastSeenAt, presenceThreshold)
      ),
    }),
    // Deliberately unlimited: the count below has to be a true total, not a
    // page size. `startsAt >= now` already bounds this to a handful of rows.
    db.query.gatherings.findMany({
      where: and(
        eq(gatherings.isCancelled, false),
        isNull(gatherings.archivedAt),
        or(gte(gatherings.startsAt, now), gte(gatherings.endsAt, now))
      ),
      orderBy: gatherings.startsAt,
      with: { creator: true },
    }),
    db.query.posts.findMany({
      where: eq(posts.isDeleted, false),
      orderBy: desc(posts.createdAt),
      limit: 5,
      with: { author: true },
    }),
    getHouseSettings(),
  ]);

  const isFirstRun = allMembers.length <= 1;

  return (
    <div>
      {settings.coverImageUrl && (
        // The House's own photo, finally rendered. Decorative — the House name
        // and greeting sit in the header directly below it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.coverImageUrl}
          alt=""
          className="mb-6 h-32 w-full rounded-xl border border-border object-cover sm:h-44"
        />
      )}

      <PageHeader
        title="The Great Hall"
        description={settings.welcomeMessage || "Good to have you home."}
      />

      {isFirstRun ? (
        <FirstRunCard
          role={ctx?.role ?? "member"}
          houseName={settings.houseName}
        />
      ) : (
        <>
          <HallSummary
            members={allMembers}
            gatherings={upcomingGatheringsList}
          />

          <div className="mb-8 grid grid-cols-2 gap-4">
            <StatsCard
              icon={Users}
              label="Members online"
              value={onlineMembers.length}
              sublabel={`of ${allMembers.length}`}
              href="/members"
            />
            <StatsCard
              icon={CalendarHeart}
              label="Coming up"
              value={upcomingGatheringsList.length}
              href="/gatherings"
            />
          </div>

          {/* The family first — faces and dates before anything else. */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OnlineMembers members={onlineMembers} />
            <UpcomingBirthdays members={allMembers} />
            <UpcomingGatherings
              gatherings={upcomingGatheringsList.slice(0, 5)}
            />
            <RecentPosts posts={recentPostsList} />
          </div>
        </>
      )}
    </div>
  );
}
