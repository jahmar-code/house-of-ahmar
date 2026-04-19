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
  channelId: string;
  channelName: string;
  currentMemberId: string;
  currentRole: HoaRole;
  canPost: boolean;
}

export function CouncilChannel({
  initialMessages,
  channelId,
  channelName,
  currentMemberId,
  currentRole,
  canPost,
}: CouncilChannelProps) {
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  return (
    <>
      <RealtimeMessageList
        initialMessages={initialMessages}
        channelId={channelId}
        currentMemberId={currentMemberId}
        currentRole={currentRole}
        onReply={canPost ? setReplyTarget : undefined}
      />
      {canPost && (
        <MessageInput
          channelId={channelId}
          channelName={channelName}
          replyTarget={replyTarget}
          onClearReply={() => setReplyTarget(null)}
        />
      )}
    </>
  );
}
