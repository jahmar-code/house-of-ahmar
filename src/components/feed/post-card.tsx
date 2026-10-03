"use client";

import { useState, useTransition } from "react";
import { PostPhotos } from "./post-photos";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ActivityTime } from "@/components/shared/activity-time";
import {
  deletePost,
  toggleReaction,
  addComment,
  togglePostPin,
  deleteComment,
} from "@/app/actions/feed";
import { REACTION_EMOJIS } from "@/lib/constants";
import { milestoneMeta } from "./milestone-meta";
import { toast } from "sonner";
import { MessageCircle, Trash2, Pin, PinOff, Megaphone } from "lucide-react";
import type { Comment, PostWithDetails, PublicMember } from "@/types";
import type { HoaRole } from "@/lib/constants";

interface PostCardProps {
  // PostWithDetails carries the PublicMember byline projection, so this
  // component cannot be handed author PII even by accident.
  post: PostWithDetails;
  currentMemberId: string;
  currentRole: HoaRole;
}

export function PostCard({ post, currentMemberId, currentRole }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The comment awaiting confirmation, or null when nothing is pending.
  const [commentToDelete, setCommentToDelete] = useState<
    (Comment & { author: PublicMember }) | null
  >(null);
  // Which reaction key is mid-flight, so only that pill shows as busy.
  const [pendingReaction, setPendingReaction] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const canDelete =
    post.authorId === currentMemberId || currentRole === "elder";
  const canPin = currentRole === "elder";
  const milestone = milestoneMeta(post.milestoneKind);

  async function handleDelete() {
    const result = await deletePost(post.id);
    if (result.success) {
      toast.success("Post removed");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  async function handleDeleteComment(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.success) {
      toast.success("Comment removed");
      router.refresh();
    } else toast.error(result.error);
    return result.success;
  }

  function handleTogglePin() {
    startTransition(async () => {
      try {
        const result = await togglePostPin(post.id);
        if (result.success) {
          toast.success(post.isPinned ? "Post unpinned" : "Post pinned");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Couldn't update that pin. Please try again.");
      }
    });
  }

  function handleReaction(emoji: string) {
    // A tap has no visible effect until the action round-trips and the RSC
    // subtree repaints, so guard against the second tap that always follows.
    if (pendingReaction) return;
    setPendingReaction(emoji);
    startTransition(async () => {
      try {
        const result = await toggleReaction(post.id, emoji);
        if (result.success) router.refresh();
        else toast.error(result.error);
      } catch {
        toast.error("Couldn't update that reaction. Please try again.");
      } finally {
        setPendingReaction(null);
      }
    });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.set("postId", post.id);
    formData.set("content", commentText);

    try {
      const result = await addComment(formData);
      if (result.success) {
        setCommentText("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("That comment didn't send. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
  const isHighlighted = isAnnouncement || post.isPinned || Boolean(milestone);
  const mediaUrls = (post.mediaUrls as string[] | null) ?? [];
  const commentFieldId = `comment-${post.id}`;

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
              <AvatarImage src={post.author.avatarUrl ?? undefined} alt="" />
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
                {milestone && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-primary/30 bg-primary/10 text-[10px] text-primary"
                  >
                    <milestone.Icon className="h-2.5 w-2.5" />
                    {milestone.label}
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
                <ActivityTime value={post.createdAt} />
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canPin && (
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground hover:text-primary"
                onClick={handleTogglePin}
                disabled={pending}
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
                className="size-11 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Delete post"
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

        {mediaUrls.length > 0 && (
          <PostPhotos urls={mediaUrls} authorName={post.author.displayName} />
        )}

        {/* Engagement bar */}
        <div className="mt-4 border-t border-border pt-3">
          {/* Reactions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {REACTION_EMOJIS.map(({ key, emoji }) => {
              const count = reactionCounts[key] || 0;
              const isActive = myReactions.has(key);
              const isBusy = pendingReaction === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleReaction(key)}
                  disabled={pendingReaction !== null}
                  aria-pressed={isActive}
                  aria-busy={isBusy}
                  aria-label={`React ${key}${count > 0 ? `, ${count}` : ""}`}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60 ${
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
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md pr-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments.length} comment
            {post.comments.length !== 1 ? "s" : ""}
          </button>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 space-y-3 border-t border-border pt-3">
              {post.comments.map((comment) => {
                const canDeleteComment =
                  comment.authorId === currentMemberId ||
                  currentRole === "elder";
                return (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={comment.author.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                        {comment.author.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span className="text-xs font-medium text-foreground">
                          {comment.author.displayName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          <ActivityTime value={comment.createdAt} />
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/80">
                        {comment.content}
                      </p>
                    </div>
                    {canDeleteComment && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => setCommentToDelete(comment)}
                        aria-label={`Delete ${comment.author.displayName}'s comment`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {post.comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              )}

              {currentRole !== "guest" && (
                <form
                  onSubmit={handleComment}
                  className="flex items-center gap-2"
                >
                  <label htmlFor={commentFieldId} className="sr-only">
                    Add a comment to {post.author.displayName}&apos;s post
                  </label>
                  <Input
                    id={commentFieldId}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    maxLength={2000}
                    disabled={submitting}
                    className="h-11 flex-1 bg-muted/40 text-base sm:text-sm"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={submitting || !commentText.trim()}
                    className="h-11 shrink-0"
                  >
                    {submitting ? "Sending…" : "Reply"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this post?"
        description="It disappears for everyone, along with its comments and photos. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={commentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCommentToDelete(null);
        }}
        title="Delete this comment?"
        description={
          commentToDelete
            ? `${commentToDelete.author.displayName}'s comment disappears for everyone. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={async () => {
          if (!commentToDelete) return false;
          return handleDeleteComment(commentToDelete.id);
        }}
      />
    </Card>
  );
}
