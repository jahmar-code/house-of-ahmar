"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import {
  deletePost,
  toggleReaction,
  addComment,
  togglePostPin,
} from "@/app/actions/feed";
import { REACTION_EMOJIS } from "@/lib/constants";
import { toast } from "sonner";
import { MessageCircle, Trash2, Pin, PinOff, Megaphone } from "lucide-react";
import type { Post, Member, Comment, Reaction } from "@/types";
import type { HoaRole } from "@/lib/constants";

interface PostCardProps {
  post: Post & {
    author: Member;
    comments: (Comment & { author: Member })[];
    reactions: Reaction[];
  };
  currentMemberId: string;
  currentRole: HoaRole;
}

export function PostCard({ post, currentMemberId, currentRole }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const canDelete =
    post.authorId === currentMemberId || currentRole === "elder";
  const canPin = currentRole === "elder";

  async function handleDelete() {
    const result = await deletePost(post.id);
    if (result.success) {
      toast.success("Post removed");
      router.refresh();
    } else toast.error(result.error);
  }

  async function handleTogglePin() {
    const result = await togglePostPin(post.id);
    if (result.success) {
      toast.success(post.isPinned ? "Post unpinned" : "Post pinned");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleReaction(emoji: string) {
    const result = await toggleReaction(post.id, emoji);
    if (result.success) router.refresh();
    else toast.error(result.error);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set("postId", post.id);
    formData.set("content", commentText);

    const result = await addComment(formData);
    if (result.success) {
      setCommentText("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  // Group reactions by emoji
  const reactionCounts = post.reactions.reduce(
    (acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const myReactions = new Set(
    post.reactions
      .filter((r) => r.memberId === currentMemberId)
      .map((r) => r.emoji)
  );

  const isAnnouncement = post.type === "announcement";
  const isHighlighted = isAnnouncement || post.isPinned;

  return (
    <Card
      className={
        isHighlighted ? "border-primary/20 ring-1 ring-primary/30" : ""
      }
    >
      <CardContent className="p-4 sm:p-5">
        {/* Author header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-sm text-primary">
                {post.author.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-sm font-semibold text-foreground">
                  {post.author.displayName}
                </span>
                {isAnnouncement && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary"
                  >
                    <Megaphone className="h-2.5 w-2.5" />
                    Announcement
                  </Badge>
                )}
                {post.isPinned && (
                  <Badge
                    variant="outline"
                    className="gap-1 text-[10px] text-muted-foreground"
                  >
                    <Pin className="h-2.5 w-2.5 text-primary" />
                    Pinned
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {canPin && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary"
                onClick={handleTogglePin}
                aria-label={post.isPinned ? "Unpin post" : "Pin post"}
              >
                {post.isPinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                aria-label="Remove post"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && post.content.trim() && (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {post.content}
          </p>
        )}

        {/* Media */}
        {post.mediaUrls && (post.mediaUrls as string[]).length > 0 && (
          <div
            className={`mt-3 grid gap-2 ${
              (post.mediaUrls as string[]).length === 1 ? "" : "grid-cols-2"
            }`}
          >
            {(post.mediaUrls as string[]).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="max-h-80 w-full rounded-lg border border-border object-cover"
              />
            ))}
          </div>
        )}

        {/* Engagement bar */}
        <div className="mt-4 border-t border-border pt-3">
          {/* Reactions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {REACTION_EMOJIS.map(({ key, emoji }) => {
              const count = reactionCounts[key] || 0;
              const isActive = myReactions.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleReaction(key)}
                  aria-pressed={isActive}
                  aria-label={`React ${key}${count > 0 ? `, ${count}` : ""}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                  }`}
                >
                  <span className="text-sm leading-none">{emoji}</span>
                  {count > 0 && (
                    <span className="tabular-nums font-medium">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Comments toggle */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            aria-expanded={showComments}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md py-1 pr-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments.length} comment
            {post.comments.length !== 1 ? "s" : ""}
          </button>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={comment.author.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                      {comment.author.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-xs font-medium text-foreground">
                        {comment.author.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/80">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}

              {post.comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}

              {currentRole !== "guest" && (
                <form
                  onSubmit={handleComment}
                  className="flex items-center gap-2"
                >
                  <Input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    aria-label="Add a comment"
                    className="flex-1 bg-muted/40"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={submitting || !commentText.trim()}
                    className="shrink-0"
                  >
                    Reply
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
