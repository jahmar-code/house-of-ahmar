// The dedicated, disposable local Supabase project used by tests. Never a hosted project.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cli = "node_modules/.bin/supabase";
const LOOPBACK = ["127.0.0.1", "localhost", "[::1]"];
// The Workshop worktree runs its own disposable stack so a reset here never
// wipes the main checkout's volumes. Both stacks bind 55321/55322, so only one
// can run at a time; stop it when verification is done.
const PROJECT_ID = "hoa-workshop";
const EXCLUDED = ["studio", "postgres-meta", "edge-runtime", "logflare", "vector", "supavisor"];
// Workshop-only verification needs Auth, PostgREST and Postgres. Set
// HOA_STACK_MINIMAL=1 to also skip Realtime (the heaviest container) and Storage;
// the full `test:db` suite needs both, so leave it unset for that.
const MINIMAL_EXCLUDED = ["realtime", "storage-api", "imgproxy"];

/** Stop this project's services, discard their volumes, and start fresh from the migrations. */
export function recreateLocalStack() {
  const localConfig = readFileSync("supabase/config.toml", "utf8");
  if (!new RegExp(`^project_id = "${PROJECT_ID}"$`, "m").test(localConfig)) {
    throw new Error("Unexpected test project: refusing to remove any local volumes.");
  }
  // A CLI upgrade does not replace already-running service containers. Keeping
  // those while resetting a newer database breaks Storage and Realtime schemas.
  execFileSync(cli, ["stop", "--project-id", PROJECT_ID, "--no-backup"], {
    stdio: ["ignore", "ignore", "inherit"], timeout: 180_000,
  });
  const excluded = process.env.HOA_STACK_MINIMAL === "1" ? [...EXCLUDED, ...MINIMAL_EXCLUDED] : EXCLUDED;
  execFileSync(cli, ["start", "-x", excluded.join(",")], {
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
