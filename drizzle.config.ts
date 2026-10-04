import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

/**
 * Schema changes reach a database only as reviewed SQL in supabase/migrations/,
 * applied in order — see docs/pkm/50-operations/migration-runbook.md.
 *
 * - `npm run db:generate` writes Drizzle's proposed SQL to `./drizzle` for
 *   inspection only. Nothing applies from that folder; turn reviewed statements
 *   into a new timestamped migration (with any RLS, grants and backfills).
 * - `drizzle-kit push` / `migrate` would change a database directly and know
 *   nothing of RLS, grants, Storage policies or Realtime. They are refused below
 *   unless DATABASE_URL is the disposable local test database. There is no npm
 *   script for them on purpose.
 * - `npm run db:studio` opens the configured database for reading AND writing.
 */
const DIRECT_WRITES = ["push", "migrate", "drop", "up"];
if (process.argv.some((arg) => DIRECT_WRITES.includes(arg))) {
  const target = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.port !== "55322") {
    throw new Error(
      "drizzle-kit push/migrate are limited to the disposable local test database (port 55322). " +
        "Apply reviewed SQL with the migration runbook instead."
    );
  }
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
