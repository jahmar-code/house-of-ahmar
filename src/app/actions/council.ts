"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { channels, messages } from "@/lib/db/schema";
import { eq, and, ne, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  messageSchema,
  channelSchema,
  renameChannelSchema,
} from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import type { ActionResult } from "@/types";
import { PUBLIC_MEMBER_COLUMNS, type MessageWithAuthor } from "@/types";
import { MESSAGE_PRECISION_COLUMNS } from "@/lib/db/message-projection";

const uuid = z.string().uuid();

// Every surface that renders a chamber or a chamber count.
const CHANNEL_ROUTES = [
  "/council",
  "/elder-council/channels",
  "/dashboard",
] as const;

/** Keyset history remains usable after the latest-message window fills up. */
export async function loadOlderMessages(channelId: string, beforeId: string): Promise<ActionResult<{ messages: MessageWithAuthor[]; hasMore: boolean }>> {
  const ctx = await requireAuth();
  if (!uuid.safeParse(channelId).success || !uuid.safeParse(beforeId).success) {
    return { success: false, error: "Chamber not found" };
  }
  const channel = await db.query.channels.findFirst({ where: eq(channels.id, channelId) });
  if (!channel || channel.isArchived || (channel.type === "private" && ctx.role !== "elder")) {
    return { success: false, error: "Chamber not found" };
  }
  const cursor = await db.query.messages.findFirst({
    where: and(eq(messages.id, beforeId), eq(messages.channelId, channelId)),
  });
  if (!cursor) return { success: false, error: "That message is no longer available" };
  const rows = await db.query.messages.findMany({
    where: and(eq(messages.channelId, channelId), eq(messages.isDeleted, false),
      // Keep the cursor timestamp in Postgres: JS Date drops microseconds and
      // would permanently skip older messages from the same millisecond.
      sql`(${messages.createdAt}, ${messages.id}) < (
        select history_cursor.created_at, history_cursor.id
        from public.messages as history_cursor
        where history_cursor.id = ${cursor.id}::uuid
          and history_cursor.channel_id = ${channelId}::uuid
      )`),
    orderBy: [desc(messages.createdAt), desc(messages.id)],
    limit: 51,
    extras: MESSAGE_PRECISION_COLUMNS,
    with: { author: { columns: PUBLIC_MEMBER_COLUMNS } },
  });
  return { success: true, data: { messages: rows.slice(0, 50).reverse(), hasMore: rows.length > 50 } };
}

export async function sendMessage(
  channelId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireRole("member"); // guests are read-only

  if (!uuid.safeParse(channelId).success) {
    return { success: false, error: "Chamber not found" };
  }

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
  if (!channel) return { success: false, error: "Chamber not found" };
  if (channel.isArchived) {
    return { success: false, error: "This chamber is archived" };
  }
  if (channel.type === "private" && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }
  if (channel.type === "announcement" && ctx.role !== "elder") {
    return { success: false, error: "Only Elders can post announcements" };
  }

  // A reply must point at a live message in THIS chamber — otherwise the thread
  // quote dangles, or an id from the private chamber crosses into a public one.
  if (parsed.data.replyToId) {
    const parent = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, parsed.data.replyToId),
        eq(messages.channelId, channelId),
        eq(messages.isDeleted, false)
      ),
    });
    if (!parent) {
      return { success: false, error: "That message is no longer available" };
    }
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

  if (!uuid.safeParse(messageId).success) {
    return { success: false, error: "Message not found" };
  }

  const message = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });
  if (!message) return { success: false, error: "Message not found" };

  if (message.authorId !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db
    .update(messages)
    .set({ isDeleted: true, content: "", mediaUrls: [], updatedAt: new Date() })
    .where(eq(messages.id, messageId));

  // An Elder removing a relative's message is on the record; removing your own
  // is not — the log should read as accountability, not surveillance.
  if (message.authorId !== ctx.memberId) {
    await logAudit({
      actorId: ctx.memberId,
      action: "message.deleted_by_elder",
      entityType: "message",
      entityId: messageId,
      metadata: {
        authorId: message.authorId,
        channelId: message.channelId,
        preview: message.content.slice(0, 140),
      },
    });
  }

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
    .onConflictDoNothing({ target: channels.slug })
    .returning();

  if (!channel) {
    return { success: false, error: "A chamber with a similar name already exists" };
  }

  await logAudit({
    actorId: ctx.memberId,
    action: "channel.created",
    entityType: "channel",
    entityId: channel.id,
    metadata: { name: channel.name, slug, type: parsed.data.type },
  });

  CHANNEL_ROUTES.forEach((route) => revalidatePath(route));
  return { success: true, data: { id: channel.id } };
}

/**
 * Rename a chamber (and reword its description). The slug is deliberately NOT
 * re-derived: it is the stable identifier the seed migration and ops scripts
 * key on, and no route uses it, so a rename stays a pure display change.
 */
export async function renameChannel(
  channelId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  if (!uuid.safeParse(channelId).success) {
    return { success: false, error: "Chamber not found" };
  }

  const parsed = renameChannelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) return { success: false, error: "Chamber not found" };

  // Two chambers with the same name are indistinguishable in the Council list.
  const nameTaken = await db.query.channels.findFirst({
    where: and(eq(channels.name, parsed.data.name), ne(channels.id, channelId)),
  });
  if (nameTaken) {
    return { success: false, error: "A chamber with that name already exists" };
  }

  await db
    .update(channels)
    .set({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .where(eq(channels.id, channelId));

  await logAudit({
    actorId: ctx.memberId,
    action: "channel.renamed",
    entityType: "channel",
    entityId: channelId,
    metadata: { from: channel.name, to: parsed.data.name },
  });

  CHANNEL_ROUTES.forEach((route) => revalidatePath(route));
  revalidatePath(`/council/${channelId}`);
  return { success: true };
}

/**
 * Archive a chamber. Archiving, never deleting — the family's conversation is
 * kept; the chamber just stops accepting messages and drops out of the lists.
 */
export async function archiveChannel(
  channelId: string
): Promise<ActionResult> {
  return setChannelArchived(channelId, true);
}

/** Reopen an archived chamber. */
export async function unarchiveChannel(
  channelId: string
): Promise<ActionResult> {
  return setChannelArchived(channelId, false);
}

async function setChannelArchived(
  channelId: string,
  archived: boolean
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  if (!uuid.safeParse(channelId).success) {
    return { success: false, error: "Chamber not found" };
  }

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });
  if (!channel) return { success: false, error: "Chamber not found" };

  // Idempotent: re-running the same request is a no-op, not an error.
  if (channel.isArchived !== archived) {
    await db
      .update(channels)
      .set({ isArchived: archived })
      .where(eq(channels.id, channelId));

    await logAudit({
      actorId: ctx.memberId,
      action: archived ? "channel.archived" : "channel.unarchived",
      entityType: "channel",
      entityId: channelId,
      metadata: { name: channel.name, slug: channel.slug },
    });
  }

  CHANNEL_ROUTES.forEach((route) => revalidatePath(route));
  revalidatePath(`/council/${channelId}`);
  return { success: true };
}
