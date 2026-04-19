import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/confirm-test-user.mjs <email>");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (error) {
  console.error(error);
  process.exit(1);
}

const user = data.users.find((u) => u.email === email);
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

if (user.email_confirmed_at) {
  console.log(`Already confirmed: ${user.email} (${user.id})`);
  process.exit(0);
}

const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
  email_confirm: true,
});
if (upErr) {
  console.error(upErr);
  process.exit(1);
}
console.log(`Confirmed: ${user.email} (${user.id})`);
