"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { Trash2 } from "lucide-react";
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

            return (
              <div key={msg.id} className="group flex items-start gap-3 px-2">
                <Avatar className="h-8 w-8 mt-0.5">
                  <AvatarImage src={msg.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gold/10 text-xs text-gold">
                    {msg.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
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
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(msg.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
