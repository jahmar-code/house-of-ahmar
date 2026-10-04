// House of Ahmar — restore a backup into a FRESH, ISOLATED target.
//
//   node scripts/restore.mjs --from backups/<dir> --env <target env file> --confirm-target <db-host:port>
//
// Order (docs/pkm/50-operations/backup-and-recovery.md):
//   0. The operator provisions the target from supabase/migrations, in order,
//      and keeps clients away from it. That versioned schema supplies tables,
//      the `private` helpers, RLS, grants, Storage buckets/policies, Realtime.
//   1. This script refuses anything but an empty, provisioned, non-live target.
//   2. One transaction, stop on the first SQL error: clear migration seed rows,
//      load Auth identities with their original IDs, then every public row.
//   3. Upload each Storage object at its original path with its content type.
//   4. Verify row counts, member↔identity linkage and object SHA-256 hashes
//      against the backup manifest. Exit non-zero on any difference.
// Then run the security checks in the runbook before exposing any client.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
};
const from = option("--from");
const envFile = option("--env");
const confirmTarget = option("--confirm-target");
const allowDbOnly = args.includes("--allow-db-only");
if (!from || !envFile || !confirmTarget) {
  console.error("usage: node scripts/restore.mjs --from <backup dir> --env <target env file> --confirm-target <db-host:port> [--allow-db-only]");
  process.exit(1);
}
const source = resolve(from);
const manifestPath = join(source, "manifest.json");
if (!existsSync(join(source, "MANIFEST.txt")) || !existsSync(manifestPath)) {
  console.error("That directory is not a completed backup (manifest missing).");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.format !== "house-of-ahmar-backup/2") {
  console.error("Unsupported backup format; restore it with the matching revision of this script.");
  process.exit(1);
}
for (const [file, expected] of Object.entries(manifest.files ?? {})) {
  const actual = createHash("sha256").update(readFileSync(join(source, file))).digest("hex");
  if (actual !== expected) {
    console.error(`${file} does not match the backup manifest; refusing a truncated or altered archive.`);
    process.exit(1);
  }
}
if (!manifest.files?.["auth.sql"] || !manifest.files?.["public-data.sql"]) {
  console.error("The manifest has no file hashes; take a fresh backup with the current script.");
  process.exit(1);
}
if (!manifest.storage && !allowDbOnly) {
  console.error("This is a --db-only backup: photos would not come back. Pass --allow-db-only to restore data alone.");
  process.exit(1);
}

// The target comes ONLY from the named file — never mixed with .env.local.
const target = config({ path: envFile, quiet: true, processEnv: {} });
if (target.error) {
  console.error(`Could not read ${envFile}`);
  process.exit(1);
}
const env = target.parsed;
const databaseUrl = new URL(env.DATABASE_URL ?? "");
if (!databaseUrl.port) {
  console.error("The target DATABASE_URL must name its port explicitly.");
  process.exit(1);
}
const targetId = `${databaseUrl.hostname}:${databaseUrl.port}`;
if (confirmTarget !== targetId) {
  console.error(`--confirm-target must exactly match the target database (${targetId}).`);
  process.exit(1);
}
// Everything the restore needs is checked before the first write, so a missing
// key can never leave a half-restored target that then refuses a retry.
for (const key of ["DATABASE_URL", ...(manifest.storage ? ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] : [])]) {
  if (!env[key]) {
    console.error(`${envFile} lacks ${key}; nothing was changed.`);
    process.exit(1);
  }
}
const endpoint = (value) => {
  const url = new URL(value);
  return `${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "5432")}`;
};
const live = config({ path: ".env.local", quiet: true, processEnv: {} }).parsed;
for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  if (live?.[key] && env[key] && endpoint(live[key]) === endpoint(env[key])) {
    console.error(`Refusing: the target ${key} is the configured live House (.env.local).`);
    process.exit(1);
  }
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
const fail = async (message) => {
  console.error(`✗ ${message}`);
  await sql.end();
  process.exit(1);
};

// ── 1) Fresh, provisioned, empty ─────────────────────────────────────────────
const SEED_CHANNELS = ["general", "announcements", "elders-only"];
const provisioned = await sql`select to_regprocedure('private.is_media_read_operation()') is not null as ok`;
if (!provisioned[0].ok) await fail("Target is not provisioned from the current migrations (operation-aware media helpers missing).");
const tables = Object.keys(manifest.tables);
const present = await sql`select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`;
const missing = tables.filter((t) => !present.some((p) => p.relname === t));
if (missing.length) await fail(`Target schema lacks tables from the backup: ${missing.join(", ")}`);
const [{ users }] = await sql`select count(*)::int as users from auth.users`;
if (users) await fail("Target already has Auth users; restore needs an empty project.");
for (const table of tables) {
  const [{ rows }] = await sql.unsafe(`select count(*)::int as rows from public."${table.replaceAll('"', '""')}"`);
  const seeded = table === "channels"
    ? (await sql`select count(*)::int as rows from public.channels where slug in ${sql(SEED_CHANNELS)}`)[0].rows
    : 0;
  if (rows !== seeded) await fail(`Target table ${table} already holds data; restore needs an empty project.`);
}
const [{ objects }] = await sql`select count(*)::int as objects from storage.objects where bucket_id in ('feed-media','archives','avatars')`;
if (objects) await fail("Target House buckets already hold objects.");

