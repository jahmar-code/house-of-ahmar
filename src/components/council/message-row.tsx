"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityTime } from "@/components/shared/activity-time";
import { CornerDownRight, MoreVertical, Reply, Trash2 } from "lucide-react";
import type { MessageWithAuthor } from "@/types";
import type { ReplyTarget } from "./council-channel";

export function previewOf(content: string, limit = 80): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

interface MessageRowProps {
  message: MessageWithAuthor;
  /** The message being replied to, when it is loaded in this window. */
  replyTo: MessageWithAuthor | null;
  /** True only when we watched that parent get deleted — never a guess. */
  replyParentDeleted: boolean;
  canDelete: boolean;
  onReply?: (target: ReplyTarget) => void;
  onRequestDelete?: (message: MessageWithAuthor) => void;
}

export function MessageRow({
  message,
  replyTo,
  replyParentDeleted,
  canDelete,
  onReply,
  onRequestDelete,
}: MessageRowProps) {
  const isElder = message.author.role === "elder";
  // Everything a finger can hit is visible. The actions used to be an
  // opacity-0 overlay, which on a phone was an invisible Delete button
  // sitting on top of every message.
  const showActions = Boolean(onReply) || canDelete;

  return (
    <div className="relative flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
      <Avatar className="mt-0.5 h-8 w-8">
        <AvatarImage src={message.author.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
          {message.author.displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        {message.replyToId && (
          <div className="mb-1 flex min-w-0 items-center gap-1.5 border-l border-border pl-2 text-[11px] text-muted-foreground">
            <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            {replyTo ? (
              <>
                <span className="max-w-[45%] shrink-0 truncate text-foreground">
                  {replyTo.author.displayName}
                </span>
                <span className="truncate italic">
                  {previewOf(replyTo.content, 100)}
                </span>
              </>
            ) : replyParentDeleted ? (
              <span className="italic">
                replying to a message that was deleted
              </span>
            ) : (
              // The parent may simply be older than the messages we loaded —
              // saying it was deleted would be a lie.
              <span className="italic">replying to an earlier message</span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span
            className={`truncate text-sm font-medium ${
              isElder ? "text-primary" : "text-foreground"
            }`}
          >
            {message.author.displayName}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            <ActivityTime value={message.createdAt} showTodayTime />
          </span>
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
          {message.content}
        </p>
      </div>

      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Options for ${message.author.displayName}'s message`}
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onReply && (
              <DropdownMenuItem
                onClick={() =>
                  onReply({
                    id: message.id,
                    authorName: message.author.displayName,
                    preview: previewOf(message.content),
                  })
                }
              >
                <Reply className="mr-2 h-4 w-4" />
                Reply
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onRequestDelete?.(message)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
