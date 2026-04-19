import { config } from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create the auth user via admin API (idempotent enough for our purposes)
const email = "deactivated-member@hotseat.dev";
let userId;

const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const existing = list.data.users.find((u) => u.email === email);
if (existing) {
  userId = existing.id;
  console.log(`Auth user already present: ${email} (${userId})`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "deactivated1234!",
    email_confirm: true,
  });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`Created auth user: ${email} (${userId})`);
}

const sql = postgres(dbUrl, { ssl: "require" });

const existingMember = await sql`
  SELECT id, is_active FROM members WHERE auth_user_id = ${userId}
`;

if (existingMember.length === 0) {
  const inserted = await sql`
    INSERT INTO members (auth_user_id, display_name, full_name, email, role, is_active)
    VALUES (${userId}, 'Deactivated Cousin', 'Deactivated Cousin', ${email}, 'member', false)
    RETURNING id
  `;
  console.log(`Inserted deactivated member: ${inserted[0].id}`);
} else if (existingMember[0].is_active) {
  await sql`UPDATE members SET is_active = false WHERE auth_user_id = ${userId}`;
  console.log(`Deactivated existing member: ${existingMember[0].id}`);
} else {
  console.log(`Member already deactivated: ${existingMember[0].id}`);
}

await sql.end();
