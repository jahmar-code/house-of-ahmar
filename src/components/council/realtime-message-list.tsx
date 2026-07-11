"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { CornerDownRight, MessagesSquare, Reply, Trash2 } from "lucide-react";
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

          // Fetch ONLY the author fields a message renders. The members table
          // is otherwise locked from the client Data API (RLS + column grant),
          // so PII (email/phone/bio/birthday) is never sent to the browser.
          const { data: author } = await supabase
            .from("members")
            .select("id, display_name, avatar_url, role")
            .eq("id", newRow.author_id)
            .single();

          if (!author) return;

          const now = new Date();
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
              // Only these are rendered for a message author; the rest are
              // intentionally not fetched (kept null) to avoid leaking PII.
              id: author.id,
              displayName: author.display_name,
              avatarUrl: author.avatar_url,
              role: author.role,
              authUserId: "",
              fullName: null,
              email: null,
              phone: null,
              bio: null,
              birthday: null,
              isActive: true,
              lastSeenAt: null,
              createdAt: now,
              updatedAt: now,
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
      <div className="space-y-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
              <MessagesSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.authorId === currentMemberId;
            const canDelete = isMine || currentRole === "elder";
            const isElder = msg.author.role === "elder";
            const msgDate = new Date(msg.createdAt);
            const replyTo = msg.replyToId ? messagesById.get(msg.replyToId) : null;

            return (
              <div
                key={msg.id}
                className="group relative flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
              >
                <Avatar className="mt-0.5 h-8 w-8">
                  <AvatarImage src={msg.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                    {msg.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  {msg.replyToId && (
                    <div className="mb-1 flex min-w-0 items-center gap-1.5 border-l border-border pl-2 text-[11px] text-muted-foreground">
                      <CornerDownRight className="h-3 w-3 shrink-0" />
                      {replyTo ? (
                        <>
                          <span className="shrink-0 text-foreground/70">
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
                      className={`truncate text-sm font-medium ${
                        isElder ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {msg.author.displayName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {isToday(msgDate)
                        ? format(msgDate, "h:mm a")
                        : formatDistanceToNow(msgDate, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                    {msg.content}
                  </p>
                </div>
                {(onReply || canDelete) && (
                  <div className="absolute right-2 top-1 flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {onReply && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleReplyClick(msg)}
                        aria-label="Reply"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(msg.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
