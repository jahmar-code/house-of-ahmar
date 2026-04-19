"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members, accessCodes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { accessCodeSchema, profileSchema } from "@/lib/validators";
import type { ActionResult } from "@/types";

async function ensureBootstrapCodeRow(code: string): Promise<void> {
  // Idempotent insert so the env-code's uses are tracked alongside other codes.
  await db
    .insert(accessCodes)
    .values({
      code,
      label: "Bootstrap (env)",
      maxUses: 1000,
    })
    .onConflictDoNothing({ target: accessCodes.code });
}

export async function validateAccessCode(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = accessCodeSchema.safeParse({
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const defaultCode = process.env.HOA_DEFAULT_ACCESS_CODE;
  if (defaultCode && parsed.data.code === defaultCode.toUpperCase()) {
    await ensureBootstrapCodeRow(parsed.data.code);
    return { success: true };
  }

  const codeRecord = await db.query.accessCodes.findFirst({
    where: and(
      eq(accessCodes.code, parsed.data.code),
      eq(accessCodes.status, "active")
    ),
  });

  if (!codeRecord) {
    return { success: false, error: "Invalid or expired access code" };
  }

  if (codeRecord.maxUses && codeRecord.useCount >= codeRecord.maxUses) {
    return { success: false, error: "This code has been fully used" };
  }

  if (codeRecord.expiresAt && new Date(codeRecord.expiresAt) < new Date()) {
    return { success: false, error: "This code has expired" };
  }

  return { success: true };
}

export async function completeInitiation(
  formData: FormData
): Promise<ActionResult<{ memberId: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const existing = await db.query.members.findFirst({
    where: eq(members.authUserId, user.id),
  });
  if (existing) {
    return { success: true, data: { memberId: existing.id } };
  }

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

  const memberCount = await db.select().from(members);
  const isFirstMember = memberCount.length === 0;

  const [newMember] = await db
    .insert(members)
    .values({
      authUserId: user.id,
      displayName: parsed.data.displayName,
      fullName: parsed.data.fullName ?? null,
      email: user.email ?? null,
      phone: parsed.data.phone ?? null,
      bio: parsed.data.bio ?? null,
      birthday: parsed.data.birthday ?? null,
      role: isFirstMember ? "elder" : "member",
      avatarUrl: null,
    })
    .returning();

  await supabase.auth.updateUser({
    data: {
      hoa_member_id: newMember.id,
      hoa_role: newMember.role,
    },
  });

  const usedCode = formData.get("accessCode") as string | null;
  if (usedCode) {
    const codeRecord = await db.query.accessCodes.findFirst({
      where: eq(accessCodes.code, usedCode.toUpperCase()),
    });
    if (codeRecord) {
      await db
        .update(accessCodes)
        .set({
          useCount: codeRecord.useCount + 1,
          usedBy: newMember.id,
          status:
            codeRecord.maxUses && codeRecord.useCount + 1 >= codeRecord.maxUses
              ? "used"
              : "active",
        })
        .where(eq(accessCodes.id, codeRecord.id));
    }
  }

  return { success: true, data: { memberId: newMember.id } };
}
