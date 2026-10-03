"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { posts, comments, reactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { postSchema, commentSchema } from "@/lib/validators";
import { REACTION_EMOJIS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { ownedMediaUrl } from "@/lib/media";
import { z } from "zod";
import type { ActionResult, Post } from "@/types";

const uuid = z.string().uuid();

export async function createPost(
  formData: FormData
): Promise<ActionResult<{ id: string; type: Post["type"] }>> {
  const ctx = await requireRole("member"); // guests are read-only

  const rawMediaUrls = formData.get("mediaUrls") as string | null;
  let mediaUrls: string[] | undefined;
  if (rawMediaUrls) {
    try {
      mediaUrls = JSON.parse(rawMediaUrls);
    } catch {
      return { success: false, error: "Invalid media URLs" };
    }
  }

  const rawContent = formData.get("content");
  const parsed = postSchema.safeParse({
    // A photo-only post sends no `content` field at all — keep it undefined
    // rather than coercing FormData's null into a string.
    content: typeof rawContent === "string" ? rawContent : undefined,
    type: formData.get("type") || "text",
    mediaUrls,
    milestoneKind: formData.get("milestoneKind") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Announcements are elder-only. Say so instead of quietly downgrading the
  // post — the caller must never be told one thing happened when another did.
  if (parsed.data.type === "announcement" && ctx.role !== "elder") {
    return { success: false, error: "Only Elders can post announcements" };
  }

  const normalizedMedia = (parsed.data.mediaUrls ?? []).map((url) => ownedMediaUrl(url, ctx.memberId));
  if (normalizedMedia.some((url) => url === null)) {
    return { success: false, error: "Photos must be uploaded to the House from your account" };
  }

  const [post] = await db
    .insert(posts)
    .values({
      authorId: ctx.memberId,
      content: parsed.data.content?.trim() || null,
      type: parsed.data.type,
      mediaUrls: normalizedMedia as string[],
      milestoneKind: parsed.data.milestoneKind ?? null,
    })
    .returning();

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true, data: { id: post.id, type: post.type } };
}

export async function togglePostPin(postId: string): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  if (!uuid.safeParse(postId).success) {
    return { success: false, error: "Invalid post" };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });
  if (!post || post.isDeleted) {
    return { success: false, error: "Post not found" };
  }

  const pinned = !post.isPinned;

  await db
    .update(posts)
    .set({ isPinned: pinned, updatedAt: new Date() })
    .where(eq(posts.id, postId));

  // Pinning moves another relative's post to the top of The Wall for everyone —
  // an Elder power, so it leaves a trail either way.
  await logAudit({
    actorId: ctx.memberId,
    action: pinned ? "post.pinned" : "post.unpinned",
    entityType: "post",
    entityId: postId,
    metadata: { authorId: post.authorId },
  });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const ctx = await requireAuth();

  if (!uuid.safeParse(postId).success) {
    return { success: false, error: "Invalid post" };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });
  if (!post) return { success: false, error: "Post not found" };

  // Only author or elder can delete
  if (post.authorId !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db
    .update(posts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(posts.id, postId));

  // Removing your own post is nobody's business; an Elder removing a relative's
  // post is, so that one is on the record.
  if (post.authorId !== ctx.memberId) {
    await logAudit({
      actorId: ctx.memberId,
      action: "post.deleted_by_elder",
      entityType: "post",
      entityId: postId,
      metadata: {
        authorId: post.authorId,
        preview: post.content?.slice(0, 140) ?? null,
      },
    });
  }

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const ctx = await requireAuth();

  if (!uuid.safeParse(commentId).success) {
    return { success: false, error: "Invalid comment" };
  }

  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });
  if (!comment || comment.isDeleted) {
    return { success: false, error: "Comment not found" };
  }

  // Same owner-or-elder gate as deletePost.
  if (comment.authorId !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db
    .update(comments)
    .set({ isDeleted: true })
    .where(eq(comments.id, commentId));

  if (comment.authorId !== ctx.memberId) {
    await logAudit({
      actorId: ctx.memberId,
      action: "comment.deleted_by_elder",
      entityType: "comment",
      entityId: commentId,
      metadata: {
        authorId: comment.authorId,
        postId: comment.postId,
        preview: comment.content.slice(0, 140),
      },
    });
  }

  revalidatePath("/feed");
  return { success: true };
}

export async function addComment(formData: FormData): Promise<ActionResult> {
  const ctx = await requireRole("member"); // guests are read-only

  const postId = formData.get("postId") as string;
  if (!uuid.safeParse(postId).success) {
    return { success: false, error: "Invalid post" };
  }

  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Don't accept comments on a missing or soft-deleted post.
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post || post.isDeleted) {
    return { success: false, error: "Post not found" };
  }

  await db.insert(comments).values({
    postId,
    authorId: ctx.memberId,
    content: parsed.data.content,
  });

  revalidatePath("/feed");
  return { success: true };
}

export async function toggleReaction(
  postId: string,
  emoji: string
): Promise<ActionResult> {
  const ctx = await requireRole("member"); // guests are read-only

  if (!uuid.safeParse(postId).success) {
    return { success: false, error: "Invalid post" };
  }
  // The client sends the reaction KEY ("heart"), which is what the column
  // stores and post-card renders by — validate against the key, not the emoji.
  if (!REACTION_EMOJIS.some((r) => r.key === emoji)) {
    return { success: false, error: "Invalid reaction" };
  }

  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post || post.isDeleted) return { success: false, error: "Post not found" };

  const existing = await db.query.reactions.findFirst({
    where: and(
      eq(reactions.postId, postId),
      eq(reactions.memberId, ctx.memberId),
      eq(reactions.emoji, emoji)
    ),
  });

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
  } else {
    // Race-safe: a fast double-tap can't throw the unique-constraint violation.
    await db
      .insert(reactions)
      .values({
        postId,
        memberId: ctx.memberId,
        emoji,
      })
      .onConflictDoNothing({
        target: [reactions.postId, reactions.memberId, reactions.emoji],
      });
  }

  revalidatePath("/feed");
  return { success: true };
}
