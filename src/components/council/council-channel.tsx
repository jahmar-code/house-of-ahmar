"use client";

import { useState } from "react";
import { RealtimeMessageList } from "./realtime-message-list";
import { MessageInput } from "./message-input";
import type { MessageWithAuthor } from "@/types";
import type { HoaRole } from "@/lib/constants";

export interface ReplyTarget {
  id: string;
  authorName: string;
  preview: string;
}

interface CouncilChannelProps {
  initialMessages: MessageWithAuthor[];
  snapshotAt: string;
  channelId: string;
  channelName: string;
  currentMemberId: string;
  currentRole: HoaRole;
  canPost: boolean;
  readOnlyReason?: string;
}

export function CouncilChannel({
  initialMessages,
  snapshotAt,
  channelId,
  channelName,
  currentMemberId,
  currentRole,
  canPost,
  readOnlyReason,
}: CouncilChannelProps) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  return (
    <>
      <RealtimeMessageList
        initialMessages={initialMessages}
        snapshotAt={snapshotAt}
        channelId={channelId}
        channelName={channelName}
        currentMemberId={currentMemberId}
        currentRole={currentRole}
        onReply={canPost ? setReplyTarget : undefined}
        onRemoved={(ids) => setReplyTarget((target) => (target && ids.has(target.id) ? null : target))}
      />
      {canPost && (
        <MessageInput
          channelId={channelId}
          channelName={channelName}
          replyTarget={replyTarget}
          onClearReply={() => setReplyTarget(null)}
        />
      )}
      {!canPost && (
        <p className="shrink-0 border-t border-border py-4 text-sm text-muted-foreground">
          {readOnlyReason ?? "You can read this chamber. Ask an Elder to become a member and join the conversation."}
        </p>
      )}
    </>
  );
}
