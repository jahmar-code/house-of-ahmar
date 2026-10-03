"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accessCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { createAccessCodeSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import type { ActionResult } from "@/types";
import crypto from "crypto";

const uuid = z.string().uuid();

// The Elder Council overview counts active codes alongside the codes page.
const ACCESS_CODE_ROUTES = [
  "/elder-council/access-codes",
  "/elder-council",
] as const;

export async function createAccessCode(
  formData: FormData
): Promise<ActionResult<{ code: string }>> {
  const ctx = await requireRole("elder");

  const expiresInDaysRaw = formData.get("expiresInDays");
  const maxUsesRaw = formData.get("maxUses");
  // Pass the raw value through — `Number(x) || 1` used to turn "0"/""/"abc"
  // into a silent single-use code, so Zod's range check never saw them.
  const parsed = createAccessCodeSchema.safeParse({
    label: formData.get("label") || undefined,
    maxUses: maxUsesRaw === null || maxUsesRaw === "" ? undefined : maxUsesRaw,
    expiresInDays: expiresInDaysRaw ? Number(expiresInDaysRaw) : undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // 64 bits of entropy; copy/share controls avoid making relatives type it.
  const code = crypto.randomBytes(8).toString("hex").toUpperCase();

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

  ACCESS_CODE_ROUTES.forEach((route) => revalidatePath(route));
  return { success: true, data: { code } };
}

export async function revokeAccessCode(
  codeId: string
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  if (!uuid.safeParse(codeId).success) {
    return { success: false, error: "Code not found" };
  }

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

  ACCESS_CODE_ROUTES.forEach((route) => revalidatePath(route));
  return { success: true };
}
