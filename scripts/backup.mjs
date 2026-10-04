// House of Ahmar — identity-preserving backup for an isolated restore.
// READ ONLY: this script never writes to Supabase.
//
//   npm run backup                            # .env.local → ./backups/<timestamp>-xxxxxx/
//   npm run backup -- --out ~/hoa             # → ~/hoa/<timestamp>-xxxxxx/
//   npm run backup -- --db-only               # skip Storage (NOT a complete backup)
//   npm run backup -- --env .env.e2e.local    # explicit environment file (rehearsals)
//
// Restore contract (docs/pkm/50-operations/backup-and-recovery.md): provision a
// FRESH target from the versioned migrations in supabase/migrations, then load
// this archive's data with scripts/restore.mjs. The archive deliberately holds
// data, not schema: RLS policies depend on the `private` helper schema, Storage
// policies and grants, all of which come from the migrations, never a dump.
//
//   auth.sql              auth.users + auth.identities rows (original IDs and
//                         password hashes — the most sensitive file here)
//   public-data.sql       every public table's rows
//   schema-reference.sql  public + private schema, for inspection/diffing only
//   storage/<bucket>/...  every object in the House buckets
//   manifest.json         row counts from the same snapshot, object sizes and
//                         SHA-256 hashes, migration list and tool versions
//   MANIFEST.txt          written last; its presence means every step finished
//
// Take one before applying a reviewed migration or bulk change to the live
// House, and on a schedule that matches acceptable data loss. A backup you have
// never restored is a hope, not a backup.
//
// Requires pg_dump (a client at least as new as the server) on PATH, and
// SUPABASE_SERVICE_ROLE_KEY for the Storage half.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

// Backups contain private family data, including files downloaded from Storage.
process.umask(0o077);

const BUCKETS = ["feed-media", "archives", "avatars"];

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    console.error(`${name} needs a value`);
    process.exit(1);
  }
  return args[index + 1];
};
const dbOnly = args.includes("--db-only");
const envFile = option("--env") ?? ".env.local";
const outRoot = resolve(option("--out") ?? "backups");
// Settings come ONLY from the named file — never from the shell, so a
// rehearsal can never pair one database with another project's photos.
const loaded = config({ path: envFile, quiet: true, processEnv: {} });
if (loaded.error) {
  console.error(`Could not read ${envFile}`);
  process.exit(1);
}
const env = loaded.parsed;

const dbUrl = env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL missing — see .env.example");
  process.exit(1);
}

const probe = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
if (probe.error) {
  console.error(
    "✗ pg_dump not found on PATH.\n" +
      "    macOS:  brew install libpq, then add $(brew --prefix libpq)/bin to PATH\n" +
      "    Use a client at least as new as the server, or the dump aborts on a\n" +
      "    server-version mismatch."
  );
  process.exit(1);
}

// pg_dump expands URI connection parameters only for --dbname. Supply the
// password separately so process arguments never contain that credential.
const dumpConnection = new URL(dbUrl);
const dumpPassword = dumpConnection.password
  ? decodeURIComponent(dumpConnection.password)
  : dumpConnection.searchParams.get("password");
dumpConnection.password = "";
dumpConnection.searchParams.delete("password");
// A minimal environment: no inherited PG* variable can redirect the dump.
const pgEnv = { PATH: process.env.PATH, HOME: process.env.HOME, ...(dumpPassword === null ? {} : { PGPASSWORD: dumpPassword }) };

