import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentEvents, agentRuns } from "@/lib/db/schema";
import { eventBatchSchema } from "@/lib/workshop/validators";
import { authenticateAgent, controlBody, ingestOk, overDailyBudget, readIngestBody } from "@/lib/workshop/ingest";

export const dynamic = "force-dynamic";

/** POST /api/agents/v1/events — append up to 100 log lines. Unknown runIds are kept as unlinked events. */
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("response" in auth) return auth.response;
  const body = await readIngestBody(request, eventBatchSchema);
  if ("response" in body) return body.response;

  const { agent } = auth;
  const { events } = body.data;
  const overBudget = await overDailyBudget("events", agent.id, events.length);
  if (overBudget) return overBudget;
  const externalIds = [...new Set(events.flatMap((e) => (e.runId ? [e.runId] : [])))];
  const runIds = new Map<string, string>();
  if (externalIds.length) {
    const rows = await db
      .select({ id: agentRuns.id, externalId: agentRuns.externalId })
      .from(agentRuns)
      .where(and(eq(agentRuns.agentId, agent.id), inArray(agentRuns.externalId, externalIds)));
    rows.forEach((r) => runIds.set(r.externalId, r.id));
  }

  const now = new Date();
  await db.insert(agentEvents).values(
    events.map((e) => ({
      agentId: agent.id,
      runId: e.runId ? (runIds.get(e.runId) ?? null) : null,
      level: e.level,
      message: e.message,
      data: e.data ?? null,
      occurredAt: e.at ?? now,
    }))
  );

  return ingestOk({ ok: true, accepted: events.length, ...controlBody(agent) }, 202);
}
