import { describe, expect, it } from "vitest";
import { computeHealth, offlineAfterSeconds, pendingControl } from "./status";

const now = new Date("2026-10-23T12:00:00Z");
const ago = (sec: number) => new Date(now.getTime() - sec * 1000);
const agent = (over: Partial<Parameters<typeof computeHealth>[0]> = {}) => ({
  reportedStatus: "running",
  lastHeartbeatAt: ago(10),
  heartbeatIntervalSec: 30,
  desiredState: "run",
  ...over,
});

describe("computeHealth", () => {
  it("trusts a fresh heartbeat", () => {
    expect(computeHealth(agent(), now)).toBe("running");
    expect(computeHealth(agent({ reportedStatus: "error" }), now)).toBe("error");
  });

  it("is 'never' before the first heartbeat", () => {
    expect(computeHealth(agent({ lastHeartbeatAt: null }), now)).toBe("never");
  });

  it("goes offline after three intervals, never sooner than 90s", () => {
    expect(offlineAfterSeconds(5)).toBe(90);
    expect(offlineAfterSeconds(60)).toBe(180);
    expect(offlineAfterSeconds(null)).toBe(90);
    expect(computeHealth(agent({ lastHeartbeatAt: ago(89), heartbeatIntervalSec: 5 }), now)).toBe("running");
    expect(computeHealth(agent({ lastHeartbeatAt: ago(91), heartbeatIntervalSec: 5 }), now)).toBe("offline");
    expect(computeHealth(agent({ lastHeartbeatAt: ago(170), heartbeatIntervalSec: 60 }), now)).toBe("running");
  });

  it("does not call a stopped agent offline", () => {
    expect(computeHealth(agent({ reportedStatus: "stopped", lastHeartbeatAt: ago(86_400) }), now)).toBe("stopped");
  });
});

describe("pendingControl", () => {
  it("flags requests the agent has not acknowledged", () => {
    expect(pendingControl(agent({ desiredState: "pause" }), "running")).toBe("pause");
    expect(pendingControl(agent({ desiredState: "pause" }), "paused")).toBeNull();
    expect(pendingControl(agent({ desiredState: "stop" }), "paused")).toBe("stop");
    expect(pendingControl(agent({ desiredState: "stop" }), "stopped")).toBeNull();
    expect(pendingControl(agent({ desiredState: "run" }), "paused")).toBe("run");
    expect(pendingControl(agent({ desiredState: "run" }), "running")).toBeNull();
  });
});
