import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — see .env.example");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const tables = ["messages", "channels"];

for (const table of tables) {
  // Idempotent: only ADD if not already a member of the publication.
  const existing = await sql`
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = ${table}
  `;
  if (existing.length > 0) {
    console.log(`Already enabled on supabase_realtime: ${table}`);
    continue;
  }
  await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE ${table}`);
  console.log(`Enabled Realtime on: ${table}`);
}

await sql.end();
