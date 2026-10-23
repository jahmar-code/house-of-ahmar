// A complete, runnable example: a worker that processes a job every 20 seconds,
// honours pause/stop from the Workshop, and reports runs and logs.
//
//   HOA_WORKSHOP_URL=https://agents.example.af HOA_AGENT_TOKEN=hoa_agent_… node tools/hoa-agent/example.mjs
import { WorkshopAgent } from "./hoa-agent.mjs";

const agent = new WorkshopAgent({ intervalSec: 15 });
let stopping = false;

agent.onControl(async (state) => {
  agent.log(`Control changed to ${state}`);
  if (state === "stop") stopping = true;
  if (state === "run") await agent.setStatus("running", "Resumed");
});

process.on("SIGINT", async () => {
  await agent.stop("Interrupted");
  process.exit(0);
});

await agent.start({ version: "0.1.0", message: "Example worker online", metadata: { kind: "example" } });

let n = 0;
while (!stopping) {
  try {
    await agent.waitWhilePaused();
    await agent.setStatus("running", `Processing job ${++n}`);
    await agent.run(`example-${Date.now()}`, async (run) => {
      run.log(`Job ${n} started`);
      await new Promise((r) => setTimeout(r, 3000));
      if (Math.random() < 0.15) throw new Error("Simulated failure");
      return { summary: `Job ${n} complete`, metrics: { items: Math.floor(Math.random() * 50) } };
    });
  } catch (error) {
    if (agent.stopRequested) break;
    await agent.setStatus("error", error.message).catch(() => {});
  }
  if (!stopping) {
    await agent.setStatus("idle", "Waiting for the next job").catch(() => {});
    await new Promise((r) => setTimeout(r, 20_000));
    await agent.control().catch(() => {});
    stopping ||= agent.stopRequested;
  }
}

await agent.stop("Stopped from the Workshop");
