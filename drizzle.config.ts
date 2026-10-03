import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

/**
 * How this project applies schema changes — read this before running anything.
 *
 * `npm run db:push` (drizzle-kit push) is the real workflow: it diffs
 * `schema.ts` against the live database and applies the difference. Everything
 * Drizzle cannot express — the two SQL-only foreign keys, RLS, grants, CHECK
 * constraints, seeds — lives in HAND-WRITTEN, hand-numbered files under
 * `supabase/migrations/` (CLAUDE.md Critical rule #3).
 *
 * `out` therefore points at `./drizzle`, a folder drizzle-kit owns outright.
 * It used to point at `supabase/migrations/`, where a single `db:generate`
 * would have dropped a `0000_*.sql` and a `meta/_journal.json` in among the
 * curated files and left two incompatible numbering schemes in the one folder
 * that is the recovery path for the family's data.
 *
 * `npm run db:generate` is kept only for inspecting what a change would emit.
 * Nothing reads `./drizzle` — do not start applying from it.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
