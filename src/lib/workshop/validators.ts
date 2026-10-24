import { z } from "zod";
import {
  DESIRED_STATES,
  EVENT_LEVELS,
  INGEST_LIMITS,
  REPORTED_STATUSES,
  RUN_STATUSES,
} from "./constants";

const clip = (max: number) => z.string().trim().max(max);

/** A JSON object whose serialised size stays under `maxBytes`. */
const objectUpTo = (maxBytes: number) =>
  z
    .record(z.string(), z.unknown())
    .refine(
      (value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= maxBytes,
      `must serialise to at most ${maxBytes} bytes`
    );
const boundedObject = objectUpTo(INGEST_LIMITS.jsonBytes);

const pastOrNow = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now() + 5 * 60_000, "must not be in the future");

export const heartbeatSchema = z.object({
  status: z.enum(REPORTED_STATUSES),
  message: clip(INGEST_LIMITS.summaryChars).optional(),
  version: clip(64).optional(),
  host: clip(128).optional(),
  intervalSec: z.number().int().min(5).max(3600).optional(),
  metadata: boundedObject.optional(),
});

export const runSchema = z.object({
  runId: z.string().trim().min(1).max(128).regex(/^[\w.:-]+$/, "may use letters, numbers, . _ : -"),
  status: z.enum(RUN_STATUSES),
  summary: clip(INGEST_LIMITS.summaryChars).optional(),
  metrics: boundedObject.optional(),
  startedAt: pastOrNow.optional(),
  endedAt: pastOrNow.optional(),
});

export const eventSchema = z.object({
  level: z.enum(EVENT_LEVELS).default("info"),
  message: z.string().trim().min(1).max(INGEST_LIMITS.messageChars),
  data: objectUpTo(INGEST_LIMITS.eventDataBytes).optional(),
  runId: runSchema.shape.runId.optional(),
  at: pastOrNow.optional(),
});

export const eventBatchSchema = z.object({
  events: z.array(eventSchema).min(1).max(INGEST_LIMITS.eventsPerBatch),
});

// ─── Dashboard forms ───

export const agentFormSchema = z.object({
  name: z.string().trim().min(1, "Give the agent a name").max(80, "Keep the name under 80 characters"),
  description: z.string().trim().max(500, "Keep the description under 500 characters").optional(),
});

export const desiredStateSchema = z.enum(DESIRED_STATES);

export const operatorFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  displayName: z.string().trim().min(1, "Add a name").max(60, "Keep the name under 60 characters"),
  role: z.enum(["admin", "operator"]).default("operator"),
});

export const eventLevelFilterSchema = z.enum(EVENT_LEVELS).optional().catch(undefined);
