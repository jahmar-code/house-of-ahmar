"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { albums, photos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import type { ActionResult } from "@/types";

const albumSchema = z.object({
  title: z.string().min(2, "Title is too short").max(100, "Title is too long"),
  description: z.string().max(500).optional(),
  coverPhotoUrl: z.string().url().optional(),
  isPrivate: z.boolean().default(false),
});

const photoSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  thumbnailUrl: z.string().url().optional(),
  caption: z.string().max(300).optional(),
});

export async function createAlbum(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAuth();

  const parsed = albumSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    coverPhotoUrl: formData.get("coverPhotoUrl") || undefined,
    isPrivate: formData.get("isPrivate") === "true",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const [album] = await db
    .insert(albums)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      coverPhotoUrl: parsed.data.coverPhotoUrl ?? null,
      isPrivate: parsed.data.isPrivate,
      createdBy: ctx.memberId,
    })
    .returning();

  revalidatePath("/archives");
  return { success: true, data: { id: album.id } };
}

export async function uploadPhoto(
  albumId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const album = await db.query.albums.findFirst({
    where: eq(albums.id, albumId),
  });
  if (!album) return { success: false, error: "Album not found" };

  const parsed = photoSchema.safeParse({
    url: formData.get("url"),
    thumbnailUrl: formData.get("thumbnailUrl") || undefined,
    caption: formData.get("caption") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await db.insert(photos).values({
    albumId,
    uploadedBy: ctx.memberId,
    url: parsed.data.url,
    thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    caption: parsed.data.caption ?? null,
  });

  // Set as cover if album has none yet
  if (!album.coverPhotoUrl) {
    await db
      .update(albums)
      .set({ coverPhotoUrl: parsed.data.url, updatedAt: new Date() })
      .where(eq(albums.id, albumId));
  }

  revalidatePath(`/archives/${albumId}`);
  revalidatePath("/archives");
  return { success: true };
}

export async function deleteAlbum(albumId: string): Promise<ActionResult> {
  const ctx = await requireAuth();

  const album = await db.query.albums.findFirst({
    where: eq(albums.id, albumId),
  });
  if (!album) return { success: false, error: "Album not found" };

  if (album.createdBy !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db.delete(albums).where(eq(albums.id, albumId));
  revalidatePath("/archives");
  return { success: true };
}
