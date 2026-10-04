"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gatherings, rsvps } from "@/lib/db/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatheringSchema, archiveThresholdSchema } from "@/lib/validators";
import { RSVP_STATUSES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import type { ActionResult } from "@/types";

const uuid = z.string().uuid();

// Every surface that renders a gathering or a gathering count.
const GATHERING_ROUTES = ["/gatherings", "/dashboard"] as const;

function revalidateGatherings(gatheringId?: string) {
  GATHERING_ROUTES.forEach((route) => revalidatePath(route));
  if (gatheringId) revalidatePath(`/gatherings/${gatheringId}`);
}

/** Rows an edit may still change: not cancelled, not archived. */
const editableGathering = and(eq(gatherings.isCancelled, false), isNull(gatherings.archivedAt));

/** Explain a conditional write that matched nothing, from the row as it is now. */
async function changedMeanwhile(gatheringId: string, outcome: string): Promise<string> {
  const current = await db.query.gatherings.findFirst({ where: eq(gatherings.id, gatheringId) });
  if (!current) return "This gathering is no longer available";
  if (current.archivedAt) return `This gathering was archived while you were working on it. ${outcome}.`;
  if (current.isCancelled) return `This gathering was cancelled while you were working on it. ${outcome} — restore it first.`;
  return `This gathering changed while you were working on it. ${outcome} — reload and try again.`;
}

export async function createGathering(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireRole("member"); // guests are read-only

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

  revalidateGatherings();
  return { success: true, data: { id: gathering.id } };
}

export async function updateRsvp(
  gatheringId: string,
  status: "attending" | "maybe" | "not_attending",
  note?: string
): Promise<ActionResult> {
  // Deliberate exception to the guests-are-read-only rule: a guest is a real
  // relative, and saying whether you are coming to dinner is not "writing".
  const ctx = await requireAuth();

  // These are runtime boundaries — the TS union is not a runtime guarantee.
  if (!uuid.safeParse(gatheringId).success) {
    return { success: false, error: "Invalid gathering" };
  }
  if (!(RSVP_STATUSES as readonly string[]).includes(status)) {
    return { success: false, error: "Invalid RSVP status" };
  }

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, gatheringId),
  });
  if (!gathering || gathering.isCancelled || gathering.archivedAt) {
    return { success: false, error: "This gathering is not available" };
  }

  const parsedNote = z.string().trim().max(500, "RSVP note is too long").optional().safeParse(note);
  if (!parsedNote.success) return { success: false, error: "RSVP note must be text under 500 characters" };
  const trimmedNote = parsedNote.data || null;
  // Atomic upsert — a same-member double-submit can't throw the unique index.
  await db
    .insert(rsvps)
    .values({
      gatheringId,
      memberId: ctx.memberId,
      status,
      note: trimmedNote,
    })
    .onConflictDoUpdate({
      target: [rsvps.gatheringId, rsvps.memberId],
      set: { status, note: trimmedNote, updatedAt: new Date() },
    });

  revalidateGatherings(gatheringId);
  return { success: true };
}

