// Local-only fixtures. Never reads .env.local or connects to a hosted project.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const cli = "node_modules/.bin/supabase";
const localConfig = readFileSync("supabase/config.toml", "utf8");
if (!/^project_id = "house-of-ahmar"$/m.test(localConfig)) {
  throw new Error("Unexpected test project: refusing to remove any local volumes.");
}
// A CLI upgrade does not replace already-running service containers. Keeping
// those while resetting a newer database breaks Storage and Realtime schemas.
console.log("Recreating this project's disposable Supabase services and fixtures...");
execFileSync(cli, ["stop", "--project-id", "house-of-ahmar", "--no-backup"], {
  stdio: ["ignore", "ignore", "inherit"], timeout: 180_000,
});
console.log("Starting isolated Supabase and replaying migrations (first download may take a few minutes)...");
execFileSync(cli, ["start", "-x", "studio,postgres-meta,edge-runtime,logflare,vector,supavisor"], {
  stdio: ["ignore", "ignore", "inherit"], timeout: 600_000,
});
const status = JSON.parse(execFileSync(cli, ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
for (const value of [status.API_URL, status.DB_URL]) {
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)) throw new Error("Only local Supabase is allowed.");
}
if (new URL(status.DB_URL).port !== "55322") throw new Error("Unexpected test database port.");
const password = `Hoa-test-${randomBytes(18).toString("hex")}`;
const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  DATABASE_URL: status.DB_URL,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3217",
  HOA_DEFAULT_ACCESS_CODE: "LOCAL-BOOTSTRAP-ONLY",
  E2E_PASSWORD: password,
};
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = postgres(status.DB_URL, { max: 1 });
try {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const role of ["elder", "member", "guest"]) {
    const email = `e2e-${role}@house.local`;
    const existing = data.users.find((user) => user.email === email);
    const result = existing
      ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
      : await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw result.error ?? new Error("Test user missing");
    const [member] = await sql`
      insert into public.members (auth_user_id, display_name, email, role, is_active)
      values (${result.data.user.id}, ${`Test ${role}`}, ${email}, ${role}, true)
      on conflict (auth_user_id) do update set role = excluded.role, is_active = true
      returning id
    `;
    const updated = await admin.auth.admin.updateUserById(result.data.user.id, { user_metadata: { hoa_member_id: member.id } });
    if (updated.error) throw updated.error;
  }
  for (const channel of [
    { name: "General", slug: "general", type: "general" },
    { name: "Announcements", slug: "announcements", type: "announcement" },
    { name: "Elders Only", slug: "elders-only", type: "private" },
  ]) {
    await sql`insert into public.channels (name, slug, type) values (${channel.name}, ${channel.slug}, ${channel.type}) on conflict (slug) do nothing`;
  }
  await sql`insert into public.access_codes (code, label, max_uses) values ('LOCAL-INVITE', 'E2E only', 1000) on conflict (code) do update set status = 'active', max_uses = 1000, use_count = 0`;
  writeFileSync(".env.e2e.local", Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  console.log("Prepared local Elder, Member and Guest fixtures. Private test configuration saved to .env.e2e.local.");
} finally {
  await sql.end();
}
