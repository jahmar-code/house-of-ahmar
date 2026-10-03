import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { channels, messages } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { CouncilChannel } from "@/components/council/council-channel";
import {
  CHANNEL_ICONS,
  CHANNEL_ICON_CLASS,
  CHANNEL_LABELS,
} from "@/components/council/channel-meta";
import { PUBLIC_MEMBER_COLUMNS } from "@/types";
import { MESSAGE_PRECISION_COLUMNS } from "@/lib/db/message-projection";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  // A mistyped or stale link is a 404, not a raw Postgres uuid cast error.
  if (!UUID_RE.test(channelId)) notFound();
  const ctx = await requirePageAuth();

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) notFound();
  if (channel.isArchived) notFound();
  // Private chambers are elder-only — hide from everyone else.
  if (channel.type === "private" && ctx?.role !== "elder") notFound();

  // Rows newer than this cutoff may arrive over Realtime before this response.
  // The client preserves them when reconciling this authoritative snapshot.
  const snapshotAt = new Date().toISOString();
  const channelMessages = await db.query.messages.findMany({
    where: and(
      eq(messages.channelId, channelId),
      eq(messages.isDeleted, false)
    ),
    orderBy: [desc(messages.createdAt), desc(messages.id)],
    limit: 100,
    extras: MESSAGE_PRECISION_COLUMNS,
    // Byline projection only — never ship author PII to the chat client.
    with: { author: { columns: PUBLIC_MEMBER_COLUMNS } },
  });

  // Reverse so oldest are first (chat style)
  const sortedMessages = channelMessages.reverse();

  const Icon = CHANNEL_ICONS[channel.type];

  return (
    // The mobile chrome this has to sit inside is 3.5rem of sticky header,
    // 1.5rem of top padding and 5rem + safe-area of bottom padding = 10rem.
    // Subtracting less put the composer behind the fixed tab bar.
    <div className="flex h-[calc(100dvh-10rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] min-h-64 flex-col overflow-hidden lg:h-[calc(100dvh-4rem)]">
      {/* Channel header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
          <Icon
            className={`h-5 w-5 ${CHANNEL_ICON_CLASS[channel.type]}`}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {channel.name}
            </h1>
            <Badge
              variant="outline"
              className="shrink-0 text-[10px] text-muted-foreground"
            >
              {CHANNEL_LABELS[channel.type]}
            </Badge>
          </div>
          {channel.description && (
            <p className="truncate text-xs text-muted-foreground">
              {channel.description}
            </p>
          )}
        </div>
      </div>

      <CouncilChannel
        key={channelId}
        initialMessages={sortedMessages}
        snapshotAt={snapshotAt}
        channelId={channelId}
        channelName={channel.name}
        currentMemberId={ctx?.memberId ?? ""}
        currentRole={ctx?.role ?? "guest"}
        canPost={Boolean(ctx) && ctx?.role !== "guest" && (channel.type !== "announcement" || ctx?.role === "elder")}
        readOnlyReason={channel.type === "announcement" ? "Only Elders post announcements here. Everyone in the House can read them." : undefined}
      />
    </div>
  );
}
