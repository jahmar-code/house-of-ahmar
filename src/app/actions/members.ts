"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { profileSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";
import { HOA_ROLES, type HoaRole } from "@/lib/constants";
import { ownedMediaUrl } from "@/lib/media";

/**
 * An avatar URL is client-supplied, so it must point at our own Storage origin —
 * otherwise any member could aim their photo at an external tracker and have the
 * whole House load it on every screen.
 */
const avatarUrlSchema = z
  .string()
  .max(2048, "That photo link is too long")
  .min(1, "That photo link isn't valid");

const selfProfileSchema = profileSchema.extend({
  avatarUrl: avatarUrlSchema.optional(),
});

export async function updateProfile(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAuth();

  // An absent `avatarUrl` field means "leave the photo alone"; a present-but-
  // empty one means "take my photo down". Those are different intents.
  const rawAvatarUrl = formData.get("avatarUrl");
  const avatarProvided = rawAvatarUrl !== null;

  const parsed = selfProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    fullName: formData.get("fullName") || undefined,
    bio: formData.get("bio") || undefined,
    birthday: formData.get("birthday") || undefined,
    phone: formData.get("phone") || undefined,
    avatarUrl: rawAvatarUrl || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const normalizedAvatar = parsed.data.avatarUrl === ctx.avatarUrl
    ? ctx.avatarUrl
    : parsed.data.avatarUrl ? ownedMediaUrl(parsed.data.avatarUrl, ctx.memberId, true) : null;
  if (parsed.data.avatarUrl && !normalizedAvatar) {
    return { success: false, error: "Upload a profile photo from your own account" };
  }

  await db
    .update(members)
    .set({
      displayName: parsed.data.displayName,
      fullName: parsed.data.fullName ?? null,
      bio: parsed.data.bio ?? null,
      birthday: parsed.data.birthday ?? null,
      phone: parsed.data.phone ?? null,
      ...(avatarProvided ? { avatarUrl: normalizedAvatar } : {}),
      updatedAt: new Date(),
    })
    .where(eq(members.id, ctx.memberId));

  // A name and a face are rendered on nearly every surface in the House, so the
  // repaint has to reach further than the directory.
  revalidatePath("/settings");
  revalidatePath("/members");
  revalidatePath(`/members/${ctx.memberId}`);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  revalidatePath("/council", "layout");
  return { success: true };
}

type MemberChange = { role: HoaRole } | { isActive: boolean };

/** Serialize the House's active-Elder invariant, then recheck the actor's role. */
async function changeMember(memberId: string, change: MemberChange): Promise<ActionResult> {
  const ctx = await requireRole("elder");
  if (!z.string().uuid().safeParse(memberId).success) {
    return { success: false, error: "Member not found" };
  }
  if ("isActive" in change && !change.isActive && memberId === ctx.memberId) {
    return { success: false, error: "Cannot deactivate yourself" };
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(728101)`);
    // Another Elder may have demoted this caller while their request waited.
    const actor = await tx.query.members.findFirst({ where: eq(members.id, ctx.memberId) });
    if (!actor?.isActive || actor.role !== "elder") {
      return { success: false as const, error: "Insufficient permissions" };
    }
    const target = await tx.query.members.findFirst({ where: eq(members.id, memberId) });
    if (!target) return { success: false as const, error: "Member not found" };

    const nextRole = "role" in change ? change.role : target.role;
    const nextActive = "isActive" in change ? change.isActive : target.isActive;
    if (target.isActive && target.role === "elder" && (!nextActive || nextRole !== "elder")) {
      const elders = await tx.select({ id: members.id }).from(members)
        .where(and(eq(members.role, "elder"), eq(members.isActive, true)));
      if (elders.length <= 1) {
        return { success: false as const, error: "The House must keep at least one Elder" };
      }
    }
    if (target.role === nextRole && target.isActive === nextActive) {
      return { success: true as const, target, changed: false };
    }
    await tx.update(members).set({ ...change, updatedAt: new Date() }).where(eq(members.id, memberId));
    return { success: true as const, target, changed: true };
  });
  if (!result.success) return result;

  if (result.changed) {
    await logAudit({
      actorId: ctx.memberId,
      action: "role" in change ? "member.role_changed" : change.isActive ? "member.reactivated" : "member.deactivated",
      entityType: "member",
      entityId: memberId,
      metadata: "role" in change
        ? { from: result.target.role, to: change.role, displayName: result.target.displayName }
        : { displayName: result.target.displayName },
    });
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateMemberRole(memberId: string, role: HoaRole): Promise<ActionResult> {
  // Authorize before evaluating untrusted arguments, including malformed roles.
  await requireRole("elder");
  if (!(HOA_ROLES as readonly string[]).includes(role)) {
    return { success: false, error: "Invalid role" };
  }
  return changeMember(memberId, { role });
}

export async function deactivateMember(memberId: string): Promise<ActionResult> {
  return changeMember(memberId, { isActive: false });
}

export async function reactivateMember(memberId: string): Promise<ActionResult> {
  return changeMember(memberId, { isActive: true });
}
