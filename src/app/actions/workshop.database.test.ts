import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql as statement } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

// Opt-in, rollback-only regression against local Supabase PostgreSQL. Real
// ingest routes, server actions, access rules and read models run on the
// fixture transaction; only the Supabase session, env and cache are stubbed.
const state = vi.hoisted(() => ({
  db: null as unknown,
  user: null as null | { id: string; email: string; email_confirmed_at: string },
  adminEmails: "",
}));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/workshop/env", async (original) => {
  const actual = await original<typeof import("@/lib/workshop/env")>();
  return { ...actual, getWorkshopEnv: () => ({ adminEmails: actual.parseAdminEmails(state.adminEmails) }) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

function ingest(path: string, token: string, body?: unknown) {
  return new Request(`http://127.0.0.1/api/agents/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(process.env.HOA_DATABASE_TESTS !== "1")("Workshop against PostgreSQL", () => {
  it("provisions operators, ingests, shares, controls and revokes agents", async () => {
    const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname) || new URL(url).port !== "55322") {
      throw new Error("Refusing regression fixtures outside local Supabase");
    }
    const client = postgres(url, { max: 1, prepare: false });
    const db = drizzle(client, { schema });
    const rollback = new Error("FIXTURE_ROLLBACK");
    try {
      try { await db.transaction(async (tx) => {
        state.db = tx;
        const founder = { id: randomUUID(), email: `founder-${randomUUID()}@workshop.test`, email_confirmed_at: new Date().toISOString() };
        const partner = { id: randomUUID(), email: `partner-${randomUUID()}@workshop.test`, email_confirmed_at: new Date().toISOString() };
        const stranger = { id: randomUUID(), email: `stranger-${randomUUID()}@workshop.test`, email_confirmed_at: new Date().toISOString() };
        state.adminEmails = ` ${founder.email.toUpperCase()} , not-an-email`;

        const { getOperatorContext, loadVisibleAgent } = await import("@/lib/workshop/access");
        const actions = await import("./workshop");
        const { listVisibleAgents, getAgentEvents, getAgentRuns } = await import("@/lib/workshop/queries");
        const heartbeat = (await import("@/app/api/agents/v1/heartbeat/route")).POST;
        const runs = (await import("@/app/api/agents/v1/runs/route")).POST;
        const events = (await import("@/app/api/agents/v1/events/route")).POST;
        const control = (await import("@/app/api/agents/v1/control/route")).GET;

        // Access: env admin is provisioned; unlisted and unconfirmed users are not.
        state.user = founder;
        const founderCtx = await getOperatorContext();
        expect(founderCtx?.role).toBe("admin");
        state.user = stranger;
        expect(await getOperatorContext()).toBeNull();
        state.user = { ...partner, email_confirmed_at: "" as string };
        expect(await getOperatorContext()).toBeNull();

        // An admin adds the partner; the partner's confirmed sign-in binds the row.
        state.user = founder;
        const form = new FormData();
        form.set("email", partner.email.toUpperCase());
        form.set("displayName", "Partner");
        expect(await actions.addOperator(form)).toEqual({ success: true });
        expect((await actions.addOperator(form)).success).toBe(false);
        state.user = partner;
        const partnerCtx = await getOperatorContext();
        expect(partnerCtx?.role).toBe("operator");
        await expect(actions.addOperator(form)).rejects.toThrow("Insufficient permissions");

        // Founder registers an agent and the agent reports in.
        state.user = founder;
        const agentForm = new FormData();
        agentForm.set("name", "Lead triage");
        const created = await actions.createAgent(agentForm);
        if (!created.success || !created.data) throw new Error("createAgent failed");
        const { id: agentId, token } = created.data;

        expect((await heartbeat(ingest("heartbeat", "hoa_agent_" + "x".repeat(43), { status: "running" }))).status).toBe(401);
        expect((await heartbeat(ingest("heartbeat", token, { status: "exploded" }))).status).toBe(422);
        const hb = await heartbeat(ingest("heartbeat", token, { status: "running", message: "Online", version: "1.0.0", intervalSec: 15 }));
        expect(hb.status).toBe(200);
        expect(await hb.json()).toMatchObject({ ok: true, desiredState: "run" });

        // Privacy: the partner cannot see an unshared agent, and no admin bypass exists.
        state.user = partner;
        expect(await loadVisibleAgent(partnerCtx!.operatorId, agentId)).toBeNull();
        expect(await listVisibleAgents(partnerCtx!.operatorId)).toEqual([]);

        // Share: the partner watches but cannot control or re-share.
        state.user = founder;
        expect(await actions.setAgentShare(agentId, partnerCtx!.operatorId, true)).toEqual({ success: true });
        state.user = partner;
        const partnerView = await listVisibleAgents(partnerCtx!.operatorId);
        expect(partnerView).toHaveLength(1);
        expect(partnerView[0]).toMatchObject({ isOwner: false, ownerName: expect.any(String), health: "running" });
        expect((await actions.setDesiredState(agentId, "stop")).success).toBe(false);
        expect((await actions.setAgentShare(agentId, partnerCtx!.operatorId, false)).success).toBe(false);
        expect((await actions.rotateAgentToken(agentId)).success).toBe(false);

        // Control: the owner pauses; every ingest response carries it.
        state.user = founder;
        expect(await actions.setDesiredState(agentId, "pause")).toEqual({ success: true });
        expect(await (await control(ingest("control", token))).json()).toMatchObject({ desiredState: "pause" });

        // Runs are idempotent and never reopened once finished.
        expect((await runs(ingest("runs", token, { runId: "job-1", status: "running" }))).status).toBe(200);
        expect((await runs(ingest("runs", token, { runId: "job-1", status: "succeeded", summary: "Done", metrics: { leads: 3 } }))).status).toBe(200);
        expect((await runs(ingest("runs", token, { runId: "job-1", status: "running" }))).status).toBe(200);
        const [run] = await getAgentRuns(agentId);
        expect(run).toMatchObject({ externalId: "job-1", status: "succeeded", summary: "Done", metrics: { leads: 3 } });
        expect(run.endedAt).toBeInstanceOf(Date);

        // Events link to runs by the agent's id; unknown run ids are kept unlinked.
        const ev = await events(ingest("events", token, {
          events: [{ level: "warn", message: "Slow upstream", runId: "job-1" }, { message: "Orphan", runId: "nope" }],
        }));
        expect(ev.status).toBe(202);
        const log = await getAgentEvents(agentId);
        expect(log.find((e) => e.message === "Slow upstream")?.runExternalId).toBe("job-1");
        expect(log.find((e) => e.message === "Orphan")?.runExternalId).toBeNull();
        expect(log.find((e) => e.message === "Pause requested")?.actorName).toBe(founderCtx!.displayName);
        expect(log.some((e) => e.message.startsWith("Status unknown → running"))).toBe(true);

        // The daily event budget is enforced in Postgres; heartbeats still land when it is spent.
        await tx.execute(statement`insert into public.agent_events(agent_id, message)
          select ${agentId}::uuid, 'budget filler' from generate_series(1, 9990)`);
        const over = await events(ingest("events", token, { events: Array.from({ length: 50 }, () => ({ message: "x" })) }));
        expect(over.status).toBe(429);
        expect(over.headers.get("retry-after")).toBe("3600");
        expect((await heartbeat(ingest("heartbeat", token, { status: "error", message: "flap" }))).status).toBe(200);
        await tx.execute(statement`delete from public.agent_events where message = 'budget filler'`);

        // Rotation cuts the old token off immediately.
        const rotated = await actions.rotateAgentToken(agentId);
        if (!rotated.success || !rotated.data) throw new Error("rotate failed");
        expect((await control(ingest("control", token))).status).toBe(401);
        expect((await control(ingest("control", rotated.data.token))).status).toBe(200);

        // The last active admin cannot be removed; deactivating an owner revokes their agents.
        expect((await actions.setOperatorActive(founderCtx!.operatorId, false)).success).toBe(false);
        await tx.update(schema.operators).set({ isActive: false }).where(eq(schema.operators.id, founderCtx!.operatorId));
        expect((await control(ingest("control", rotated.data.token))).status).toBe(401);
        expect(await listVisibleAgents(partnerCtx!.operatorId)).toEqual([]);
        state.user = founder;
        expect(await getOperatorContext()).toBeNull(); // not re-provisioned from the env list
        await tx.update(schema.operators).set({ isActive: true }).where(eq(schema.operators.id, founderCtx!.operatorId));

        // Archive is a soft delete that also rejects the token.
        expect(await actions.archiveAgent(agentId)).toEqual({ success: true });
        expect((await control(ingest("control", rotated.data.token))).status).toBe(401);
        const [{ n }] = await tx.execute<{ n: number }>(statement`select count(*)::int as n from public.agent_events where agent_id = ${agentId}::uuid`);
        expect(n).toBeGreaterThan(0);

        throw rollback;
      }); } catch (error) {
        if (error !== rollback) throw error;
      }
    } finally {
      state.db = null;
      await client.end();
    }
  });
});