export async function updateGathering(
  gatheringId: string,
  formData: FormData
): Promise<ActionResult> {
  // Guests RSVP but are otherwise read-only, including on events they created
  // before an Elder changed their role.
  const ctx = await requireRole("member");

  if (!uuid.safeParse(gatheringId).success) {
    return { success: false, error: "Gathering not found" };
  }

  const existing = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, gatheringId),
  });
  if (!existing) return { success: false, error: "Gathering not found" };

  if (existing.createdBy !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  // A cancelled or archived gathering accepts no RSVPs and shows in no list —
  // editing one would produce a freshly-updated row nobody can see or join.
  if (existing.isCancelled) {
    return {
      success: false,
      error: "This gathering is cancelled — restore it before editing",
    };
  }
  if (existing.archivedAt) {
    return { success: false, error: "This gathering has been archived" };
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

  // The state checked above can change before this write: an Elder may archive
  // or someone cancel it meanwhile. Keep the still-editable predicate in the
  // UPDATE itself so an edit can never revive a row nobody can see.
  const [saved] = await db
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
    .where(and(eq(gatherings.id, gatheringId), editableGathering))
    .returning({ id: gatherings.id });

  if (!saved) {
    revalidateGatherings(gatheringId);
    return { success: false, error: await changedMeanwhile(gatheringId, "Your changes weren't saved") };
  }

  revalidateGatherings(gatheringId);
  return { success: true };
}

export async function cancelGathering(
  gatheringId: string
): Promise<ActionResult> {
  return setGatheringCancelled(gatheringId, true);
}

/** Undo a cancellation — a mis-tap must never be a one-way door. */
export async function uncancelGathering(
  gatheringId: string
): Promise<ActionResult> {
  return setGatheringCancelled(gatheringId, false);
}

async function setGatheringCancelled(
  gatheringId: string,
  cancelled: boolean
): Promise<ActionResult> {
  const ctx = await requireRole("member"); // guests are read-only

  if (!uuid.safeParse(gatheringId).success) {
    return { success: false, error: "Gathering not found" };
  }

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, gatheringId),
  });
  if (!gathering) return { success: false, error: "Gathering not found" };

  if (gathering.createdBy !== ctx.memberId && ctx.role !== "elder") {
    return { success: false, error: "Not authorized" };
  }

  if (gathering.archivedAt) {
    return { success: false, error: "This gathering has been archived" };
  }

  // Idempotent: cancelling a cancelled gathering is a no-op, not an error.
  if (gathering.isCancelled !== cancelled) {
    const [changed] = await db
      .update(gatherings)
      .set({ isCancelled: cancelled, updatedAt: new Date() })
      .where(and(
        eq(gatherings.id, gatheringId),
        isNull(gatherings.archivedAt),
        eq(gatherings.isCancelled, !cancelled)
      ))
      .returning({ id: gatherings.id });

    if (!changed) {
      // Someone else got there first. Same outcome is still a success;
      // an archive in between is not.
      const current = await db.query.gatherings.findFirst({ where: eq(gatherings.id, gatheringId) });
      revalidateGatherings(gatheringId);
      if (current && !current.archivedAt && current.isCancelled === cancelled) return { success: true };
      return {
        success: false,
        error: !current
          ? "This gathering is no longer available"
          : current.archivedAt
            ? "This gathering was archived while you were working on it. Nothing was changed."
            : "This gathering changed while you were working on it. Nothing was changed — reload and try again.",
      };
    }

    await logAudit({
      actorId: ctx.memberId,
      action: cancelled ? "gathering.cancelled" : "gathering.uncancelled",
      entityType: "gathering",
      entityId: gatheringId,
      metadata: { title: gathering.title },
    });
  }

  revalidateGatherings(gatheringId);
  return { success: true };
}

export async function archivePastGatherings(
  thresholdDays = 7
): Promise<ActionResult<{ archived: number }>> {
  const ctx = await requireRole("elder");

  // The only bulk write in the House. Its boundary reaches a WHERE clause, so a
  // negative or NaN value would sweep up every FUTURE gathering — validate it
  // like any other untrusted input.
  const parsed = archiveThresholdSchema.safeParse(thresholdDays);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parsed.data);

  const result = await db
    .update(gatherings)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        // Never re-archive; never touch a gathering that is still running.
        // One statement: if a reschedule commits while this waits for the row,
        // PostgreSQL rechecks the end time against the rescheduled version.
        isNull(gatherings.archivedAt),
        // A raw Date inside sql`` bypasses Drizzle's column encoder and the
        // postgres-js driver rejects it; bind the instant as typed text.
        lt(sql`coalesce(${gatherings.endsAt}, ${gatherings.startsAt})`, sql`${cutoff.toISOString()}::timestamptz`)
      )
    )
    .returning({ id: gatherings.id });

  await logAudit({
    actorId: ctx.memberId,
    action: "gathering.archived_past",
    metadata: { count: result.length, thresholdDays: parsed.data },
  });

  revalidateGatherings();
  return { success: true, data: { archived: result.length } };
}
