import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { channels, messages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { CouncilChannel } from "@/components/council/council-channel";
import { Hash } from "lucide-react";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const ctx = await getAuthContext();

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) notFound();

  const channelMessages = await db.query.messages.findMany({
    where: and(
      eq(messages.channelId, channelId),
      eq(messages.isDeleted, false)
    ),
    orderBy: desc(messages.createdAt),
    limit: 100,
    with: { author: true },
  });

  // Reverse so oldest are first (chat style)
  const sortedMessages = channelMessages.reverse();

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-6rem)]">
      {/* Channel header */}
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">
            {channel.name}
          </h1>
          {channel.description && (
            <p className="text-xs text-muted-foreground">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      <CouncilChannel
        initialMessages={sortedMessages}
        channelId={channelId}
        channelName={channel.name}
        currentMemberId={ctx?.memberId ?? ""}
        currentRole={ctx?.role ?? "guest"}
        canPost={ctx?.role !== "guest"}
      />
    </div>
  );
}
