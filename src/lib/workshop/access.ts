import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, exists, isNull, or, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { agents, agentShares, operators } from "@/lib/db/schema";
import { getWorkshopEnv } from "./env";
import type { OperatorRole } from "./constants";

export type OperatorContext = {
  userId: string;
  operatorId: string;
  displayName: string;
  email: string;
  role: OperatorRole;
};

type Operator = typeof operators.$inferSelect;

function toContext(userId: string, op: Operator): OperatorContext {
  return {
    userId,
    operatorId: op.id,
    displayName: op.displayName,
    email: op.email,
    role: op.role as OperatorRole,
  };
}

/**
 * The signed-in Supabase user as a Workshop operator, or null.
 *
 * House membership is irrelevant here in both directions: an Elder is not an
 * operator by default, and an operator never becomes a member. Resolution:
 *   1. an operator row already bound to this auth user (must be active);
 *   2. an unbound, active row added by an admin for this *confirmed* email,
 *      bound now so later email changes cannot move it;
 *   3. a confirmed email listed in HOA_WORKSHOP_ADMIN_EMAILS, provisioned as admin.
 * A deactivated row is never re-provisioned from the env list.
 */
export const getOperatorContext = cache(async (): Promise<OperatorContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const bound = await db.query.operators.findFirst({ where: eq(operators.authUserId, user.id) });
  if (bound) return bound.isActive ? toContext(user.id, bound) : null;

  const email = user.email?.trim().toLowerCase();
  // An unconfirmed address proves nothing about who is signing in.
  if (!email || !user.email_confirmed_at) return null;

  const [claimed] = await db
    .update(operators)
    .set({ authUserId: user.id, lastSeenAt: new Date() })
    .where(and(eq(operators.email, email), isNull(operators.authUserId), eq(operators.isActive, true)))
    .returning();
  if (claimed) return toContext(user.id, claimed);

  if (!getWorkshopEnv().adminEmails.has(email)) return null;

  const existing = await db.query.operators.findFirst({ where: eq(operators.email, email) });
  // Present but inactive, or bound to a different auth user: refuse.
  if (existing) return null;

  await db
    .insert(operators)
    .values({ authUserId: user.id, email, displayName: email.split("@")[0], role: "admin", lastSeenAt: new Date() })
    .onConflictDoNothing();
  const provisioned = await db.query.operators.findFirst({ where: eq(operators.authUserId, user.id) });
  return provisioned?.isActive ? toContext(user.id, provisioned) : null;
});

export async function requireOperator(): Promise<OperatorContext> {
  const ctx = await getOperatorContext();
  if (!ctx) throw new Error("Unauthorized");
  return ctx;
}

export async function requireWorkshopAdmin(): Promise<OperatorContext> {
  const ctx = await requireOperator();
  if (ctx.role !== "admin") throw new Error("Insufficient permissions");
  return ctx;
}

/** Pages guard their own reads; the console layout is not a boundary. */
export async function requirePageOperator(): Promise<OperatorContext> {
  const ctx = await getOperatorContext();
  if (ctx) return ctx;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/workshop/no-access" : "/workshop/sign-in");
}

/**
 * SQL predicate: agents this operator may see. Owners see their own; anyone
 * else needs an explicit share. Admin is an operator-management role and does
 * NOT grant sight of other people's private agents.
 */
export function visibleTo(operatorId: string) {
  return and(
    isNull(agents.archivedAt),
    or(
      eq(agents.ownerId, operatorId),
      exists(
        db
          .select({ one: sql`1` })
          .from(agentShares)
          .where(and(eq(agentShares.agentId, agents.id), eq(agentShares.operatorId, operatorId)))
      )
    ),
    // An agent whose owner was deactivated disappears with them.
    exists(
      db
        .select({ one: sql`1` })
        .from(operators)
        .where(and(eq(operators.id, agents.ownerId), eq(operators.isActive, true)))
    )
  );
}

export type AgentAccess = { agent: typeof agents.$inferSelect; isOwner: boolean };

/** Loads one agent if this operator may see it. Null is "not found" to the caller. */
export async function loadVisibleAgent(operatorId: string, agentId: string): Promise<AgentAccess | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), visibleTo(operatorId)))
    .limit(1);
  if (!agent) return null;
  return { agent, isOwner: agent.ownerId === operatorId };
}
