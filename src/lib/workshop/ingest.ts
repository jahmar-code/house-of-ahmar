import { NextResponse } from "next/server";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import { agentEvents, agentRuns, agents, operators } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { INGEST_LIMITS } from "./constants";
import { hashAgentToken, readBearerToken } from "./tokens";

export type IngestAgent = Pick<
  typeof agents.$inferSelect,
  "id" | "desiredState" | "desiredStateAt" | "reportedStatus"
>;

const NO_STORE = { "Cache-Control": "no-store" };

export function ingestError(status: number, error: string, extra?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers: { ...NO_STORE, ...extra } });
}

export function ingestOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** The control payload every ingest response carries, so agents learn of pause/stop on any call. */
export function controlBody(agent: Pick<IngestAgent, "desiredState" | "desiredStateAt">) {
  return { desiredState: agent.desiredState, desiredStateAt: agent.desiredStateAt.toISOString() };
}

/**
 * Bearer-token authentication for agent ingest. The token is the whole
 * credential: no cookies, no Supabase session. Archived agents and agents
 * whose owner was deactivated are refused exactly like an unknown token, so a
 * response never confirms a token used to be valid.
 */
export async function authenticateAgent(
  request: Request
): Promise<{ agent: IngestAgent } | { response: NextResponse }> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return { response: ingestError(401, "Missing or malformed agent token") };

  const [agent] = await db
    .select({
      id: agents.id,
      desiredState: agents.desiredState,
      desiredStateAt: agents.desiredStateAt,
      reportedStatus: agents.reportedStatus,
    })
    .from(agents)
    .innerJoin(operators, eq(operators.id, agents.ownerId))
    .where(and(eq(agents.tokenHash, hashAgentToken(token)), isNull(agents.archivedAt), eq(operators.isActive, true)))
    .limit(1);
  if (!agent) return { response: ingestError(401, "Unknown agent token") };

  const limit = rateLimit(`agent-ingest:${agent.id}`, INGEST_LIMITS.requestsPerMinute, 60_000);
  if (!limit.allowed) {
    return {
      response: ingestError(429, "Too many requests from this agent", {
        "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
      }),
    };
  }
  return { agent };
}

/** Size-capped JSON body parse, validated against `schema`. */
export async function readIngestBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > INGEST_LIMITS.requestBytes) return { response: ingestError(413, "Request body too large") };

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { response: ingestError(400, "Could not read request body") };
  }
  if (Buffer.byteLength(text, "utf8") > INGEST_LIMITS.requestBytes) {
    return { response: ingestError(413, "Request body too large") };
  }

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    return { response: ingestError(400, "Body must be JSON") };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { response: ingestError(422, `${issue.path.join(".") || "body"}: ${issue.message}`) };
  }
  return { data: parsed.data };
}

/**
 * Database-enforced daily budget, so the cap holds across serverless
 * instances. Counts rows written in the last 24 hours (by insert time, so
 * backfilled timestamps cannot dodge it). Not transactional: concurrent
 * batches can overshoot by at most one batch each, which is acceptable here.
 */
export async function overDailyBudget(
  kind: "events" | "runs",
  agentId: string,
  adding: number
): Promise<NextResponse | null> {
  const since = new Date(Date.now() - 86_400_000);
  const [{ used }] =
    kind === "events"
      ? await db
          .select({ used: count() })
          .from(agentEvents)
          .where(and(eq(agentEvents.agentId, agentId), gte(agentEvents.createdAt, since)))
      : await db
          .select({ used: count() })
          .from(agentRuns)
          .where(and(eq(agentRuns.agentId, agentId), gte(agentRuns.createdAt, since)));
  const limit = kind === "events" ? INGEST_LIMITS.eventsPerDay : INGEST_LIMITS.runsPerDay;
  if (used + adding <= limit) return null;
  return ingestError(429, `Daily ${kind} budget of ${limit} reached for this agent; try again later`, {
    "Retry-After": "3600",
  });
}