// ── 2) One transaction, stop on the first error ──────────────────────────────
const psqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
const quoted = tables.map((t) => `public."${t.replaceAll('"', '""')}"`).join(", ");
// Re-assert inside the restore transaction itself (no check-then-act gap), and
// compare every count before COMMIT so a short archive rolls back entirely.
const assertCount = (relation, expected, label) =>
  `do $$ begin if (select count(*) from ${relation}) <> ${Number(expected)} then raise exception 'restore check failed: ${label}'; end if; end $$;`;
const script = [
  "\\set ON_ERROR_STOP on",
  "begin;",
  assertCount("auth.users", 0, "target already has Auth users"),
  assertCount("public.members", 0, "target already has members"),
  // Only migration seed rows can exist here (checked above); the backup's own
  // rows replace them with their original IDs.
  `truncate table ${quoted} restart identity cascade;`,
  `\\i ${psqlLiteral(join(source, "auth.sql"))}`,
  `\\i ${psqlLiteral(join(source, "public-data.sql"))}`,
  ...Object.entries(manifest.auth).map(([table, rows]) => assertCount(`auth."${table.replaceAll('"', '""')}"`, rows, `auth.${table} count`)),
  ...Object.entries(manifest.tables).map(([table, rows]) => assertCount(`public."${table.replaceAll('"', '""')}"`, rows, `${table} count`)),
  "commit;",
  "",
].join("\n");
const connection = new URL(env.DATABASE_URL);
const password = connection.password
  ? decodeURIComponent(connection.password)
  : connection.searchParams.get("password");
connection.password = "";
connection.searchParams.delete("password");
const code = await new Promise((done, reject) => {
  const child = spawn("psql", ["--no-psqlrc", "--quiet", "--dbname", connection.toString()], {
    stdio: ["pipe", "ignore", "inherit"],
    // Minimal environment: no inherited PG* variable can redirect the target.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...(password === null ? {} : { PGPASSWORD: password }) },
  });
  child.on("error", reject);
  child.on("exit", done);
  child.stdin.end(script);
}).catch((error) => fail(`psql could not start (${error.message}); put a PostgreSQL client on PATH.`));
if (code !== 0) await fail("Database restore stopped on an error and was rolled back. Nothing was committed.");
console.log("  ✓ Auth identities and House data restored in one transaction");

// ── 3) Storage objects at their original paths ───────────────────────────────
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
for (const [bucket, entries] of Object.entries(manifest.storage ?? {})) {
  for (const entry of entries) {
    const bucketRoot = resolve(source, "storage", bucket);
    const file = resolve(bucketRoot, entry.path);
    if (!file.startsWith(`${bucketRoot}${sep}`)) await fail("Unsafe object path in backup");
    const { error } = await admin.storage.from(bucket).upload(entry.path, readFileSync(file), {
      contentType: entry.contentType ?? undefined,
      upsert: false,
    });
    if (error) await fail(`Could not restore an object into ${bucket}: ${error.message}`);
  }
}
if (manifest.storage) console.log("  ✓ Storage objects uploaded");
else console.log("  – backup was --db-only: no photos restored");

// ── 4) Verify against the manifest ───────────────────────────────────────────
const problems = [];
for (const [table, expected] of Object.entries(manifest.tables)) {
  const [{ rows }] = await sql.unsafe(`select count(*)::int as rows from public."${table.replaceAll('"', '""')}"`);
  if (rows !== expected) problems.push(`${table}: ${rows} rows, expected ${expected}`);
}
for (const [table, expected] of Object.entries(manifest.auth)) {
  const [{ rows }] = await sql.unsafe(`select count(*)::int as rows from auth.${table}`);
  if (rows !== expected) problems.push(`auth.${table}: ${rows} rows, expected ${expected}`);
}
const [{ orphans }] = await sql`select count(*)::int as orphans from public.members m
  where not exists (select 1 from auth.users u where u.id = m.auth_user_id)`;
if (orphans) problems.push(`${orphans} members without their Auth identity`);
for (const [bucket, entries] of Object.entries(manifest.storage ?? {})) {
  for (const entry of entries) {
    const { data, error } = await admin.storage.from(bucket).download(entry.path);
    const hash = !error && createHash("sha256").update(Buffer.from(await data.arrayBuffer())).digest("hex");
    if (hash !== entry.sha256) problems.push(`${bucket}: an object differs from the backup`);
  }
}
await sql.end();
if (problems.length) {
  console.error(`✗ Restore verification failed:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
const objectCount = Object.values(manifest.storage ?? {}).reduce((a, b) => a + b.length, 0);
console.log(`  ✓ Verified ${rows} rows in ${tables.length} tables, ${manifest.auth.users} identities, ${objectCount} objects`);
console.log("Next: run the post-restore security checks in the runbook before any client connects.");
