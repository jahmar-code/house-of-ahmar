import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentEvents, agentRuns, agents, agentShares, operators } from "@/lib/db/schema";
import { visibleTo } from "./access";
import type { EventLevel } from "./constants";
import { computeHealth, pendingControl, type Health } from "./status";

// Read models for the Workshop pages. Every function takes the caller's
// operator id and applies `visibleTo` itself; none returns token hashes.

export type AgentSummary = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  isOwner: boolean;
  health: Health;
  pending: ReturnType<typeof pendingControl>;
  desiredState: string;
  statusMessage: string | null;
  lastHeartbeatAt: Date | null;
  version: string | null;
  host: string | null;
  shareCount: number;
  errors24h: number;
  latestRun: { status: string; summary: string | null; startedAt: Date } | null;
};

const summaryColumns = {
  id: agents.id,
  name: agents.name,
  description: agents.description,
  ownerId: agents.ownerId,
  ownerName: operators.displayName,
  desiredState: agents.desiredState,
  reportedStatus: agents.reportedStatus,
  statusMessage: agents.statusMessage,
  lastHeartbeatAt: agents.lastHeartbeatAt,
  heartbeatIntervalSec: agents.heartbeatIntervalSec,
  version: agents.version,
  host: agents.host,
};

export async function listVisibleAgents(operatorId: string, now = new Date()): Promise<AgentSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(agents)
    .innerJoin(operators, eq(operators.id, agents.ownerId))
    .where(visibleTo(operatorId))
    .orderBy(agents.name);
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const since = new Date(now.getTime() - 86_400_000);
  const [shareCounts, errorCounts, latestRuns] = await Promise.all([
    db
      .select({ agentId: agentShares.agentId, n: sql<number>`count(*)::int` })
      .from(agentShares)
      .where(inArray(agentShares.agentId, ids))
      .groupBy(agentShares.agentId),
    db
      .select({ agentId: agentEvents.agentId, n: sql<number>`count(*)::int` })
      .from(agentEvents)
      .where(and(inArray(agentEvents.agentId, ids), eq(agentEvents.level, "error"), gte(agentEvents.occurredAt, since)))
      .groupBy(agentEvents.agentId),
    db
      .selectDistinctOn([agentRuns.agentId], {
        agentId: agentRuns.agentId,
        status: agentRuns.status,
        summary: agentRuns.summary,
        startedAt: agentRuns.startedAt,
      })
      .from(agentRuns)
      .where(inArray(agentRuns.agentId, ids))
      .orderBy(agentRuns.agentId, desc(agentRuns.startedAt)),
  ]);
  const shares = new Map(shareCounts.map((r) => [r.agentId, r.n]));
  const errors = new Map(errorCounts.map((r) => [r.agentId, r.n]));
  const runs = new Map(latestRuns.map((r) => [r.agentId, r]));

  return rows.map((row) => {
    const health = computeHealth(row, now);
    const run = runs.get(row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      isOwner: row.ownerId === operatorId,
      health,
      pending: pendingControl(row, health),
      desiredState: row.desiredState,
      statusMessage: row.statusMessage,
      lastHeartbeatAt: row.lastHeartbeatAt,
      version: row.version,
      host: row.host,
      shareCount: shares.get(row.id) ?? 0,
      errors24h: errors.get(row.id) ?? 0,
      latestRun: run ? { status: run.status, summary: run.summary, startedAt: run.startedAt } : null,
    };
  });
}

export async function getAgentRuns(agentId: string, limit = 15) {
  return db
    .select({
      id: agentRuns.id,
      externalId: agentRuns.externalId,
      status: agentRuns.status,
      summary: agentRuns.summary,
      metrics: agentRuns.metrics,
      startedAt: agentRuns.startedAt,
      endedAt: agentRuns.endedAt,
    })
    .from(agentRuns)
    .where(eq(agentRuns.agentId, agentId))
    .orderBy(desc(agentRuns.startedAt))
    .limit(limit);
}

export async function getAgentEvents(agentId: string, level?: EventLevel, limit = 100) {
  return db
    .select({
      id: agentEvents.id,
      level: agentEvents.level,
      message: agentEvents.message,
      data: agentEvents.data,
      occurredAt: agentEvents.occurredAt,
      runExternalId: agentRuns.externalId,
      actorName: operators.displayName,
    })
    .from(agentEvents)
    .leftJoin(agentRuns, eq(agentRuns.id, agentEvents.runId))
    .leftJoin(operators, eq(operators.id, agentEvents.actorId))
    .where(and(eq(agentEvents.agentId, agentId), level ? eq(agentEvents.level, level) : undefined))
    .orderBy(desc(agentEvents.occurredAt))
    .limit(limit);
}

export async function getAgentStats(agentId: string, now = new Date()) {
  const since = new Date(now.getTime() - 86_400_000);
  const [runs] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${agentRuns.status} = 'failed')::int`,
      running: sql<number>`count(*) filter (where ${agentRuns.status} = 'running')::int`,
    })
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, agentId), gte(agentRuns.startedAt, since)));
  const [events] = await db
    .select({ errors: sql<number>`count(*) filter (where ${agentEvents.level} = 'error')::int` })
    .from(agentEvents)
    .where(and(eq(agentEvents.agentId, agentId), gte(agentEvents.occurredAt, since)));
  return { runs24h: runs.total, failed24h: runs.failed, runningNow: runs.running, errors24h: events.errors };
}

/**
 * Every other active operator, flagged with whether this agent is shared with
 * them. Owner-only surface. Display names only: owning an agent must not turn
 * into a directory of everyone's email.
 */
export async function getShareTargets(agentId: string, ownerId: string) {
  const rows = await db
    .select({
      id: operators.id,
      displayName: operators.displayName,
      sharedAt: agentShares.createdAt,
    })
    .from(operators)
    .leftJoin(agentShares, and(eq(agentShares.operatorId, operators.id), eq(agentShares.agentId, agentId)))
    .where(and(eq(operators.isActive, true), sql`${operators.id} <> ${ownerId}`))
    .orderBy(operators.displayName);
  return rows.map((r) => ({ id: r.id, displayName: r.displayName, shared: r.sharedAt !== null }));
}

export async function listOperators() {
  return db
    .select({
      id: operators.id,
      email: operators.email,
      displayName: operators.displayName,
      role: operators.role,
      isActive: operators.isActive,
      joined: sql<boolean>`${operators.authUserId} is not null`,
      createdAt: operators.createdAt,
    })
    .from(operators)
    .orderBy(desc(operators.isActive), operators.displayName);
}
