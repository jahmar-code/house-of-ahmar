import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentEvents } from "@/lib/db/schema";
import { getWorkshopEnv } from "@/lib/workshop/env";
import { EVENT_RETENTION_DAYS } from "@/lib/workshop/constants";
import { ingestError, ingestOk } from "@/lib/workshop/ingest";

export const dynamic = "force-dynamic";

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** GET /api/agents/cron/prune — Vercel Cron: drop agent events past retention. Runs are kept. */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization"), getWorkshopEnv().cronSecret)) {
    return ingestError(401, "Unauthorized");
  }
  const cutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * 86_400_000);
  const removed = await db.delete(agentEvents).where(lt(agentEvents.createdAt, cutoff)).returning({ id: agentEvents.id });
  return ingestOk({ ok: true, removed: removed.length, cutoff: cutoff.toISOString() });
}
