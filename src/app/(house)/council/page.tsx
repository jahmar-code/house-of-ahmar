import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ChannelList } from "@/components/council/channel-list";
import { MessageSquare } from "lucide-react";

export default async function CouncilPage() {
  const ctx = await getAuthContext();
  const fetched = await db.query.channels.findMany({
    where: eq(channels.isArchived, false),
    orderBy: asc(channels.sortOrder),
  });
  // Private chambers are only listed for Elders.
  const allChannels = fetched.filter(
    (c) => c.type !== "private" || ctx?.role === "elder"
  );

  if (allChannels.length === 0) {
    return (
      <div>
        <PageHeader
          title="The Council"
          description="Family discussions and conversations."
        />
        <EmptyState
          icon={MessageSquare}
          title="No chambers yet"
          description="An Elder must create the first council chamber."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="The Council"
        description="Family discussions and conversations."
      />
      <ChannelList channels={allChannels} />
    </div>
  );
}
