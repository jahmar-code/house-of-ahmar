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
    // Upgrade path: replay the security migrations, in order, over existing data.
    for (const file of ["20261003175118_security_and_private_media.sql", "20261003200000_operation_aware_media.sql"]) {
      await sql.unsafe(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
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
      // Storage runs each request with its operation name in this setting.
      // Only download/info may read House objects; signing never may (DS-01).
      const objectName = `${roles.member.memberId}/${randomUUID()}-policy.png`;
      await tx`insert into storage.objects(bucket_id,name) values ('feed-media',${objectName}), ('archives',${objectName})`;
      const visible = (role, operation, bucket = "feed-media") => asRole(role, async (sp) => {
        await sp`select set_config('storage.operation', ${operation}, true)`;
        const rows = await sp`select 1 from storage.objects where bucket_id = ${bucket} and name = ${objectName}`;
        return rows.length === 1;
      });
      const READS = ["storage.object.get_authenticated", "object.get_authenticated_info", "object.head_authenticated_info"];
      // Outside the allow-list; the real Storage server proves the main ones in storage-media.mjs.
      const REFUSED = ["storage.object.sign", "storage.object.sign_many", "storage.object.list", "storage.object.list_v2", "storage.object.copy", "storage.render.image_authenticated", "storage.s3.object.get", ""];
      const unsetVisible = (role) => asRole(role, async (sp) => {
        await sp.unsafe("reset storage.operation");
        return (await sp`select 1 from storage.objects where bucket_id = 'feed-media' and name = ${objectName}`).length === 1;
      });
      const mediaOperations = async (stage) => {
        for (const role of ["member", "guest", "elder", "inactive", "outsider"]) {
          const allowed = ["member", "guest", "elder"].includes(role);
          check(!(await unsetVisible(role)), `${stage}: ${role} refused with no Storage operation`);
          for (const operation of READS) check(await visible(role, operation) === allowed, `${stage}: ${role} ${operation} scope`);
          for (const operation of REFUSED) check(!(await visible(role, operation)), `${stage}: ${role} refused ${operation || "unset operation"}`);
          check(await visible(role, READS[0], "archives") === (role === "elder"), `${stage}: ${role} archives download scope`);
          check(!(await visible(role, "storage.object.sign", "archives")), `${stage}: ${role} cannot sign archives`);
        }
      };
      await mediaOperations("House policies");
      await tx.savepoint(async (sp) => {
        await sp`create policy hoa_legacy_open_read on storage.objects for select to authenticated using (true)`;
        await mediaOperations("with legacy permissive policy");
        throw new Error("POLICY_ROLLBACK");
      }).catch((error) => { if (error.message !== "POLICY_ROLLBACK") throw error; });
      const uploadAs = async (operation, name) => {
        try {
          await asRole("member", async (sp) => {
            await sp`select set_config('storage.operation', ${operation}, true)`;
            await sp`insert into storage.objects(bucket_id,name) values ('feed-media',${name})`;
          });
          return true;
        } catch (error) { if (error.code === "42501") return false; throw error; }
      };
      check(await uploadAs("storage.object.upload", `${roles.member.memberId}/${randomUUID()}-own.png`), "member direct upload into own namespace");
      check(!(await uploadAs("storage.object.sign_upload_url", `${roles.member.memberId}/${randomUUID()}-own.png`)), "member cannot mint signed upload URLs");
      check(!(await uploadAs("storage.tus.upload.create", `${roles.member.memberId}/${randomUUID()}-own.png`)), "member cannot start unmanaged resumable uploads");
      // Replaying 175118 alone would bring back operation-blind guards.
      const [guard] = await tx`select pg_get_expr(polqual, polrelid) as expr from pg_policy
        where polrelid = 'storage.objects'::regclass and polname = 'house_media_read_guard'`;
      check(guard?.expr.includes("is_media_read_operation"), "media read guard is operation-aware");
      // No client may flip a House bucket public (that bypasses object RLS),
      // even beside a broad legacy bucket policy.
      await tx.savepoint(async (sp) => {
        await sp`create policy hoa_legacy_bucket_read on storage.buckets for select to authenticated using (true)`;
        await sp`create policy hoa_legacy_bucket_write on storage.buckets for update to authenticated using (true) with check (true)`;
        const flip = (role) => asRole(role, (rp) => rp`update storage.buckets set public = true where id in ('feed-media','archives','avatars') returning id`);
        for (const role of ["elder", "member"]) {
          check((await flip(role)).length === 0, `${role} cannot make a House bucket public`);
        }
        // Control: the same legacy policies DO flip buckets once the guard is gone.
        await sp.savepoint(async (control) => {
          await control`drop policy house_bucket_update_guard on storage.buckets`;
          check((await flip("member")).length === 3, "bucket guard, not a missing grant, is what refuses the flip");
          throw new Error("CONTROL_ROLLBACK");
        }).catch((error) => { if (error.message !== "CONTROL_ROLLBACK") throw error; });
        throw new Error("POLICY_ROLLBACK");
      }).catch((error) => { if (error.message !== "POLICY_ROLLBACK") throw error; });
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
