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

  await Promise.all(
    entries.map(([key, value]) =>
      db
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
        })
    )
  );

  await logAudit({
    actorId: ctx.memberId,
    action: "settings.updated",
    entityType: "house_settings",
    metadata: { keys: entries.map(([k]) => k) },
  });

  revalidatePath("/elder-council/settings");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: true };
}
