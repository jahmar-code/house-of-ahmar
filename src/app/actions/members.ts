"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth";
import { profileSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";
import type { HoaRole } from "@/lib/constants";

export async function updateProfile(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAuth();

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    fullName: formData.get("fullName") || undefined,
    bio: formData.get("bio") || undefined,
    birthday: formData.get("birthday") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await db
    .update(members)
    .set({
      displayName: parsed.data.displayName,
      fullName: parsed.data.fullName ?? null,
      bio: parsed.data.bio ?? null,
      birthday: parsed.data.birthday ?? null,
      phone: parsed.data.phone ?? null,
      updatedAt: new Date(),
    })
    .where(eq(members.id, ctx.memberId));

  revalidatePath("/members");
  revalidatePath(`/members/${ctx.memberId}`);
  return { success: true };
}

export async function updateMemberRole(
  memberId: string,
  role: HoaRole
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const target = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });
  if (!target) return { success: false, error: "Member not found" };

  await db
    .update(members)
    .set({ role, updatedAt: new Date() })
    .where(eq(members.id, memberId));

  await logAudit({
    actorId: ctx.memberId,
    action: "member.role_changed",
    entityType: "member",
    entityId: memberId,
    metadata: { from: target.role, to: role, displayName: target.displayName },
  });

  revalidatePath("/members");
  revalidatePath("/elder-council/members");
  return { success: true };
}

export async function deactivateMember(
  memberId: string
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  if (memberId === ctx.memberId) {
    return { success: false, error: "Cannot deactivate yourself" };
  }

  const target = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });
  if (!target) return { success: false, error: "Member not found" };

  await db
    .update(members)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(members.id, memberId));

  await logAudit({
    actorId: ctx.memberId,
    action: "member.deactivated",
    entityType: "member",
    entityId: memberId,
    metadata: { displayName: target.displayName },
  });

  revalidatePath("/members");
  revalidatePath("/elder-council/members");
  return { success: true };
}

export async function reactivateMember(
  memberId: string
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const target = await db.query.members.findFirst({
    where: eq(members.id, memberId),
  });
  if (!target) return { success: false, error: "Member not found" };

  await db
    .update(members)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(members.id, memberId));

  await logAudit({
    actorId: ctx.memberId,
    action: "member.reactivated",
    entityType: "member",
    entityId: memberId,
    metadata: { displayName: target.displayName },
  });

  revalidatePath("/members");
  revalidatePath("/elder-council/members");
  return { success: true };
}
