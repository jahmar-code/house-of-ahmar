import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { channels, messages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getAuthContext } from "@/lib/auth";
import { CouncilChannel } from "@/components/council/council-channel";
import { Hash, Lock, Megaphone } from "lucide-react";

const typeIcons = {
  general: Hash,
  announcement: Megaphone,
  private: Lock,
};

const typeIconClass = {
  general: "text-muted-foreground",
  announcement: "text-primary",
  private: "text-primary",
};

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
  // Private chambers are elder-only — hide from everyone else.
  if (channel.type === "private" && ctx?.role !== "elder") notFound();

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

  const Icon = typeIcons[channel.type];

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col lg:h-[calc(100vh-6rem)]">
      {/* Channel header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <Icon className={`h-5 w-5 ${typeIconClass[channel.type]}`} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {channel.name}
          </h1>
          {channel.description && (
            <p className="truncate text-xs text-muted-foreground">
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
