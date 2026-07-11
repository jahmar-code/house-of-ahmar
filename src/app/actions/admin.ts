"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createAccessCodeSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";
import crypto from "crypto";

export async function createAccessCode(
  formData: FormData
): Promise<ActionResult<{ code: string }>> {
  const ctx = await requireRole("elder");

  const expiresInDaysRaw = formData.get("expiresInDays");
  const parsed = createAccessCodeSchema.safeParse({
    label: formData.get("label") || undefined,
    maxUses: Number(formData.get("maxUses")) || 1,
    expiresInDays: expiresInDaysRaw ? Number(expiresInDaysRaw) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Generate a random 8-char uppercase code
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const [created] = await db
    .insert(accessCodes)
    .values({
      code,
      label: parsed.data.label ?? null,
      maxUses: parsed.data.maxUses,
      expiresAt,
      createdBy: ctx.memberId,
    })
    .returning();

  await logAudit({
    actorId: ctx.memberId,
    action: "access_code.created",
    entityType: "access_code",
    entityId: created.id,
    metadata: {
      code,
      label: parsed.data.label ?? null,
      maxUses: parsed.data.maxUses,
      expiresInDays: parsed.data.expiresInDays ?? null,
    },
  });

  revalidatePath("/elder-council/access-codes");
  return { success: true, data: { code } };
}

export async function revokeAccessCode(
  codeId: string
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const target = await db.query.accessCodes.findFirst({
    where: eq(accessCodes.id, codeId),
  });
  if (!target) return { success: false, error: "Code not found" };

  await db
    .update(accessCodes)
    .set({ status: "revoked" })
    .where(eq(accessCodes.id, codeId));

  await logAudit({
    actorId: ctx.memberId,
    action: "access_code.revoked",
    entityType: "access_code",
    entityId: codeId,
    metadata: { code: target.code, label: target.label },
  });

  revalidatePath("/elder-council/access-codes");
  return { success: true };
}
