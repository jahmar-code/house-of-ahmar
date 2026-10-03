// DEV/QA ONLY — inserts one gathering dated 14 days ago so the archive sweep
// (archivePastGatherings) has something to sweep.
//
// ⚠️  There is only ONE Supabase project, so this writes to the House the family
//     actually uses. It is idempotent — it reuses the row it already created
//     rather than piling up "Old Iftar" entries in the real events list — and it
//     refuses to run without ALLOW_SEED=1 so it can never be a stray tab-complete.
//
//   ALLOW_SEED=1 node scripts/seed-past-gathering.mjs
//
// To remove it afterwards:
//   delete from gatherings where title = 'Old Iftar (seed, 14 days ago)';
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const TITLE = "Old Iftar (seed, 14 days ago)";

if (process.env.ALLOW_SEED !== "1") {
  console.error(
    "\n  ⚠️  REFUSING TO RUN — this writes a gathering into the live House.\n" +
      "     Re-run with ALLOW_SEED=1 if that is genuinely what you want:\n" +
      "       ALLOW_SEED=1 node scripts/seed-past-gathering.mjs\n"
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — see .env.example");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const elder = await sql`SELECT id FROM members WHERE role = 'elder' LIMIT 1`;
if (!elder.length) {
  console.error("No elder found — the House has not been initiated yet.");
  await sql.end();
  process.exit(1);
}

// Idempotent: one seed row, reused. The original version had no guard, so every
// run added another past gathering to the family's real list.
const existing = await sql`
  SELECT id, starts_at FROM gatherings WHERE title = ${TITLE} LIMIT 1
`;
if (existing.length) {
  console.log(`Already seeded: ${existing[0].id} starts_at=${existing[0].starts_at}`);
  await sql.end();
  process.exit(0);
}

const past = new Date();
past.setDate(past.getDate() - 14);

const [g] = await sql`
  INSERT INTO gatherings (title, description, location, starts_at, created_by)
  VALUES (
    ${TITLE},
    'Seed row for the archive sweep. Safe to delete.',
    'Mosque hall',
    ${past.toISOString()},
    ${elder[0].id}
  )
  RETURNING id, starts_at
`;

console.log(`Seeded past gathering: ${g.id} starts_at=${g.starts_at}`);

await sql.end();