function pgDump(file, extra) {
  return new Promise((resolveDump, rejectDump) => {
    const child = spawn("pg_dump", ["--dbname", dumpConnection.toString(), "--no-owner", "--no-privileges", "--file", file, ...extra], {
      stdio: ["ignore", "inherit", "inherit"],
      env: pgEnv,
    });
    child.on("error", rejectDump);
    child.on("exit", (code) => (code === 0 ? resolveDump() : rejectDump(new Error(`pg_dump exited ${code}`))));
  });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(outRoot, { recursive: true });
const dest = mkdtempSync(join(outRoot, `${stamp}-`));
console.log(`House of Ahmar backup → ${dest}\n  pg_dump: ${probe.stdout.trim()}`);

const sql = postgres(dbUrl, { max: 1, prepare: false, onnotice: () => {} });
const manifest = {
  format: "house-of-ahmar-backup/2",
  takenAt: new Date().toISOString(),
  pgDump: probe.stdout.trim(),
  revision: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim() || null,
  migrations: readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort(),
  tables: {},
  auth: {},
  storage: dbOnly ? null : {},
};

try {
  // ── 1) Postgres, from ONE snapshot so the dumps and counts agree ──────────
  await sql.begin("isolation level repeatable read read only", async (tx) => {
    const [{ snapshot }] = await tx`select pg_export_snapshot() as snapshot`;
    const tables = await tx`select c.relname from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by c.relname`;
    for (const { relname } of tables) {
      const [{ rows }] = await tx.unsafe(`select count(*)::int as rows from public."${relname.replaceAll('"', '""')}"`);
      manifest.tables[relname] = rows;
    }
    for (const table of ["users", "identities"]) {
      const [{ rows }] = await tx.unsafe(`select count(*)::int as rows from auth.${table}`);
      manifest.auth[table] = rows;
    }
    const snap = ["--snapshot", snapshot];
    await pgDump(join(dest, "auth.sql"), [...snap, "--data-only", "--table=auth.users", "--table=auth.identities"]);
    console.log(`  ✓ auth.sql (${manifest.auth.users} identities)`);
    await pgDump(join(dest, "public-data.sql"), [...snap, "--data-only", "--schema=public"]);
    console.log(`  ✓ public-data.sql (${Object.keys(manifest.tables).length} tables)`);
    await pgDump(join(dest, "schema-reference.sql"), [...snap, "--schema-only", "--schema=public", "--schema=private"]);
    console.log("  ✓ schema-reference.sql (inspection only)");
  });
  // Restore refuses SQL files that differ from what was written here.
  manifest.files = Object.fromEntries(["auth.sql", "public-data.sql"].map((file) =>
    [file, createHash("sha256").update(readFileSync(join(dest, file))).digest("hex")]));
} catch (error) {
  console.error(`  ✗ database backup failed (${error.message}) — this directory is incomplete. Backup aborted.`);
  console.error("    A transaction-mode pooler cannot export snapshots; use the direct or session connection string.");
  await sql.end();
  process.exit(1);
}
await sql.end();

// ── 2) Storage ───────────────────────────────────────────────────────────────
if (dbOnly) {
  console.log("  – storage skipped (--db-only)");
} else {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "  ✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing —\n" +
        "    the database is saved but the PHOTOS ARE NOT. Set them and re-run,\n" +
        "    or accept a database-only backup with --db-only."
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The bucket is a tree (`<memberId>/…` and `avatars/<memberId>/…`), and list()
  // is one level deep, so walk it. An entry with no `id` is a folder.
  async function walk(bucket, prefix = "") {
    const files = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 100, offset });
      if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
      if (!data.length) break;
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) files.push({ path, contentType: entry.metadata?.mimetype ?? null });
        else files.push(...(await walk(bucket, path)));
      }
      if (data.length < 100) break;
      offset += data.length;
    }
    return files;
  }

  for (const bucket of BUCKETS) {
    let objects;
    try {
      objects = await walk(bucket);
    } catch (err) {
      console.error(`  ✗ could not list bucket "${bucket}": ${err.message}`);
      process.exit(1);
    }

    manifest.storage[bucket] = [];
    for (const object of objects) {
      const { data, error } = await admin.storage.from(bucket).download(object.path);
      if (error) {
        console.error(`  ✗ could not download an object from ${bucket}: ${error.message}`);
        process.exit(1);
      }
      const bucketRoot = resolve(dest, "storage", bucket);
      const target = resolve(bucketRoot, object.path);
      if (!target.startsWith(`${bucketRoot}${sep}`)) {
        throw new Error(`Unsafe Storage object path in bucket ${bucket}`);
      }
      const bytes = Buffer.from(await data.arrayBuffer());
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      manifest.storage[bucket].push({
        path: object.path,
        contentType: object.contentType ?? data.type ?? null,
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    const saved = manifest.storage[bucket].length;
    console.log(`  ✓ storage/${bucket} (${saved} file${saved === 1 ? "" : "s"})`);
  }
}

writeFileSync(join(dest, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(
  join(dest, "MANIFEST.txt"),
  [
    `House of Ahmar backup (${manifest.format})`,
    `taken:    ${manifest.takenAt}`,
    `contents: auth.sql (${manifest.auth.users} users, ${manifest.auth.identities} identities), public-data.sql, schema-reference.sql`,
    dbOnly ? `storage:  SKIPPED (--db-only) — not a complete family backup` : `storage:  ${BUCKETS.map((b) => `${b} (${manifest.storage[b].length})`).join(", ")}`,
    `revision: ${manifest.revision ?? "unknown"}; ${manifest.migrations.length} migration files`,
    ``,
    `Restore ONLY into a fresh, isolated target provisioned from these migrations:`,
    `  node scripts/restore.mjs --from <this directory> --env <target env file> --confirm-target <host:port>`,
    `See docs/pkm/50-operations/backup-and-recovery.md. Never restore over the live House.`,
    `auth.sql holds password hashes and contact details: keep this directory private and off-device copies encrypted.`,
    ``,
  ].join("\n")
);

console.log(`\nDone. Rehearse recovery — see docs/pkm/50-operations/backup-and-recovery.md.`);
