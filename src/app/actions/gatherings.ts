"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gatherings, rsvps } from "@/lib/db/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatheringSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";

export async function createGathering(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAuth();

  const parsed = gatheringSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    isAllDay: formData.get("isAllDay") === "true",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const [gathering] = await db
    .insert(gatherings)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isAllDay: parsed.data.isAllDay,
      createdBy: ctx.memberId,
    })
    .returning();

  revalidatePath("/gatherings");
  revalidatePath("/dashboard");
  return { success: true, data: { id: gathering.id } };
}

export async function updateRsvp(
  gatheringId: string,
  status: "attending" | "maybe" | "not_attending",
  note?: string
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const existing = await db.query.rsvps.findFirst({
    where: and(
      eq(rsvps.gatheringId, gatheringId),
      eq(rsvps.memberId, ctx.memberId)
    ),
  });

  if (existing) {
    await db
      .update(rsvps)
      .set({ status, note: note ?? null, updatedAt: new Date() })
      .where(eq(rsvps.id, existing.id));
  } else {
    await db.insert(rsvps).values({
      gatheringId,
      memberId: ctx.memberId,
      status,
      note: note ?? null,
    });
  }

  revalidatePath(`/gatherings/${gatheringId}`);
  revalidatePath("/gatherings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateGathering(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const existing = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, gatheringId),
  });
  if (!existing) return { success: false, error: "Gathering not found" };

  if (existing.createdBy !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  const parsed = gatheringSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    isAllDay: formData.get("isAllDay") === "true",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await db
    .update(gatherings)
    .set({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isAllDay: parsed.data.isAllDay,
      updatedAt: new Date(),
    })
    .where(eq(gatherings.id, gatheringId));

  revalidatePath(`/gatherings/${gatheringId}`);
  revalidatePath("/gatherings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function cancelGathering(
  gatheringId: string
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, gatheringId),
  });
  if (!gathering) return { success: false, error: "Gathering not found" };

  if (gathering.createdBy !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  await db
    .update(gatherings)
    .set({ isCancelled: true, updatedAt: new Date() })
    .where(eq(gatherings.id, gatheringId));

  await logAudit({
    actorId: ctx.memberId,
    action: "gathering.cancelled",
    entityType: "gathering",
    entityId: gatheringId,
    metadata: { title: gathering.title },
  });

  revalidatePath("/gatherings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archivePastGatherings(
  thresholdDays = 7
): Promise<ActionResult<{ archived: number }>> {
  const ctx = await requireRole("elder");

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  const result = await db
    .update(gatherings)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        isNull(gatherings.archivedAt),
        lt(gatherings.startsAt, cutoff)
      )
    )
    .returning({ id: gatherings.id });

  await logAudit({
    actorId: ctx.memberId,
    action: "gathering.archived_past",
    metadata: { count: result.length, thresholdDays },
  });

  revalidatePath("/gatherings");
  revalidatePath("/dashboard");
  revalidatePath("/elder-council");
  return { success: true, data: { archived: result.length } };
}
