import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require" });

const seeds = [
  { name: "General", slug: "general", description: "Open discussion for the family", type: "general", sort_order: 0 },
  { name: "Announcements", slug: "announcements", description: "Important family announcements", type: "announcement", sort_order: 1 },
  { name: "Elders Only", slug: "elders-only", description: "Private discussions for Elders", type: "private", sort_order: 2 },
];

for (const c of seeds) {
  await sql`
    INSERT INTO channels (name, slug, description, type, sort_order)
    VALUES (${c.name}, ${c.slug}, ${c.description}, ${c.type}, ${c.sort_order})
    ON CONFLICT (slug) DO NOTHING;
  `;
  console.log(`Ensured channel: ${c.slug}`);
}

await sql.end();
