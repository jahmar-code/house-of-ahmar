// Disposable recovery rehearsal (follow-up audit OP-01). Local test stack ONLY.
//
// Seeds synthetic history on the prepared E2E stack, backs it up with the real
// backup script, DESTROYS and recreates the stack (every local Supabase volume of
// project_id "house-of-ahmar" on this machine) from the migrations, restores
// with the real restore script, then proves identities, history, photos and the
// Data API/Storage boundaries came back intact. Run after `test:e2e:prepare`;
// it leaves the restored fixtures in place and removes its own rows/objects.
//
//   npm run test:restore      (needs pg_dump/psql for PostgreSQL 17+ on PATH)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { loadTestEnv } from "./e2e-env.mjs";
import { recreateLocalStack } from "./local-stack.mjs";

const env = loadTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const run = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`${script} failed`);
};
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };

const work = mkdtempSync(join(tmpdir(), "hoa-restore-rehearsal-"));
const tag = randomUUID().slice(0, 8);
const seeded = {};
try {
  // ── Seed synthetic history with the shapes recovery must survive ─────────
  let admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  let sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const [member] = await sql`select id, auth_user_id from public.members where email = 'e2e-member@house.local'`;
  const [elder] = await sql`select id from public.members where email = 'e2e-elder@house.local'`;
  const [general] = await sql`select id from public.channels where slug = 'general'`;
  if (!member || !elder || !general) throw new Error("Run npm run test:e2e:prepare first.");
  seeded.photo = `${member.id}/rehearsal-${tag}.png`;
  seeded.avatar = `avatars/${member.id}/rehearsal-${tag}.png`;
  seeded.archive = `rehearsal-${tag}/archive.png`;
  for (const [bucket, path] of [["feed-media", seeded.photo], ["feed-media", seeded.avatar], ["archives", seeded.archive]]) {
    const { error } = await admin.storage.from(bucket).upload(path, PNG, { contentType: "image/png" });
    if (error) throw new Error("Could not seed a rehearsal object");
  }
  const [post] = await sql`insert into public.posts(author_id, type, content, media_urls)
    values (${member.id}, 'photo', ${`Rehearsal ${tag}`}, ${sql.json([`/api/media/feed-media/${seeded.photo}`])}) returning id`;
  seeded.post = post.id;
  await sql`insert into public.comments(post_id, author_id, content) values (${post.id}, ${elder.id}, 'Rehearsal comment')`;
  await sql`insert into public.reactions(post_id, member_id, emoji) values (${post.id}, ${elder.id}, 'heart')`;
  // A parent rewritten after its reply sits physically after it in the table:
  // the restore must not depend on row order for self-references.
  const [parent] = await sql`insert into public.messages(channel_id, author_id, content) values (${general.id}, ${member.id}, ${`Parent ${tag}`}) returning id`;
  const [reply] = await sql`insert into public.messages(channel_id, author_id, content, reply_to_id) values (${general.id}, ${elder.id}, ${`Reply ${tag}`}, ${parent.id}) returning id`;
  await sql`update public.messages set updated_at = now() where id = ${parent.id}`;
  const [tombstone] = await sql`insert into public.messages(channel_id, author_id, content, is_deleted) values (${general.id}, ${member.id}, '', true) returning id`;
  Object.assign(seeded, { parent: parent.id, reply: reply.id, tombstone: tombstone.id });
  const [gathering] = await sql`insert into public.gatherings(title, starts_at, created_by) values (${`Rehearsal ${tag}`}, now() + interval '30 days', ${member.id}) returning id`;
  await sql`insert into public.rsvps(gathering_id, member_id, status) values (${gathering.id}, ${elder.id}, 'attending')`;
  seeded.gathering = gathering.id;
  await sql`update public.members set avatar_url = ${`/api/media/feed-media/${seeded.avatar}`} where id = ${member.id}`;
  await sql`insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata) values (${elder.id}, 'post.pinned', 'post', ${post.id}, ${sql.json({ authorId: member.id })})`;
  const before = {
    userId: member.auth_user_id,
    members: (await sql`select id, auth_user_id, role from public.members order by id`).map((r) => `${r.id}:${r.auth_user_id}:${r.role}`),
  };
  await sql.end();

  // ── Back up with the real script ────────────────────────────────────────
  run("scripts/backup.mjs", ["--env", ".env.e2e.local", "--out", work]);
  const [backup] = readdirSync(work);
  const backupDir = join(work, backup);

  // ── Destroy and recreate the target from the versioned migrations ───────
  console.log("Recreating the disposable stack from migrations (restore target)...");
  const status = recreateLocalStack();
  const keys = { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY };
  if (keys.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || keys.SUPABASE_SERVICE_ROLE_KEY !== env.SUPABASE_SERVICE_ROLE_KEY) {
    // Keep the generated test configuration usable for later browser runs.
    Object.assign(env, keys);
    const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "NEXT_PUBLIC_SITE_URL", "HOA_DEFAULT_ACCESS_CODE", "E2E_PASSWORD"];
    writeFileSync(".env.e2e.local", names.map((key) => `${key}=${JSON.stringify(env[key])}`).join("\n") + "\n", { mode: 0o600 });
  }
  sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const [{ users }] = await sql`select count(*)::int as users from auth.users`;
  check(users === 0, "restore target starts without identities");
  await sql.end();

  // ── Restore with the real script (fails on any SQL error) ───────────────
  run("scripts/restore.mjs", ["--from", backupDir, "--env", ".env.e2e.local", "--confirm-target", "127.0.0.1:55322"]);

  // ── Prove the House came back, through real client boundaries ───────────
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const after = (await sql`select id, auth_user_id, role from public.members order by id`).map((r) => `${r.id}:${r.auth_user_id}:${r.role}`);
  check(JSON.stringify(after) === JSON.stringify(before.members), "member IDs, Auth linkage and roles preserved");
  const [replyRow] = await sql`select reply_to_id from public.messages where id = ${seeded.reply}`;
  check(replyRow?.reply_to_id === seeded.parent, "reply thread preserved");
  const [tombstoneRow] = await sql`select is_deleted, content from public.messages where id = ${seeded.tombstone}`;
  check(tombstoneRow?.is_deleted && tombstoneRow.content === "", "deleted message stays a content-free tombstone");
  const [{ rls }] = await sql`select bool_and(relrowsecurity) as rls from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`;
  check(rls, "every restored table keeps RLS");

  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const signedIn = await client.auth.signInWithPassword({ email: "e2e-member@house.local", password: env.E2E_PASSWORD });
  check(!signedIn.error && signedIn.data.user?.id === before.userId, "restored identity signs in with its original password and ID");
  const photo = await client.storage.from("feed-media").download(seeded.photo);
  check(!photo.error && sha(Buffer.from(await photo.data.arrayBuffer())) === sha(PNG), "restored photo downloads through the member's own session");
  const signing = await client.storage.from("feed-media").createSignedUrl(seeded.photo, 60);
  check(Boolean(signing.error), "restored House still refuses signed URLs");
  const messages = await client.from("messages").select("id, reply_to_id").eq("channel_id", (await sql`select id from public.channels where slug = 'general'`)[0].id);
  check(!messages.error && messages.data.some((m) => m.id === seeded.reply && m.reply_to_id === seeded.parent), "Council history readable through the Data API");
  const pii = await client.from("members").select("email");
  check(Boolean(pii.error) || (pii.data ?? []).every((row) => row.email === undefined), "restored grants keep member contact columns closed");
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const anonMessages = await anon.from("messages").select("id");
  check(Boolean(anonMessages.error) || anonMessages.data.length === 0, "anonymous visitors read no messages");
  const anonPhoto = await anon.storage.from("feed-media").download(seeded.photo);
  check(Boolean(anonPhoto.error), "anonymous visitors cannot download restored photos");
  await sql.end();

  // The policy suites create their own fixtures against the restored target.
  run("tests/integration/database-security.mjs", []);
  run("tests/integration/storage-media.mjs", []);
  run("tests/integration/realtime-revocation.mjs", []);
  console.log(`PASS: restore rehearsal — ${passed} recovery assertions plus the policy suites on the restored target.`);
} finally {
  // Remove the rehearsal's own synthetic history, wherever the run stopped.
  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  try {
    if (seeded.post) await sql`delete from public.audit_logs where entity_id = ${seeded.post}`;
    if (seeded.post) await sql`delete from public.posts where id = ${seeded.post}`;
    if (seeded.gathering) await sql`delete from public.gatherings where id = ${seeded.gathering}`;
    for (const id of [seeded.reply, seeded.parent, seeded.tombstone].filter(Boolean)) await sql`delete from public.messages where id = ${id}`;
    await sql`update public.members set avatar_url = null where avatar_url like ${`%rehearsal-${tag}%`}`;
  } catch { /* the stack may be mid-recreation; prepare again in that case */ }
  await sql.end().catch(() => {});
  for (const [bucket, path] of [["feed-media", seeded.photo], ["feed-media", seeded.avatar], ["archives", seeded.archive]]) {
    if (path) await admin.storage.from(bucket).remove([path]).catch(() => {});
  }
  rmSync(work, { recursive: true, force: true });
}
