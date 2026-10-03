// House of Ahmar — application data/media backup (Auth excluded).
// READ ONLY: this script never writes to Supabase.
//
//   node scripts/backup.mjs                 # → ./backups/<timestamp>/
//   node scripts/backup.mjs --out ~/hoa     # → ~/hoa/<timestamp>/
//   node scripts/backup.mjs --db-only       # skip the Storage download
//
// Why this exists: this database is the family's only copy of its own memory —
// the Wall, the Council history, birthdays, and the photos. Supabase Postgres
// backups do NOT include Storage objects on any tier, and the free tier has no
// point-in-time recovery at all, so a restored database would come back with
// every image gone. This takes both planes in one pass.
//
// Run it monthly, and ALWAYS before `npm run db:push` against the live House.
// See docs/pkm/50-operations/backup-and-recovery.md for the restore drill — a backup you have never restored
// is a hope, not a backup.
//
// Requires: `pg_dump` (Postgres 15+ client) on PATH, and SUPABASE_SERVICE_ROLE_KEY
// for the Storage half.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

config({ path: ".env.local", quiet: true });

// Backups contain private family data, including files downloaded from Storage.
process.umask(0o077);

const BUCKETS = ["feed-media", "archives", "avatars"];

const args = process.argv.slice(2);
const dbOnly = args.includes("--db-only");
const outIdx = args.indexOf("--out");
if (outIdx !== -1 && !args[outIdx + 1]) {
  console.error("--out needs a directory, e.g. --out ~/hoa-backups");
  process.exit(1);
}
const outRoot = resolve(outIdx !== -1 ? args[outIdx + 1] : "backups");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL missing — see .env.example");
  process.exit(1);
}

const probe = spawnSync("pg_dump", ["--version"], { encoding: "utf8" });
if (probe.error) {
  console.error(
    "✗ pg_dump not found on PATH.\n" +
      "    macOS:  brew install libpq && brew link --force libpq\n" +
      "    Then re-run. (Use a client at least as new as the server, or the\n" +
      "    dump aborts on a server-version mismatch.)"
  );
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(outRoot, { recursive: true });
const dest = mkdtempSync(join(outRoot, `${stamp}-`));

console.log(`House of Ahmar backup → ${dest}\n`);

// ── 1) Postgres ──────────────────────────────────────────────────────────────
// --no-owner / --no-privileges keep the dump restorable into a fresh Supabase
// project, whose role names differ. This intentionally excludes Auth identities;
// cross-project recovery requires a separate identity-preserving Auth backup.
const dumpPath = join(dest, "database.sql");
const dumpConnection = new URL(dbUrl);
const dumpPassword = dumpConnection.password
  ? decodeURIComponent(dumpConnection.password)
  : dumpConnection.searchParams.get("password");
dumpConnection.password = "";
dumpConnection.searchParams.delete("password");
console.log(`  pg_dump: ${probe.stdout.trim()}`);
const dump = spawnSync(
  "pg_dump",
  [
    "--dbname",
    dumpConnection.toString(),
    "--schema=public",
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpPath,
  ],
  {
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
    // pg_dump expands URI connection parameters only for --dbname. Supply the
    // password separately so process arguments never contain that credential.
    env: { ...process.env, ...(dumpPassword === null ? {} : { PGPASSWORD: dumpPassword }) },
  }
);
if (dump.status !== 0) {
  console.error("  ✗ pg_dump failed — this directory may contain a partial dump. Backup aborted.");
  process.exit(1);
}
console.log(`  ✓ database.sql`);

// ── 2) Storage ───────────────────────────────────────────────────────────────
if (dbOnly) {
  console.log("  – storage skipped (--db-only)");
} else {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
        if (entry.id) files.push(path);
        else files.push(...(await walk(bucket, path)));
      }
      if (data.length < 100) break;
      offset += data.length;
    }
    return files;
  }

  for (const bucket of BUCKETS) {
    let paths;
    try {
      paths = await walk(bucket);
    } catch (err) {
      console.error(`  ✗ could not list bucket "${bucket}": ${err.message}`);
      process.exit(1);
    }

    let saved = 0;
    for (const path of paths) {
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error) {
        console.error(`  ✗ ${bucket}/${path}: ${error.message}`);
        process.exit(1);
      }
      const bucketRoot = resolve(dest, "storage", bucket);
      const target = resolve(bucketRoot, path);
      if (!target.startsWith(`${bucketRoot}${sep}`)) {
        throw new Error(`Unsafe Storage object path in bucket ${bucket}`);
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(await data.arrayBuffer()));
      saved += 1;
    }
    console.log(`  ✓ storage/${bucket} (${saved} file${saved === 1 ? "" : "s"})`);
  }
}

writeFileSync(
  join(dest, "MANIFEST.txt"),
  [
    `House of Ahmar backup`,
    `taken:    ${new Date().toISOString()}`,
    `contents: database.sql (schema public, no owner/privileges)`,
    dbOnly ? `          storage: SKIPPED (--db-only)` : `          storage/${BUCKETS.join(", ")}`,
    ``,
    `Restore: see docs/pkm/50-operations/backup-and-recovery.md.`,
    `  This is an application-data backup, NOT a complete Supabase disaster recovery backup.`,
    `  auth.users, identities, sessions, and project configuration are NOT included.`,
    `  Preserve/restore the original auth.users IDs BEFORE restoring member rows.`,
    `  New signups get new IDs and cannot automatically reconnect to these members.`,
    `  1. Restore into an isolated project with compatible schema and original auth identities.`,
    `  2. Use psql with ON_ERROR_STOP=1; do not overwrite a live database without a restore plan.`,
    `  3. Re-apply current lockdown/private-media migrations before allowing client access.`,
    `  4. Restore Realtime publication and private Storage bucket policies.`,
    `  5. Re-upload every saved storage bucket preserving object paths; verify signed-in media access.`,
    `  6. Verify authentication, role gates, table grants and anonymous denial in the scratch project.`,
    ``,
  ].join("\n")
);

console.log(`\nDone. Rehearse recovery — see docs/pkm/50-operations/backup-and-recovery.md.`);
