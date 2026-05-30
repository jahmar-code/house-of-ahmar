import { db } from "@/lib/db";
import { members, posts, gatherings, channels } from "@/lib/db/schema";
import { eq, gte, desc, and } from "drizzle-orm";
import { PRESENCE_TIMEOUT_MS } from "@/lib/constants";
import { getHouseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { OnlineMembers } from "@/components/dashboard/online-members";
import { UpcomingGatherings } from "@/components/dashboard/upcoming-gatherings";
import { RecentPosts } from "@/components/dashboard/recent-posts";
import { UpcomingBirthdays } from "@/components/dashboard/upcoming-birthdays";
import { Users, Calendar, MessageSquare, Scroll } from "lucide-react";

export default async function DashboardPage() {
  const now = new Date();
  const presenceThreshold = new Date(now.getTime() - PRESENCE_TIMEOUT_MS);

  // Parallel data fetching
  const [
    allMembers,
    onlineMembers,
    upcomingGatheringsList,
    recentPostsList,
    totalChannels,
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
    db.query.gatherings.findMany({
      where: and(
        eq(gatherings.isCancelled, false),
        gte(gatherings.startsAt, now)
      ),
      orderBy: gatherings.startsAt,
      limit: 5,
      with: { creator: true },
    }),
    db.query.posts.findMany({
      where: eq(posts.isDeleted, false),
      orderBy: desc(posts.createdAt),
      limit: 5,
      with: { author: true },
    }),
    db.query.channels.findMany({
      where: eq(channels.isArchived, false),
    }),
    getHouseSettings(),
  ]);

  return (
    <div>
      <PageHeader
        title="The Great Hall"
        description={settings.welcomeMessage || `Welcome to ${settings.houseName}.`}
      />

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          icon={Users}
          label="Members Online"
          value={onlineMembers.length}
          sublabel={`of ${allMembers.length}`}
        />
        <StatsCard
          icon={Calendar}
          label="Upcoming Gatherings"
          value={upcomingGatheringsList.length}
        />
        <StatsCard
          icon={MessageSquare}
          label="Council Chambers"
          value={totalChannels.length}
        />
        <StatsCard
          icon={Scroll}
          label="Recent Posts"
          value={recentPostsList.length}
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OnlineMembers members={onlineMembers} />
        <UpcomingBirthdays members={allMembers} />
        <UpcomingGatherings gatherings={upcomingGatheringsList} />
        <RecentPosts posts={recentPostsList} />
      </div>
    </div>
  );
}
