"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { memberRelationships, members } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { relationshipSchema } from "@/lib/validators";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/types";

/**
 * Returns true if `parentCandidateId` is already a descendant of `childId`.
 * Used to reject edges that would create a cycle in the directed parent→child graph.
 */
async function wouldCreateCycle(
  parentCandidateId: string,
  childId: string
): Promise<boolean> {
  if (parentCandidateId === childId) return true;

  const allEdges = await db.query.memberRelationships.findMany();
  // Build child -> [parents] map (we walk UP from the candidate parent
  // looking for the child — if we find it, this would close a cycle).
  const parentsOf = new Map<string, string[]>();
  for (const e of allEdges) {
    const arr = parentsOf.get(e.childId) ?? [];
    arr.push(e.parentId);
    parentsOf.set(e.childId, arr);
  }

  const visited = new Set<string>();
  const stack = [parentCandidateId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === childId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const p of parentsOf.get(id) ?? []) stack.push(p);
  }
  return false;
}

export async function addRelationship(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const parsed = relationshipSchema.safeParse({
    parentId: formData.get("parentId"),
    childId: formData.get("childId"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { parentId, childId } = parsed.data;

  // Both members must exist.
  const found = await db.query.members.findMany({
    where: inArray(members.id, [parentId, childId]),
  });
  if (found.length !== 2) {
    return { success: false, error: "Member not found" };
  }

  // Already exists?
  const existing = await db.query.memberRelationships.findFirst({
    where: and(
      eq(memberRelationships.parentId, parentId),
      eq(memberRelationships.childId, childId)
    ),
  });
  if (existing) {
    return { success: false, error: "That relationship already exists" };
  }

  // Cycle guard.
  if (await wouldCreateCycle(parentId, childId)) {
    return {
      success: false,
      error: "That would create a cycle in the family tree",
    };
  }

  await db.insert(memberRelationships).values({
    parentId,
    childId,
    createdBy: ctx.memberId,
  });

  const parent = found.find((m) => m.id === parentId)!;
  const child = found.find((m) => m.id === childId)!;
  await logAudit({
    actorId: ctx.memberId,
    action: "relationship.added",
    entityType: "member",
    entityId: childId,
    metadata: {
      parentName: parent.displayName,
      childName: child.displayName,
    },
  });

  revalidatePath("/family");
  revalidatePath(`/members/${parentId}`);
  revalidatePath(`/members/${childId}`);
  return { success: true };
}

export async function removeRelationship(
  parentId: string,
  childId: string
): Promise<ActionResult> {
  const ctx = await requireRole("elder");

  const target = await db.query.memberRelationships.findFirst({
    where: and(
      eq(memberRelationships.parentId, parentId),
      eq(memberRelationships.childId, childId)
    ),
  });
  if (!target) {
    return { success: false, error: "Relationship not found" };
  }

  const [parent, child] = await Promise.all([
    db.query.members.findFirst({ where: eq(members.id, parentId) }),
    db.query.members.findFirst({ where: eq(members.id, childId) }),
  ]);

  await db
    .delete(memberRelationships)
    .where(eq(memberRelationships.id, target.id));

  await logAudit({
    actorId: ctx.memberId,
    action: "relationship.removed",
    entityType: "member",
    entityId: childId,
    metadata: {
      parentName: parent?.displayName ?? null,
      childName: child?.displayName ?? null,
    },
  });

  revalidatePath("/family");
  revalidatePath(`/members/${parentId}`);
  revalidatePath(`/members/${childId}`);
  return { success: true };
}
