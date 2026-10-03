"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { houseSettings } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { houseSettingsSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";

export async function updateHouseSettings(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const parsed = houseSettingsSchema.safeParse({
    houseName: formData.get("houseName"),
    houseTagline: formData.get("houseTagline") ?? "",
    welcomeMessage: formData.get("welcomeMessage") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const entries = Object.entries(parsed.data);
  const now = new Date();

  // The House's identity is ONE aggregate spread over four KV rows — commit it
  // as one transaction so a pooler hiccup can never leave the landing page and
  // the Great Hall showing two different Houses. No I/O inside the boundary:
  // the audit write and the revalidations happen after the commit.
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(houseSettings)
        .values({
          key,
          value,
          updatedBy: ctx.memberId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: houseSettings.key,
          set: {
            value: sql`excluded.value`,
            updatedBy: ctx.memberId,
            updatedAt: now,
          },
        });
    }
  });

  await logAudit({
    actorId: ctx.memberId,
    action: "settings.updated",
    entityType: "house_settings",
    metadata: { keys: entries.map(([k]) => k) },
  });

  // House identity also appears on prerendered sign-in, signup and recovery
  // pages. Invalidate every descendant of the shared root layout.
  revalidatePath("/", "layout");
  return { success: true };
}
