import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

const msgs = await sql`
  SELECT id, content, channel_id, author_id, is_deleted, reply_to_id, created_at
  FROM messages
  ORDER BY created_at DESC
  LIMIT 10
`;
console.log(JSON.stringify(msgs, null, 2));

await sql.end();
