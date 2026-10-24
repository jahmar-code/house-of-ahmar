import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentEvents, agents } from "@/lib/db/schema";
import { heartbeatSchema } from "@/lib/workshop/validators";
import { authenticateAgent, controlBody, ingestOk, overDailyBudget, readIngestBody } from "@/lib/workshop/ingest";

export const dynamic = "force-dynamic";

/** POST /api/agents/v1/heartbeat — "I am alive, this is what I'm doing." Returns the control state. */
export async function POST(request: Request) {
  const auth = await authenticateAgent(request);
  if ("response" in auth) return auth.response;
  const body = await readIngestBody(request, heartbeatSchema);
  if ("response" in body) return body.response;

  const { agent } = auth;
  const hb = body.data;
  const now = new Date();

  await db
    .update(agents)
    .set({
      reportedStatus: hb.status,
      statusMessage: hb.message ?? null,
      lastHeartbeatAt: now,
      ...(hb.version !== undefined && { version: hb.version }),
      ...(hb.host !== undefined && { host: hb.host }),
      ...(hb.intervalSec !== undefined && { heartbeatIntervalSec: hb.intervalSec }),
      ...(hb.metadata !== undefined && { metadata: hb.metadata }),
    })
    .where(eq(agents.id, agent.id));

  // A status change is the most useful line in the activity log, so record it
  // even when the agent sends no events of its own. It spends the same daily
  // budget, so a flapping agent cannot grow the log without bound; over budget,
  // the heartbeat still lands and only the log line is skipped.
  if (agent.reportedStatus !== hb.status && !(await overDailyBudget("events", agent.id, 1))) {
    await db.insert(agentEvents).values({
      agentId: agent.id,
      level: hb.status === "error" ? "error" : "info",
      message: `Status ${agent.reportedStatus ?? "unknown"} → ${hb.status}${hb.message ? `: ${hb.message}` : ""}`,
      occurredAt: now,
    });
  }

  return ingestOk({ ok: true, ...controlBody(agent) });
}
