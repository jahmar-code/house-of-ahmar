"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members, accessCodes } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { accessCodeSchema, profileSchema } from "@/lib/validators";
import {
  checkRateLimit,
  clearRateLimit,
  recordFailedAttempt,
} from "@/lib/rate-limit";
import { getServerEnv } from "@/lib/env";
import type { ActionResult } from "@/types";

// Cap access-code attempts per user to blunt brute-forcing of the invite gate.
// Only *failures* count, so a relative who types their code correctly is never
// throttled by it.
const CODE_ATTEMPT_LIMIT = 8;
const CODE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

// The two steps get SEPARATE buckets. They used to share one, so fumbling the
// code screen locked a new relative out of the profile step — and out of the
// self-healing retry in completeInitiation that exists to rescue them.
const codeAttemptKey = (userId: string) => `initiation:code:${userId}`;
const joinAttemptKey = (userId: string) => `initiation:join:${userId}`;

/** Thrown inside the join transaction to undo the new member row. */
class InviteNotRedeemed extends Error {}

const TOO_MANY_ATTEMPTS =
  "Too many tries just now — give it a few minutes and have another go.";
const BAD_CODE = "That code isn't valid. Ask whoever invited you for a new one.";

async function memberCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members);
  return row?.count ?? 0;
}

