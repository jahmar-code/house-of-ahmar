// House of Ahmar Workshop reporter. Zero dependencies; Node 18+ (global fetch).
//
// Library:
//   import { WorkshopAgent } from "./hoa-agent.mjs";
//   const agent = new WorkshopAgent({ url: process.env.HOA_WORKSHOP_URL, token: process.env.HOA_AGENT_TOKEN });
//   agent.onControl((state) => { if (state === "stop") process.exit(0); });
//   await agent.start({ version: "1.2.0" });          // heartbeats every 30s
//   await agent.run("job-42", async (run) => { run.log("working"); return { summary: "done" }; });
//
// CLI (for shell scripts, cron and Claude Code hooks):
//   node hoa-agent.mjs heartbeat --status running --message "Indexing"
//   node hoa-agent.mjs log --level warn "Disk at 85%"
//   node hoa-agent.mjs run --id nightly-1 --status succeeded --summary "Synced 40 records"
//   node hoa-agent.mjs control          # prints run | pause | stop
//
// Never put secrets, customer data or full prompts in messages: operators you
// share the agent with can read everything it reports.

import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const DEFAULT_INTERVAL_SEC = 30;
const MAX_BUFFER = 1000;

export class WorkshopAgent {
  /**
   * @param {{ url?: string, token?: string, intervalSec?: number, host?: string, fetch?: typeof fetch }} [options]
   */
  constructor(options = {}) {
    this.url = (options.url ?? process.env.HOA_WORKSHOP_URL ?? "").replace(/\/+$/, "");
    this.token = options.token ?? process.env.HOA_AGENT_TOKEN ?? "";
    if (!this.url) throw new Error("HOA_WORKSHOP_URL is not set (e.g. https://agents.kabul-afghanistan.ca)");
    if (!this.token) throw new Error("HOA_AGENT_TOKEN is not set");
    this.intervalSec = options.intervalSec ?? DEFAULT_INTERVAL_SEC;
    this.host = options.host ?? hostname();
    this.fetch = options.fetch ?? globalThis.fetch;
    this.status = "starting";
    this.message = undefined;
    this.desiredState = "run";
    this.listeners = new Set();
    this.buffer = [];
    this.timer = null;
    this.flushing = null;
  }

  async #post(path, body, method = "POST") {
    const response = await this.fetch(`${this.url}/api/agents/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(method === "POST" && { "Content-Type": "application/json" }),
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Workshop ${path} failed (${response.status}): ${json.error ?? response.statusText}`);
      error.status = response.status;
      throw error;
    }
    if (json.desiredState) this.#applyControl(json.desiredState);
    return json;
  }

  #applyControl(state) {
    if (state === this.desiredState) return;
    this.desiredState = state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error("[hoa-agent] control listener threw", error);
      }
    }
  }

  /** Called with "run" | "pause" | "stop" whenever the owner changes it in the dashboard. */
  onControl(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get paused() {
    return this.desiredState === "pause";
  }

  get stopRequested() {
    return this.desiredState === "stop";
  }

  /** Resolves once the owner resumes (or immediately if not paused). Rejects if a stop is requested. */
  async waitWhilePaused() {
    while (this.paused) {
      if (this.status !== "paused") await this.setStatus("paused", "Paused from the Workshop");
      await new Promise((r) => setTimeout(r, Math.min(this.intervalSec, 10) * 1000));
      await this.control().catch(() => {});
    }
    if (this.stopRequested) throw new Error("Stop requested from the Workshop");
  }

  async heartbeat(extra = {}) {
    return this.#post("heartbeat", {
      status: this.status,
      message: this.message,
      host: this.host,
      intervalSec: this.intervalSec,
      ...extra,
    });
  }

  async setStatus(status, message) {
    this.status = status;
    this.message = message;
    return this.heartbeat();
  }

  async control() {
    return this.#post("control", undefined, "GET");
  }

  /** Begins the heartbeat loop. Network failures are logged and retried on the next tick. */
  async start({ status = "running", message, version, metadata } = {}) {
    this.status = status;
    this.message = message;
    await this.heartbeat({ version, metadata });
    this.timer = setInterval(() => {
      this.heartbeat().catch((e) => console.error("[hoa-agent]", e.message));
      this.flush().catch(() => {});
    }, this.intervalSec * 1000);
    this.timer.unref?.();
    return this;
  }

  /** Buffers a log line; flushed in batches. */
  log(message, { level = "info", data, runId } = {}) {
    if (this.buffer.length >= MAX_BUFFER) this.buffer.shift();
    this.buffer.push({ level, message: String(message).slice(0, 2000), data, runId, at: new Date().toISOString() });
    if (this.buffer.length >= 50) this.flush().catch(() => {});
  }

  async flush() {
    if (this.flushing) return this.flushing;
    if (!this.buffer.length) return;
    const batch = this.buffer.splice(0, 100);
    this.flushing = this.#post("events", { events: batch })
      .catch((error) => {
        // Keep the lines for the next attempt unless the server rejected them outright.
        if (!error.status || error.status >= 500 || error.status === 429) this.buffer.unshift(...batch);
        throw error;
      })
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }

  async reportRun(runId, status, { summary, metrics, startedAt, endedAt } = {}) {
    return this.#post("runs", { runId, status, summary, metrics, startedAt, endedAt });
  }

  /**
   * Wraps one unit of work as a run. The callback may return { summary, metrics }.
   * A thrown error marks the run failed and is re-thrown.
   */
  async run(runId = randomUUID(), fn) {
    await this.waitWhilePaused();
    await this.reportRun(runId, "running");
    const run = { id: runId, log: (message, opts = {}) => this.log(message, { ...opts, runId }) };
    try {
      const result = (await fn(run)) ?? {};
      await this.flush().catch(() => {});
      await this.reportRun(runId, "succeeded", result);
      return result;
    } catch (error) {
      this.log(error?.message ?? String(error), { level: "error", runId });
      await this.flush().catch(() => {});
      await this.reportRun(runId, "failed", { summary: String(error?.message ?? error).slice(0, 500) });
      throw error;
    }
  }

  /** Flushes logs, reports "stopped" and ends the loop. */
  async stop(message = "Shut down") {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush().catch(() => {});
    await this.setStatus("stopped", message).catch(() => {});
  }
}

// ─── CLI ───

function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      flags[key] = next && !next.startsWith("--") ? (i++, next) : "true";
    } else rest.push(arg);
  }
  return { flags, rest };
}

async function cli() {
  const [command, ...args] = process.argv.slice(2);
  const { flags, rest } = parseArgs(args);
  const agent = new WorkshopAgent();
  switch (command) {
    case "heartbeat": {
      agent.status = flags.status ?? "running";
      agent.message = flags.message;
      const result = await agent.heartbeat(flags.version ? { version: flags.version } : {});
      console.log(result.desiredState);
      break;
    }
    case "log": {
      agent.log(rest.join(" ") || flags.message, { level: flags.level ?? "info", runId: flags.run });
      await agent.flush();
      break;
    }
    case "run": {
      if (!flags.id) throw new Error("--id is required");
      await agent.reportRun(flags.id, flags.status ?? "running", { summary: flags.summary });
      break;
    }
    case "control": {
      console.log((await agent.control()).desiredState);
      break;
    }
    default:
      console.error("Usage: hoa-agent.mjs <heartbeat|log|run|control> [--flags]");
      process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  cli().catch((error) => {
    console.error(`[hoa-agent] ${error.message}`);
    process.exit(1);
  });
}
