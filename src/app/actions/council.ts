"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { channels, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { messageSchema, channelSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";

export async function sendMessage(
  channelId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const parsed = messageSchema.safeParse({
    content: formData.get("content"),
    replyToId: formData.get("replyToId") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Private chambers (e.g. "Elders Only") are elder-only to read AND post.
  // channel.type is not just a label — enforce it server-side.
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) return { success: false, error: "Channel not found" };
  if (channel.type === "private" && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db.insert(messages).values({
    channelId,
    authorId: ctx.memberId,
    content: parsed.data.content,
    replyToId: parsed.data.replyToId ?? null,
  });

  revalidatePath(`/council/${channelId}`);
  return { success: true };
}

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  const ctx = await requireAuth();

  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });
  if (!message) return { success: false, error: "Message not found" };

  if (message.authorId !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db
    .update(messages)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(messages.id, messageId));

  revalidatePath(`/council/${message.channelId}`);
  return { success: true };
}

export async function createChannel(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireRole("elder");

  const parsed = channelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    type: formData.get("type") || "general",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const slug =
    parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "chamber";

  // Slug is UNIQUE — surface a clean error instead of a raw DB constraint throw.
  const slugTaken = await db.query.channels.findFirst({
    where: eq(channels.slug, slug),
  });
  if (slugTaken) {
    return {
      success: false,
      error: "A chamber with a similar name already exists",
    };
  }

  const [channel] = await db
    .insert(channels)
    .values({
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      createdBy: ctx.memberId,
    })
    .returning();

  await logAudit({
    actorId: ctx.memberId,
    action: "channel.created",
    entityType: "channel",
    entityId: channel.id,
    metadata: { name: channel.name, slug, type: parsed.data.type },
  });

  revalidatePath("/council");
  revalidatePath("/elder-council/channels");
  return { success: true, data: { id: channel.id } };
}
