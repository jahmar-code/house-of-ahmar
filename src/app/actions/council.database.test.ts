import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as statement } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { compareMessages, timestampMicros } from "@/lib/message-order";

// Opt-in, rollback-only regression against real local PostgreSQL. It calls the
// real action with Drizzle on the fixture transaction; only auth/cache are stubbed.
const state = vi.hoisted(() => ({
  db: null as unknown,
  memberId: "",
}));
vi.mock("@/lib/db", () => ({ get db() { return state.db; } }));
vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ memberId: state.memberId, role: "member" }),
  requireRole: async () => ({ memberId: state.memberId, role: "member" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

describe.skipIf(process.env.HOA_DATABASE_TESTS !== "1")("Council history against PostgreSQL", () => {
  it("preserves microsecond timestamps and deterministic id ties at the cursor", async () => {
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
        const user = randomUUID(); state.memberId = randomUUID();
        const channel = randomUUID();
        await tx.execute(statement`insert into auth.users(id,aud,role,email) values (${user}::uuid,'authenticated','authenticated',${`${user}@cursor.test`})`);
        await tx.insert(schema.members).values({ id: state.memberId, authUserId: user, displayName: "Cursor fixture" });
        await tx.insert(schema.channels).values({ id: channel, name: "Cursor fixture", slug: channel });
        const older = "11111111-1111-4111-8111-111111111110";
        const sameInstant = "11111111-1111-4111-8111-111111111111";
        const cursor = "11111111-1111-4111-8111-111111111112";
        const newer = "11111111-1111-4111-8111-111111111113";
        for (const [id, timestamp] of [
          [older, "2026-10-03T12:00:00.123100Z"],
          [sameInstant, "2026-10-03T12:00:00.123900Z"],
          [cursor, "2026-10-03T12:00:00.123900Z"],
          [newer, "2026-10-03T12:00:00.123950Z"],
        ]) {
          await tx.execute(statement`insert into public.messages(id,channel_id,author_id,content,created_at)
            values (${id}::uuid,${channel}::uuid,${state.memberId}::uuid,'Fixture',${timestamp}::timestamptz)`);
        }
        const { loadOlderMessages } = await import("./council");
        const result = await loadOlderMessages(channel, cursor);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data?.messages.map((message) => message.id)).toEqual([older, sameInstant]);
          expect(result.data?.messages[0].createdAtMicros).toBe(timestampMicros("2026-10-03T12:00:00.123100Z"));
          expect(result.data?.messages[1].createdAtMicros).toBe(timestampMicros("2026-10-03T12:00:00.123900Z"));
          expect(result.data?.messages.slice().reverse().sort(compareMessages).map((message) => message.id)).toEqual([older, sameInstant]);
          expect(result.data?.hasMore).toBe(false);
          const next = await loadOlderMessages(channel, sameInstant);
          expect(next.success && next.data?.messages.map((message) => message.id)).toEqual([older]);
        }
        throw rollback;
      }); } catch (error) {
        if (error !== rollback) throw error;
      }
    } finally { await client.end(); }
  });
});
