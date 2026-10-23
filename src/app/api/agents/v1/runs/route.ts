import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentRuns } from "@/lib/db/schema";
import { TERMINAL_RUN_STATUSES } from "@/lib/workshop/constants";
import { runSchema } from "@/lib/workshop/validators";
import { authenticateAgent, controlBody, ingestOk, overDailyBudget, readIngestBody } from "@/lib/workshop/ingest";

export const dynamic = "force-dynamic";

/**
 * POST /api/agents/v1/runs — start or update one run, keyed by the agent's own
 * `runId`. Idempotent: resending the same body is harmless. A finished run is
 * never reopened, so a late "running" retry cannot undo "succeeded".
 */
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("response" in auth) return auth.response;
  const body = await readIngestBody(request, runSchema);
  if ("response" in body) return body.response;

  const run = body.data;
  // Only a new run spends budget; updating an existing one is always allowed.
  const [existing] = await db
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, auth.agent.id), eq(agentRuns.externalId, run.runId)))
    .limit(1);
  if (!existing) {
    const overBudget = await overDailyBudget("runs", auth.agent.id, 1);
    if (overBudget) return overBudget;
  }
  const now = new Date();
  const terminal = TERMINAL_RUN_STATUSES.includes(run.status);
  const endedAt = terminal ? (run.endedAt ?? now) : null;

  const [row] = await db
    .insert(agentRuns)
    .values({
      agentId: auth.agent.id,
      externalId: run.runId,
      status: run.status,
      summary: run.summary ?? null,
      metrics: run.metrics ?? null,
      startedAt: run.startedAt ?? now,
      endedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [agentRuns.agentId, agentRuns.externalId],
      set: {
        status: sql`case when ${agentRuns.endedAt} is null then excluded.status else ${agentRuns.status} end`,
        summary: sql`coalesce(excluded.summary, ${agentRuns.summary})`,
        metrics: sql`coalesce(excluded.metrics, ${agentRuns.metrics})`,
        endedAt: sql`coalesce(${agentRuns.endedAt}, excluded.ended_at)`,
        updatedAt: now,
      },
    })
    .returning({ id: agentRuns.id, status: agentRuns.status, endedAt: agentRuns.endedAt });

  return ingestOk({ ok: true, run: { id: row.id, runId: run.runId, status: row.status }, ...controlBody(auth.agent) });
}
