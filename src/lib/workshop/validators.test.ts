import { describe, expect, it } from "vitest";
import { eventBatchSchema, heartbeatSchema, operatorFormSchema, runSchema } from "./validators";

describe("ingest validators", () => {
  it("accepts a minimal heartbeat and rejects unknown statuses", () => {
    expect(heartbeatSchema.safeParse({ status: "running" }).success).toBe(true);
    expect(heartbeatSchema.safeParse({ status: "exploded" }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ status: "running", intervalSec: 2 }).success).toBe(false);
  });

  it("caps JSON payload size", () => {
    const big = { blob: "x".repeat(9000) };
    expect(heartbeatSchema.safeParse({ status: "idle", metadata: big }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ status: "idle", metadata: { ok: 1 } }).success).toBe(true);
  });

  it("constrains run ids and future timestamps", () => {
    expect(runSchema.safeParse({ runId: "nightly-2026.10:23_a", status: "running" }).success).toBe(true);
    expect(runSchema.safeParse({ runId: "has space", status: "running" }).success).toBe(false);
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(runSchema.safeParse({ runId: "a", status: "running", startedAt: future }).success).toBe(false);
  });

  it("keeps accumulating event data smaller than metadata", () => {
    const data = { blob: "x".repeat(3000) };
    expect(eventBatchSchema.safeParse({ events: [{ message: "m", data }] }).success).toBe(false);
    expect(heartbeatSchema.safeParse({ status: "idle", metadata: data }).success).toBe(true);
  });

  it("bounds event batches", () => {
    expect(eventBatchSchema.safeParse({ events: [] }).success).toBe(false);
    const ok = eventBatchSchema.safeParse({ events: [{ message: "hi" }] });
    expect(ok.success && ok.data.events[0].level).toBe("info");
    expect(eventBatchSchema.safeParse({ events: Array.from({ length: 101 }, () => ({ message: "x" })) }).success).toBe(false);
  });

  it("normalises operator emails", () => {
    const parsed = operatorFormSchema.parse({ email: "  Partner@Example.COM ", displayName: "Ahmed" });
    expect(parsed.email).toBe("partner@example.com");
    expect(parsed.role).toBe("operator");
  });
});
