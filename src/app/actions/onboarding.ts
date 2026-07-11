"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members, accessCodes } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

  // The access code is the invite-only gate. The client `validateAccessCode`
  // check is a UX nicety, NOT the security boundary — re-validate and redeem
  // the code here, on the server, before creating the member.
  const code = ((formData.get("accessCode") as string | null) ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { success: false, error: "An access code is required" };
  const bootstrapCode = process.env.HOA_DEFAULT_ACCESS_CODE?.trim().toUpperCase();
  const isBootstrap = !!bootstrapCode && code === bootstrapCode;

  // One transaction, serialized by a transaction-scoped advisory lock, so the
  // "first member becomes Elder" check and the code redemption are race-free
  // (pooler-safe: xact-level locks release on commit).
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(728100)`);

    // The env bootstrap code is tracked as a normal access_codes row.
    if (isBootstrap) {
      await tx
        .insert(accessCodes)
        .values({ code, label: "Bootstrap (env)", maxUses: 1000 })
        .onConflictDoNothing({ target: accessCodes.code });
    }

    const codeRecord = await tx.query.accessCodes.findFirst({
      where: eq(accessCodes.code, code),
    });
    if (!codeRecord || codeRecord.status !== "active") {
      return { ok: false as const, error: "Invalid or expired access code" };
    }
    if (codeRecord.maxUses != null && codeRecord.useCount >= codeRecord.maxUses) {
      return { ok: false as const, error: "This code has been fully used" };
    }
    if (codeRecord.expiresAt && new Date(codeRecord.expiresAt) < new Date()) {
      return { ok: false as const, error: "This code has expired" };
    }

    const memberCount = await tx.select().from(members);
    const isFirstMember = memberCount.length === 0;

    const [newMember] = await tx
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

    // Atomically redeem: increment the count and flip to "used" once consumed.
    const willBeUsed =
      codeRecord.maxUses != null && codeRecord.useCount + 1 >= codeRecord.maxUses;
    await tx
      .update(accessCodes)
      .set({
        useCount: sql`${accessCodes.useCount} + 1`,
        usedBy: newMember.id,
        ...(willBeUsed ? { status: "used" as const } : {}),
      })
      .where(
        and(eq(accessCodes.id, codeRecord.id), eq(accessCodes.status, "active"))
      );

    return { ok: true as const, newMember };
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await supabase.auth.updateUser({
    data: {
      hoa_member_id: result.newMember.id,
      hoa_role: result.newMember.role,
    },
  });

  return { success: true, data: { memberId: result.newMember.id } };
}
