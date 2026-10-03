/** Real PostgreSQL authorization checks. Local Supabase only; all fixtures roll back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(databaseUrl).hostname) || new URL(databaseUrl).port !== "55322") {
  throw new Error("Refusing database security fixtures outside local Supabase");
}
const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };
try {
  if (process.argv.includes("--reapply")) {
    await sql.unsafe(await readFile(new URL("../../supabase/migrations/20261003175118_security_and_private_media.sql", import.meta.url), "utf8"));
  }
  try {
    await sql.begin(async (tx) => {
      const roles = {};
      for (const role of ["elder", "member", "guest", "inactive", "outsider"]) {
        const userId = randomUUID(); const memberId = randomUUID();
        roles[role] = { userId, memberId };
        await tx`insert into auth.users(id,aud,role,email) values (${userId},'authenticated','authenticated',${`${userId}@security.test`})`;
        if (role !== "outsider") {
          await tx`insert into public.members(id,auth_user_id,display_name,role,is_active) values (${memberId},${userId},'Security fixture',${role === "inactive" ? "member" : role},${role !== "inactive"})`;
        }
      }
      const publicChannel = randomUUID(); const privateChannel = randomUUID(); const archivedChannel = randomUUID();
      for (const [id, type, archived] of [[publicChannel, "general", false], [privateChannel, "private", false], [archivedChannel, "general", true]]) {
        await tx`insert into public.channels(id,name,slug,type,is_archived) values (${id},'Security fixture',${id},${type},${archived})`;
        await tx`insert into public.messages(channel_id,author_id,content) values (${id},${roles.elder.memberId},'Fixture only')`;
      }
      const asRole = async (role, fn) => tx.savepoint(async (sp) => {
        await sp`select set_config('request.jwt.claims', ${JSON.stringify({ sub: roles[role]?.userId ?? "", role: role === "anon" ? "anon" : "authenticated" })}, true)`;
        await sp.unsafe(`set local role ${role === "anon" ? "anon" : "authenticated"}`);
        const result = await fn(sp);
        await sp.unsafe("reset role");
        return result;
      });
      const denied = async (role, query, label) => {
        let rejected = false;
        try { await asRole(role, (sp) => sp.unsafe(query)); } catch (error) { rejected = error.code === "42501"; }
        check(rejected, label);
      };
      const tables = await tx`select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'`;
      check(tables.length === 14 && tables.every((t) => t.relrowsecurity), "All 14 application tables have RLS");
      for (const role of ["anon", "member", "outsider"]) {
        await denied(role, "select code from public.access_codes", `${role} cannot read invite codes`);
        await denied(role, "select email from public.members", `${role} cannot read member PII`);
        await denied(role, "update public.members set role='elder' where false", `${role} cannot write roles`);
      }
      for (const role of ["member", "guest", "elder", "inactive", "outsider"]) {
        const rows = await asRole(role, (sp) => sp`select channel_id from public.messages where channel_id in (${publicChannel},${privateChannel},${archivedChannel})`);
        const expected = role === "elder" ? [privateChannel, publicChannel] : ["member", "guest"].includes(role) ? [publicChannel] : [];
        check(JSON.stringify(rows.map((r) => r.channel_id).sort()) === JSON.stringify(expected.sort()), `${role} Council RLS scope`);
      }
      await denied("member", "select id from public.channels", "Council helper does not require widening channels grants");
      for (const role of ["outsider", "inactive"]) {
        const rows = await asRole(role, (sp) => sp`select id,display_name from public.members`);
        check(rows.length === 0, `${role} cannot hydrate bylines`);
      }
      for (const role of ["member", "guest", "elder", "inactive", "outsider"]) {
        const own = roles[role].memberId;
        const [read] = await asRole(role, (sp) => sp`select private.can_read_media('feed-media') as feed, private.can_read_media('archives') as archives`);
        check(read.feed === ["member", "guest", "elder"].includes(role), `${role} media read scope`);
        check(read.archives === (role === "elder"), `${role} retained archives scope`);
        const [result] = await asRole(role, (sp) => sp`select
          private.can_upload_media('feed-media', ${`${own}/file.jpg`}) as feed,
          private.can_upload_media('feed-media', ${`avatars/${own}/file.jpg`}) as avatar,
          private.can_upload_media('feed-media', ${`avatars/${randomUUID()}/file.jpg`}) as other`);
        check(result.feed === ["member", "elder"].includes(role), `${role} feed upload scope`);
        check(result.avatar === ["member", "elder", "guest"].includes(role), `${role} avatar upload scope`);
        check(result.other === false, `${role} cannot upload another member avatar`);
      }
      const buckets = await tx`select id,public,file_size_limit from storage.buckets where id in ('feed-media','archives','avatars')`;
      check(buckets.length === 3 && buckets.every((b) => !b.public && b.file_size_limit > 0), "All House buckets private and bounded");
      const publicDefiners = await tx`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')`;
      check(publicDefiners.length === 0, "No anonymous public SECURITY DEFINER endpoints");
      // Always roll fixtures back, even after all assertions succeed.
      throw new Error("FIXTURE_ROLLBACK");
    });
  } catch (error) { if (error.message !== "FIXTURE_ROLLBACK") throw error; }
  console.log(`PASS: ${passed} real PostgreSQL security assertions; fixtures rolled back.`);
} finally { await sql.end(); }
