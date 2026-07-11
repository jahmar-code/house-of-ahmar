"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { posts, comments, reactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { postSchema, commentSchema } from "@/lib/validators";
import { REACTION_EMOJIS } from "@/lib/constants";
import { z } from "zod";
import type { ActionResult } from "@/types";

const uuid = z.string().uuid();

export async function createPost(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();

  const rawMediaUrls = formData.get("mediaUrls") as string | null;
  let mediaUrls: string[] | undefined;
  if (rawMediaUrls) {
    try {
      mediaUrls = JSON.parse(rawMediaUrls);
    } catch {
      return { success: false, error: "Invalid media URLs" };
    }
  }

  const parsed = postSchema.safeParse({
    content: formData.get("content"),
    type: formData.get("type") || "text",
    mediaUrls,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await db.insert(posts).values({
    authorId: ctx.memberId,
    content: parsed.data.content,
    type: parsed.data.type,
    mediaUrls: parsed.data.mediaUrls ?? [],
  });

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function togglePostPin(postId: string): Promise<ActionResult> {
  await requireRole("elder");

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
  });
  if (!post) return { success: false, error: "Post not found" };

  await db
    .update(posts)
    .set({ isPinned: !post.isPinned, updatedAt: new Date() })
    .where(eq(posts.id, postId));

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deletePost(postId: string): Promise<ActionResult> {
  const ctx = await requireAuth();

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

  revalidatePath("/feed");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addComment(formData: FormData): Promise<ActionResult> {
  const ctx = await requireAuth();

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
  const ctx = await requireAuth();

  if (!uuid.safeParse(postId).success) {
    return { success: false, error: "Invalid post" };
  }
  // Only the fixed reaction set may be stored (it is later rendered verbatim).
  if (!REACTION_EMOJIS.some((r) => r.emoji === emoji)) {
    return { success: false, error: "Invalid reaction" };
  }

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
