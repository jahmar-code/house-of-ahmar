"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { CornerDownRight, Reply, Trash2 } from "lucide-react";
import { deleteMessage } from "@/app/actions/council";
import { toast } from "sonner";
import type { MessageWithAuthor } from "@/types";
import type { HoaRole } from "@/lib/constants";
import type { ReplyTarget } from "./council-channel";

interface RealtimeMessageListProps {
  initialMessages: MessageWithAuthor[];
  channelId: string;
  currentMemberId: string;
  currentRole: HoaRole;
  onReply?: (target: ReplyTarget) => void;
}

function previewOf(content: string, limit = 80): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

export function RealtimeMessageList({
  initialMessages,
  channelId,
  currentMemberId,
  currentRole,
  onReply,
}: RealtimeMessageListProps) {
  const [messages, setMessages] = useState<MessageWithAuthor[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messagesById = useMemo(() => {
    const map = new Map<string, MessageWithAuthor>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Subscribe to realtime changes on the messages table
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`council:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newRow = payload.new as {
            id: string;
            channel_id: string;
            author_id: string;
            content: string;
            media_urls: string[];
            is_deleted: boolean;
            reply_to_id: string | null;
            created_at: string;
            updated_at: string;
          };

          // Fetch the author for this message
          const { data: author } = await supabase
            .from("members")
            .select("*")
            .eq("id", newRow.author_id)
            .single();

          if (!author) return;

          const newMessage: MessageWithAuthor = {
            id: newRow.id,
            channelId: newRow.channel_id,
            authorId: newRow.author_id,
            content: newRow.content,
            mediaUrls: newRow.media_urls ?? [],
            isDeleted: newRow.is_deleted,
            replyToId: newRow.reply_to_id,
            createdAt: new Date(newRow.created_at),
            updatedAt: new Date(newRow.updated_at),
            author: {
              id: author.id,
              authUserId: author.auth_user_id,
              displayName: author.display_name,
              fullName: author.full_name,
              email: author.email,
              phone: author.phone,
              avatarUrl: author.avatar_url,
              bio: author.bio,
              birthday: author.birthday,
              role: author.role,
              isActive: author.is_active,
              lastSeenAt: author.last_seen_at ? new Date(author.last_seen_at) : null,
              createdAt: new Date(author.created_at),
              updatedAt: new Date(author.updated_at),
            },
          };

          setMessages((prev) => {
            // Deduplicate — the server action also revalidates the page
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; is_deleted: boolean };
          if (updated.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  async function handleDelete(messageId: string) {
    const result = await deleteMessage(messageId);
    if (result.success) {
      // Optimistic remove — realtime will also fire
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      toast.error(result.error);
    }
  }

  function handleReplyClick(msg: MessageWithAuthor) {
    if (!onReply) return;
    onReply({
      id: msg.id,
      authorName: msg.author.displayName,
      preview: previewOf(msg.content),
    });
  }

  return (
    <ScrollArea className="flex-1 py-4">
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.authorId === currentMemberId;
            const canDelete = isMine || currentRole === "elder";
            const msgDate = new Date(msg.createdAt);
            const replyTo = msg.replyToId ? messagesById.get(msg.replyToId) : null;

            return (
              <div key={msg.id} className="group flex items-start gap-3 px-2">
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarImage src={msg.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gold/10 text-xs text-gold">
                    {msg.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {msg.replyToId && (
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CornerDownRight className="h-3 w-3 shrink-0" />
                      {replyTo ? (
                        <>
                          <span className="text-foreground/70">
                            {replyTo.author.displayName}
                          </span>
                          <span className="truncate italic opacity-70">
                            {previewOf(replyTo.content, 100)}
                          </span>
                        </>
                      ) : (
                        <span className="italic opacity-60">
                          replying to a deleted message
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isMine ? "text-gold" : "text-foreground"
                      }`}
                    >
                      {msg.author.displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isToday(msgDate)
                        ? format(msgDate, "h:mm a")
                        : formatDistanceToNow(msgDate, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onReply && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleReplyClick(msg)}
                      aria-label="Reply"
                    >
                      <Reply className="h-3 w-3" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(msg.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