export async function validateAccessCode(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const attemptKey = codeAttemptKey(user.id);
  if (!checkRateLimit(attemptKey, CODE_ATTEMPT_LIMIT).allowed) {
    return { success: false, error: TOO_MANY_ATTEMPTS };
  }

  const parsed = accessCodeSchema.safeParse({
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const bootstrapCode = getServerEnv().HOA_DEFAULT_ACCESS_CODE?.trim().toUpperCase();

  // The env bootstrap code may ONLY ever create the founding Elder. Once the
  // House has a member it is retired here as well as in completeInitiation, so
  // this screen never accepts a code that redemption would then refuse.
  if (bootstrapCode && parsed.data.code === bootstrapCode) {
    if ((await memberCount()) === 0) {
      clearRateLimit(attemptKey);
      return { success: true };
    }
    recordFailedAttempt(attemptKey, CODE_ATTEMPT_WINDOW_MS);
    return { success: false, error: BAD_CODE };
  }

  const codeRecord = await db.query.accessCodes.findFirst({
    where: and(
      eq(accessCodes.code, parsed.data.code),
      eq(accessCodes.status, "active")
    ),
  });

  if (!codeRecord) {
    recordFailedAttempt(attemptKey, CODE_ATTEMPT_WINDOW_MS);

    // First-boot guard rail: an empty House with no bootstrap code configured
    // is a sealed box, and the generic message gives the owner no clue why.
    if (!bootstrapCode) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(accessCodes);
      if ((row?.count ?? 0) === 0) {
        return {
          success: false,
          error:
            "The House hasn't been opened yet — no codes exist. Set HOA_DEFAULT_ACCESS_CODE on the server to create the first Elder.",
        };
      }
    }

    return { success: false, error: BAD_CODE };
  }

  if (codeRecord.maxUses && codeRecord.useCount >= codeRecord.maxUses) {
    recordFailedAttempt(attemptKey, CODE_ATTEMPT_WINDOW_MS);
    return {
      success: false,
      error: "That code has already been used. Ask for a fresh one.",
    };
  }

  if (codeRecord.expiresAt && new Date(codeRecord.expiresAt) < new Date()) {
    recordFailedAttempt(attemptKey, CODE_ATTEMPT_WINDOW_MS);
    return {
      success: false,
      error: "That code has expired. Ask for a fresh one.",
    };
  }

  clearRateLimit(attemptKey);
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

  // Retry succeeds even if an earlier request committed before the response
  // reached the phone. Inactive membership is never revived by onboarding.
  const existing = await db.query.members.findFirst({
    where: eq(members.authUserId, user.id),
  });
  if (existing) {
    if (!existing.isActive) return { success: false, error: "Your access has been paused. Ask an Elder to restore it." };
    return { success: true, data: { memberId: existing.id } };
  }

  const attemptKey = joinAttemptKey(user.id);
  if (!checkRateLimit(attemptKey, CODE_ATTEMPT_LIMIT).allowed) {
    return { success: false, error: TOO_MANY_ATTEMPTS };
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
  const codeInput = accessCodeSchema.safeParse({ code: formData.get("accessCode") });
  if (!codeInput.success) return { success: false, error: codeInput.error.issues[0].message };
  const code = codeInput.data.code;
  const bootstrapCode = getServerEnv().HOA_DEFAULT_ACCESS_CODE?.trim().toUpperCase();
  const isBootstrap = !!bootstrapCode && code === bootstrapCode;

  // One transaction, serialized by a transaction-scoped advisory lock, so the
  // "first member becomes Elder" check and the code redemption are race-free
  // (pooler-safe: xact-level locks release on commit).
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(728100)`);

    // A concurrent request may have passed the outer retry check before this
    // transaction acquired the lock. Recheck inside, before consuming an invite.
    const joined = await tx.query.members.findFirst({ where: eq(members.authUserId, user.id) });
    if (joined) {
      return joined.isActive
        ? { ok: true as const, newMember: joined }
        : { ok: false as const, error: "Your access has been paused. Ask an Elder to restore it." };
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(members);
    const isFirstMember = (countRow?.count ?? 0) === 0;

    // The env bootstrap code is tracked as a normal access_codes row — and it
    // is retired the moment the House has anyone in it. It can only ever mint
    // the founding Elder, so a leaked/guessed env value is not a standing
    // master invite.
    if (isBootstrap) {
      if (!isFirstMember) {
        return { ok: false as const, error: BAD_CODE };
      }
      await tx
        .insert(accessCodes)
        .values({ code, label: "Bootstrap (env)", maxUses: 1 })
        .onConflictDoNothing({ target: accessCodes.code });
    }

    // Lock the invite row as well: an Elder's revoke uses the same row lock,
    // so revocation and redemption have one unambiguous commit order.
    const [codeRecord] = await tx.select().from(accessCodes)
      .where(eq(accessCodes.code, code)).for("update");
    if (!codeRecord || codeRecord.status !== "active") {
      return { ok: false as const, error: BAD_CODE };
    }
    if (codeRecord.maxUses != null && codeRecord.useCount >= codeRecord.maxUses) {
      return {
        ok: false as const,
        error: "That code has already been used. Ask for a fresh one.",
      };
    }
    if (codeRecord.expiresAt && new Date(codeRecord.expiresAt) < new Date()) {
      return {
        ok: false as const,
        error: "That code has expired. Ask for a fresh one.",
      };
    }

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
    const redeemed = await tx
      .update(accessCodes)
      .set({
        useCount: sql`${accessCodes.useCount} + 1`,
        usedBy: newMember.id,
        ...(willBeUsed ? { status: "used" as const } : {}),
      })
      .where(
        and(eq(accessCodes.id, codeRecord.id), eq(accessCodes.status, "active"))
      )
      .returning({ id: accessCodes.id });
    // The row lock makes this unreachable today. If locking ever regresses,
    // undo the new member rather than admit them without consuming the invite.
    if (redeemed.length === 0) throw new InviteNotRedeemed();

    return { ok: true as const, newMember };
  }).catch((error: unknown) => {
    if (error instanceof InviteNotRedeemed) {
      return { ok: false as const, error: "That code has already been used. Ask for a fresh one." };
    }
    throw error;
  });

  if (!result.ok) {
    recordFailedAttempt(attemptKey, CODE_ATTEMPT_WINDOW_MS);
    return { success: false, error: result.error };
  }

  clearRateLimit(attemptKey);
  return { success: true, data: { memberId: result.newMember.id } };
}
