import {
  DEFAULT_HEARTBEAT_SECONDS,
  MIN_OFFLINE_AFTER_SECONDS,
  type DesiredState,
  type ReportedStatus,
} from "./constants";

/** What the dashboard shows: the agent's own word, unless it has gone quiet. */
export type Health = ReportedStatus | "offline" | "never";

export type HealthInput = {
  reportedStatus: string | null;
  lastHeartbeatAt: Date | string | null;
  heartbeatIntervalSec: number | null;
  desiredState: string;
};

export function offlineAfterSeconds(intervalSec: number | null): number {
  return Math.max(MIN_OFFLINE_AFTER_SECONDS, (intervalSec ?? DEFAULT_HEARTBEAT_SECONDS) * 3);
}

export function computeHealth(agent: HealthInput, now: Date = new Date()): Health {
  if (!agent.lastHeartbeatAt) return "never";
  const ageSec = (now.getTime() - new Date(agent.lastHeartbeatAt).getTime()) / 1000;
  const status = (agent.reportedStatus ?? "idle") as ReportedStatus;
  // A stopped agent is expected to be silent; that is not an outage.
  if (status === "stopped") return "stopped";
  if (ageSec > offlineAfterSeconds(agent.heartbeatIntervalSec)) return "offline";
  return status;
}

/** True while the owner has asked for a state the agent has not yet reported. */
export function pendingControl(agent: HealthInput, health: Health): DesiredState | null {
  const desired = agent.desiredState as DesiredState;
  if (desired === "pause" && health !== "paused" && health !== "stopped") return "pause";
  if (desired === "stop" && health !== "stopped") return "stop";
  if (desired === "run" && (health === "paused" || health === "stopped")) return "run";
  return null;
}

export type HealthTone = "live" | "ok" | "attention" | "muted";

export const HEALTH_META: Record<Health, { label: string; tone: HealthTone }> = {
  starting: { label: "Starting", tone: "ok" },
  running: { label: "Running", tone: "live" },
  idle: { label: "Idle", tone: "ok" },
  paused: { label: "Paused", tone: "muted" },
  error: { label: "Error", tone: "attention" },
  stopping: { label: "Stopping", tone: "muted" },
  stopped: { label: "Stopped", tone: "muted" },
  offline: { label: "Offline", tone: "attention" },
  never: { label: "Not connected", tone: "muted" },
};

export function needsAttention(health: Health): boolean {
  return HEALTH_META[health].tone === "attention";
}
