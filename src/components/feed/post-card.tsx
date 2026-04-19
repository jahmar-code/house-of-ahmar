"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  deletePost,
  toggleReaction,
  addComment,
  togglePostPin,
} from "@/app/actions/feed";
import { REACTION_EMOJIS } from "@/lib/constants";
import { toast } from "sonner";
import { MessageCircle, Trash2, Pin, PinOff } from "lucide-react";
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

  const canDelete =
    post.authorId === currentMemberId || currentRole === "elder";
  const canPin = currentRole === "elder";

  async function handleDelete() {
    const result = await deletePost(post.id);
    if (result.success) toast.success("Post removed");
    else toast.error(result.error);
  }

  async function handleTogglePin() {
    const result = await togglePostPin(post.id);
    if (result.success) {
      toast.success(post.isPinned ? "Post unpinned" : "Post pinned");
    } else {
      toast.error(result.error);
    }
  }

  async function handleReaction(emoji: string) {
    await toggleReaction(post.id, emoji);
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

  return (
    <Card
      className={`border-border bg-card ${
        isAnnouncement ? "ring-1 ring-gold/30" : ""
      }`}
    >
      <CardContent className="p-4">
        {/* Author header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-gold/10 text-sm text-gold">
                {post.author.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {post.author.displayName}
                </span>
                {isAnnouncement && (
                  <Badge
                    variant="outline"
                    className="border-gold/30 text-gold text-[10px]"
                  >
                    Announcement
                  </Badge>
                )}
                {post.isPinned && (
                  <Badge
                    variant="outline"
                    className="border-gold/30 text-gold text-[10px] gap-1"
                  >
                    <Pin className="h-2.5 w-2.5" />
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

          <div className="flex items-center">
            {canPin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-gold"
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
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && post.content.trim() && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {post.content}
          </p>
        )}

        {/* Media */}
        {post.mediaUrls && (post.mediaUrls as string[]).length > 0 && (
          <div className={`mt-3 grid gap-2 ${(post.mediaUrls as string[]).length === 1 ? "" : "grid-cols-2"}`}>
            {(post.mediaUrls as string[]).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-full rounded-md object-cover max-h-80"
              />
            ))}
          </div>
        )}

        {/* Reactions */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {REACTION_EMOJIS.map(({ key, emoji }) => {
            const count = reactionCounts[key] || 0;
            const isActive = myReactions.has(key);
            return (
              <button
                key={key}
                onClick={() => handleReaction(key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? "border-gold/40 bg-gold/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-gold/20"
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
        </button>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={comment.author.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gold/10 text-[10px] text-gold">
                    {comment.author.displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-xs font-medium text-foreground">
                    {comment.author.displayName}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}

            {currentRole !== "guest" && (
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-gold/30"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !commentText.trim()}
                  className="h-7 bg-gold/20 text-gold text-xs hover:bg-gold/30"
                >
                  Reply
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
