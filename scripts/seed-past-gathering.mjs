import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const elder = await sql`SELECT id FROM members WHERE role = 'elder' LIMIT 1`;
if (!elder.length) {
  console.error("No elder found");
  process.exit(1);
}

const past = new Date();
past.setDate(past.getDate() - 14);

const [g] = await sql`
  INSERT INTO gatherings (title, description, location, starts_at, created_by)
  VALUES (
    'Old Iftar (14 days ago)',
    'Past gathering for archive sweep test',
    'Mosque hall',
    ${past.toISOString()},
    ${elder[0].id}
  )
  RETURNING id, starts_at
`;

console.log(`Past gathering: ${g.id} starts_at=${g.starts_at}`);

await sql.end();
