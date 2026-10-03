// Read-only debug: the ten most recent Council messages, for diagnosing whether
// a send actually landed in Postgres when Realtime looks stuck.
//
//   node scripts/check-messages.mjs                # metadata only (default)
//   node scripts/check-messages.mjs --with-content # includes what people wrote
//
// ⚠️  --with-content prints private family conversation — including the Elders'
//     private chamber — to your terminal, where it lands in scrollback and shell
//     history. Only use it when you are genuinely debugging content, never as a
//     habit.
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing — see .env.example");
  process.exit(1);
}

const withContent = process.argv.includes("--with-content");

const sql = postgres(url, { ssl: "require" });

const msgs = await sql`
  SELECT m.id, m.content, m.channel_id, c.slug AS channel, m.author_id,
         m.is_deleted, m.reply_to_id, m.created_at
  FROM messages m
  LEFT JOIN channels c ON c.id = m.channel_id
  ORDER BY m.created_at DESC
  LIMIT 10
`;

console.log(
  JSON.stringify(
    msgs.map(({ content, ...rest }) => ({
      ...rest,
      content: withContent ? content : `<${content?.length ?? 0} chars hidden>`,
    })),
    null,
    2
  )
);

await sql.end();
