// The Workshop's closed value sets. Client-safe: no I/O. Mirrored as CHECK
// constraints in supabase/migrations/20261023120000_workshop_agents.sql.

export const OPERATOR_ROLES = ["admin", "operator"] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

/** What an agent says it is doing, from its own heartbeat. */
export const REPORTED_STATUSES = [
  "starting",
  "running",
  "idle",
  "paused",
  "error",
  "stopping",
  "stopped",
] as const;
export type ReportedStatus = (typeof REPORTED_STATUSES)[number];

/** What the owner has asked the agent to do. Agents read it from the control channel. */
export const DESIRED_STATES = ["run", "pause", "stop"] as const;
export type DesiredState = (typeof DESIRED_STATES)[number];

export const RUN_STATUSES = ["running", "succeeded", "failed", "cancelled"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ["succeeded", "failed", "cancelled"];

export const EVENT_LEVELS = ["debug", "info", "warn", "error"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

// Ingest limits. The per-minute rate is per server instance and only smooths
// bursts; the daily budgets are counted in Postgres, so they hold across every
// serverless instance and bound what one agent can store. Worst case per
// agent: 10,000 events × (2 KB message + 2 KB data) ≈ 40 MB/day, kept for 30
// days, plus 2,000 runs/day.
export const INGEST_LIMITS = {
  messageChars: 2000,
  summaryChars: 500,
  /** Heartbeat metadata and run metrics: overwritten or per-run, not accumulating. */
  jsonBytes: 8 * 1024,
  /** Per-event `data`: this is what accumulates, so it is kept small. */
  eventDataBytes: 2 * 1024,
  eventsPerBatch: 100,
  requestBytes: 64 * 1024,
  /** Requests per agent per minute across every ingest endpoint (per instance). */
  requestsPerMinute: 120,
  /** Events stored per agent per rolling 24 hours (database-enforced). */
  eventsPerDay: 10_000,
  /** New runs per agent per rolling 24 hours (database-enforced). */
  runsPerDay: 2_000,
} as const;

export const DEFAULT_HEARTBEAT_SECONDS = 30;
/** Never call an agent offline sooner than this, whatever interval it claims. */
export const MIN_OFFLINE_AFTER_SECONDS = 90;
/** Events older than this are pruned by the retention cron. */
export const EVENT_RETENTION_DAYS = 30;

/** Visible prefix on every agent token so leaked tokens are recognisable to scanners. */
export const AGENT_TOKEN_PREFIX = "hoa_agent_";
