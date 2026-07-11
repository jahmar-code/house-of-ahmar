"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { MessagesSquare, Trash2 } from "lucide-react";
import { deleteMessage } from "@/app/actions/council";
import { toast } from "sonner";
import type { Message, Member } from "@/types";
import type { HoaRole } from "@/lib/constants";

interface MessageListProps {
  messages: (Message & { author: Member })[];
  currentMemberId: string;
  currentRole: HoaRole;
}

export function MessageList({
  messages,
  currentMemberId,
  currentRole,
}: MessageListProps) {
  async function handleDelete(messageId: string) {
    const result = await deleteMessage(messageId);
    if (!result.success) toast.error(result.error);
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
                {canDelete && (
                  <div className="absolute right-2 top-1 flex items-center rounded-lg border border-border bg-card p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(msg.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
