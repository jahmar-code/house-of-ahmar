import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { HoaRole } from "@/lib/constants";
import { ROLE_HIERARCHY } from "@/lib/constants";

export type AuthContext = {
  userId: string;
  memberId: string;
  displayName: string;
  role: HoaRole;
  avatarUrl: string | null;
};

export const getAuthContext = cache(
  async (): Promise<AuthContext | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const member = await db.query.members.findFirst({
      where: and(
        eq(members.authUserId, user.id),
        eq(members.isActive, true)
      ),
    });
    if (!member) return null;

    return {
      userId: user.id,
      memberId: member.id,
      displayName: member.displayName,
      role: member.role,
      avatarUrl: member.avatarUrl,
    };
  }
);

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

export async function requireRole(minimumRole: HoaRole): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (ROLE_HIERARCHY[ctx.role] < ROLE_HIERARCHY[minimumRole]) {
    throw new Error("Insufficient permissions");
  }
  return ctx;
}

/** Pages must guard their own reads; a cached parent layout is not a boundary. */
export async function requirePageAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/initiation");
  return ctx;
}
