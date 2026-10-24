"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { agentEvents, agents, agentShares, operators } from "@/lib/db/schema";
import { loadVisibleAgent, requireOperator, requireWorkshopAdmin } from "@/lib/workshop/access";
import { issueAgentToken } from "@/lib/workshop/tokens";
import { agentFormSchema, desiredStateSchema, operatorFormSchema } from "@/lib/workshop/validators";
import type { ActionResult } from "@/types";

const uuid = z.string().uuid();

const CONTROL_LABEL = { run: "Resume", pause: "Pause", stop: "Stop" } as const;

function revalidateAgent(agentId?: string) {
  revalidatePath("/workshop");
  if (agentId) revalidatePath(`/workshop/agents/${agentId}`);
}

/** Owner-only load. Anyone else (including a share recipient) gets "not found". */
async function loadOwnedAgent(operatorId: string, agentId: unknown) {
  if (!uuid.safeParse(agentId).success) return null;
  const access = await loadVisibleAgent(operatorId, agentId as string);
  return access?.isOwner ? access.agent : null;
}

export async function createAgent(
  formData: FormData
): Promise<ActionResult<{ id: string; token: string }>> {
  const ctx = await requireOperator();
  const parsed = agentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const issued = issueAgentToken();
  const [agent] = await db
    .insert(agents)
    .values({
      ownerId: ctx.operatorId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tokenHash: issued.hash,
      tokenHint: issued.hint,
    })
    .returning({ id: agents.id });

  revalidateAgent();
  return { success: true, data: { id: agent.id, token: issued.token } };
}

export async function updateAgent(agentId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOperator();
  const agent = await loadOwnedAgent(ctx.operatorId, agentId);
  if (!agent) return { success: false, error: "This agent is no longer available" };

  const parsed = agentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await db
    .update(agents)
    .set({ name: parsed.data.name, description: parsed.data.description ?? null })
    .where(and(eq(agents.id, agent.id), isNull(agents.archivedAt)));
  revalidateAgent(agent.id);
  return { success: true };
}

/** Issues a fresh token; the old one stops working immediately. */
export async function rotateAgentToken(agentId: string): Promise<ActionResult<{ token: string }>> {
  const ctx = await requireOperator();
  const agent = await loadOwnedAgent(ctx.operatorId, agentId);
  if (!agent) return { success: false, error: "This agent is no longer available" };

  const issued = issueAgentToken();
  await db
    .update(agents)
    .set({ tokenHash: issued.hash, tokenHint: issued.hint, tokenRotatedAt: new Date() })
    .where(eq(agents.id, agent.id));
  await db.insert(agentEvents).values({
    agentId: agent.id,
    level: "warn",
    message: "Token rotated. The previous token no longer works.",
    actorId: ctx.operatorId,
  });
  revalidateAgent(agent.id);
  return { success: true, data: { token: issued.token } };
}

export async function setDesiredState(agentId: string, state: string): Promise<ActionResult> {
  const ctx = await requireOperator();
  const parsedState = desiredStateSchema.safeParse(state);
  if (!parsedState.success) return { success: false, error: "Unknown control action" };
  const agent = await loadOwnedAgent(ctx.operatorId, agentId);
  if (!agent) return { success: false, error: "Only the agent's owner can control it" };
  if (agent.desiredState === parsedState.data) return { success: true };

  await db
    .update(agents)
    .set({ desiredState: parsedState.data, desiredStateAt: new Date() })
    .where(eq(agents.id, agent.id));
  await db.insert(agentEvents).values({
    agentId: agent.id,
    level: parsedState.data === "stop" ? "warn" : "info",
    message: `${CONTROL_LABEL[parsedState.data]} requested`,
    actorId: ctx.operatorId,
  });
  revalidateAgent(agent.id);
  return { success: true };
}

export async function setAgentShare(agentId: string, operatorId: string, shared: boolean): Promise<ActionResult> {
  const ctx = await requireOperator();
  if (!uuid.safeParse(operatorId).success) return { success: false, error: "Unknown operator" };
  if (operatorId === ctx.operatorId) return { success: false, error: "You already own this agent" };
  const agent = await loadOwnedAgent(ctx.operatorId, agentId);
  if (!agent) return { success: false, error: "Only the agent's owner can change sharing" };

  if (shared) {
    const target = await db.query.operators.findFirst({
      where: and(eq(operators.id, operatorId), eq(operators.isActive, true)),
    });
    if (!target) return { success: false, error: "That operator is no longer active" };
    await db.insert(agentShares).values({ agentId: agent.id, operatorId }).onConflictDoNothing();
  } else {
    await db
      .delete(agentShares)
      .where(and(eq(agentShares.agentId, agent.id), eq(agentShares.operatorId, operatorId)));
  }
  revalidateAgent(agent.id);
  return { success: true };
}

/** Soft delete: history stays in the database, the token stops working, and the agent leaves every list. */
export async function archiveAgent(agentId: string): Promise<ActionResult> {
  const ctx = await requireOperator();
  const agent = await loadOwnedAgent(ctx.operatorId, agentId);
  if (!agent) return { success: false, error: "This agent is no longer available" };
  await db
    .update(agents)
    .set({ archivedAt: new Date() })
    .where(and(eq(agents.id, agent.id), isNull(agents.archivedAt)));
  revalidateAgent(agent.id);
  return { success: true };
}

// ─── Operators (admin) ───

export async function addOperator(formData: FormData): Promise<ActionResult> {
  const ctx = await requireWorkshopAdmin();
  const parsed = operatorFormSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const [created] = await db
    .insert(operators)
    .values({ ...parsed.data, invitedBy: ctx.operatorId })
    .onConflictDoNothing()
    .returning({ id: operators.id });
  if (!created) return { success: false, error: "That email is already on the operator list" };

  revalidatePath("/workshop/operators");
  return { success: true };
}

export async function setOperatorActive(operatorId: string, active: boolean): Promise<ActionResult> {
  const ctx = await requireWorkshopAdmin();
  if (!uuid.safeParse(operatorId).success) return { success: false, error: "Unknown operator" };
  if (operatorId === ctx.operatorId && !active) {
    return { success: false, error: "You can't deactivate yourself" };
  }

  // Serialise admin changes so two concurrent deactivations cannot remove the
  // last active admin between them.
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`lock table public.operators in share row exclusive mode`);
    const target = await tx.query.operators.findFirst({ where: eq(operators.id, operatorId) });
    if (!target) return "Unknown operator";
    if (!active && target.role === "admin" && target.isActive) {
      const [{ value }] = await tx
        .select({ value: count() })
        .from(operators)
        .where(and(eq(operators.role, "admin"), eq(operators.isActive, true), ne(operators.id, operatorId)));
      if (value === 0) return "The Workshop needs at least one active admin";
    }
    await tx.update(operators).set({ isActive: active }).where(eq(operators.id, operatorId));
    return null;
  });
  if (result) return { success: false, error: result };

  revalidatePath("/workshop/operators");
  revalidateAgent();
  return { success: true };
}
