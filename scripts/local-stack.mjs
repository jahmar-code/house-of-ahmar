// The dedicated, disposable local Supabase project used by tests. Never a hosted project.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cli = "node_modules/.bin/supabase";
const LOOPBACK = ["127.0.0.1", "localhost", "[::1]"];

/** Stop this project's services, discard their volumes, and start fresh from the migrations. */
export function recreateLocalStack() {
  const localConfig = readFileSync("supabase/config.toml", "utf8");
  if (!/^project_id = "house-of-ahmar"$/m.test(localConfig)) {
    throw new Error("Unexpected test project: refusing to remove any local volumes.");
  }
  // A CLI upgrade does not replace already-running service containers. Keeping
  // those while resetting a newer database breaks Storage and Realtime schemas.
  execFileSync(cli, ["stop", "--project-id", "house-of-ahmar", "--no-backup"], {
    stdio: ["ignore", "ignore", "inherit"], timeout: 180_000,
  });
  execFileSync(cli, ["start", "-x", "studio,postgres-meta,edge-runtime,logflare,vector,supavisor"], {
    stdio: ["ignore", "ignore", "inherit"], timeout: 600_000,
  });
  return localStackStatus();
}

export function localStackStatus() {
  const status = JSON.parse(execFileSync(cli, ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  for (const value of [status.API_URL, status.DB_URL]) {
    if (!LOOPBACK.includes(new URL(value).hostname)) throw new Error("Only local Supabase is allowed.");
  }
  if (new URL(status.DB_URL).port !== "55322") throw new Error("Unexpected test database port.");
  return status;
}
