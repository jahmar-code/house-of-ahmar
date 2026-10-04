/**
 * Real Storage API trust-boundary checks (DS-01). Local Supabase only.
 *
 * Signs in dedicated synthetic identities, then exercises the actual Storage
 * HTTP operations a browser session can call directly — not just the app's
 * media proxy. Every fixture (Auth user, member row, object, test policy) is
 * removed in `finally`. Nothing is printed except check labels and counts.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { loadTestEnv } from "../../scripts/e2e-env.mjs";

const env = loadTestEnv();
const api = env.NEXT_PUBLIC_SUPABASE_URL;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(api, env.SUPABASE_SERVICE_ROLE_KEY, options);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
// A 1×1 PNG: real image bytes, no family content.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const LEGACY_POLICY = "hoa_test_legacy_open_read";
const CONTROL_POLICY = "hoa_test_sign_control";
const CONTROL_BUCKET = `hoa-sign-control-${randomUUID().slice(0, 8)}`;

let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };
const identities = {};
const objects = [];

async function identity(role) {
  const password = `Media-${randomBytes(12).toString("hex")}`;
  const email = `${randomUUID()}@media.test`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Could not create ${role} fixture`);
  const userId = created.data.user.id;
  const memberId = randomUUID();
  identities[role] = { userId, memberId };
  if (role !== "outsider") {
    await sql`insert into public.members(id,auth_user_id,display_name,role,is_active)
      values (${memberId},${userId},'Media fixture',${role === "inactive" ? "member" : role},true)`;
  }
  const client = createClient(api, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`Could not sign in ${role} fixture`);
  identities[role].client = client;
  return identities[role];
}

async function upload(client, bucket, path) {
  const { error } = await client.storage.from(bucket).upload(path, PNG, { contentType: "image/png", upsert: false });
  if (!error) objects.push({ bucket, path });
  return !error;
}

async function canDownload(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path);
  return !error && Buffer.from(await data.arrayBuffer()).equals(PNG);
}

async function canSign(client, bucket, path) {
  const single = await client.storage.from(bucket).createSignedUrl(path, 60);
  const many = await client.storage.from(bucket).createSignedUrls([path], 60);
  const manyUrls = !many.error && (many.data ?? []).some((entry) => entry.signedUrl && !entry.error);
  return { single: !single.error && Boolean(single.data?.signedUrl), many: manyUrls };
}

try {
  for (const role of ["elder", "member", "guest", "inactive", "outsider"]) await identity(role);
  const anon = createClient(api, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const { member, guest, elder, inactive, outsider } = identities;

  // Ownership-constrained uploads through the real Storage insert path.
  const post = `${member.memberId}/${randomUUID()}-fixture.png`;
  const avatar = `avatars/${guest.memberId}/${randomUUID()}-fixture.png`;
  const inactivePost = `${inactive.memberId}/${randomUUID()}-fixture.png`;
  check(await upload(member.client, "feed-media", post), "member uploads into own Wall namespace");
  check(await upload(guest.client, "feed-media", avatar), "guest uploads own portrait");
  check(await upload(inactive.client, "feed-media", inactivePost), "member uploads before deactivation");
  check(!(await upload(member.client, "feed-media", `${elder.memberId}/${randomUUID()}-x.png`)), "member cannot upload into another member namespace");
  check(!(await upload(guest.client, "feed-media", `${guest.memberId}/${randomUUID()}-x.png`)), "guest cannot upload Wall media");
  check(!(await upload(member.client, "feed-media", `avatars/${elder.memberId}/${randomUUID()}-x.png`)), "member cannot replace another portrait");
  check(!(await upload(elder.client, "archives", `${elder.memberId}/${randomUUID()}-x.png`)), "client sessions cannot upload into retained Archives");
  const signedUpload = await member.client.storage.from("feed-media").createSignedUploadUrl(`${member.memberId}/${randomUUID()}-x.png`);
  check(Boolean(signedUpload.error), "client sessions cannot mint signed upload URLs");
  // Archives has no upload UI; seed its retained-media scope as an operator would.
  const archive = `${randomUUID()}/fixture.png`;
  const seeded = await admin.storage.from("archives").upload(archive, PNG, { contentType: "image/png" });
  if (seeded.error) throw new Error("Could not seed archive fixture");
  objects.push({ bucket: "archives", path: archive });

  await sql`update public.members set is_active = false where id = ${inactive.memberId}`;

  // Authenticated download: the operation the user-scoped media proxy uses.
  for (const [role, expected] of [["elder", true], ["member", true], ["guest", true], ["inactive", false], ["outsider", false]]) {
    check(await canDownload(identities[role].client, "feed-media", post) === expected, `${role} Wall media download scope`);
    check(await canDownload(identities[role].client, "feed-media", avatar) === expected, `${role} portrait download scope`);
    check(await canDownload(identities[role].client, "archives", archive) === (role === "elder"), `${role} retained Archives scope`);
  }
  check(!(await canDownload(inactive.client, "feed-media", inactivePost)), "deactivated uploader loses access to own earlier upload");
  check(!(await canDownload(anon, "feed-media", post)), "anonymous download denied");
  const info = await member.client.storage.from("feed-media").exists(post);
  check(info.data === true, "member can inspect an object it may download");

  async function noSigning(stage) {
    for (const role of ["elder", "member", "guest", "inactive", "outsider"]) {
      for (const [bucket, path] of [["feed-media", post], ["feed-media", avatar], ["archives", archive]]) {
        const signed = await canSign(identities[role].client, bucket, path);
        check(!signed.single, `${stage}: ${role} cannot sign ${bucket}`);
        check(!signed.many, `${stage}: ${role} cannot batch-sign ${bucket}`);
      }
    }
    const anonSigned = await canSign(anon, "feed-media", post);
    check(!anonSigned.single && !anonSigned.many, `${stage}: anonymous cannot sign`);
  }
  await noSigning("current policies");

  // Positive control: the same client CAN sign in a bucket its policies allow,
  // so the refusals above come from the House guards, not a broken sign route.
  const control = await admin.storage.createBucket(CONTROL_BUCKET, { public: false });
  if (control.error) throw new Error("Could not create the signing control bucket");
  await admin.storage.from(CONTROL_BUCKET).upload("control.png", PNG, { contentType: "image/png" });
  objects.push({ bucket: CONTROL_BUCKET, path: "control.png" });
  await sql.unsafe(`create policy ${CONTROL_POLICY} on storage.objects for select to authenticated using (bucket_id = '${CONTROL_BUCKET}')`);
  const controlSigned = await canSign(member.client, CONTROL_BUCKET, "control.png");
  check(controlSigned.single && controlSigned.many, "signing works where policies allow it (control)");

  // Copy/move would mint a new object from a House photo outside the proxy.
  const copied = await member.client.storage.from("feed-media").copy(post, `${member.memberId}/${randomUUID()}-copy.png`);
  check(Boolean(copied.error), "members cannot copy House photos through Storage");
  const moved = await member.client.storage.from("feed-media").move(post, `${member.memberId}/${randomUUID()}-moved.png`);
  check(Boolean(moved.error), "members cannot move House photos through Storage");
  check(await canDownload(member.client, "feed-media", post), "the photo stays where it was");

  // An older manual setup may have left a broad permissive read policy. The
  // restrictive guard must still refuse signing and inactive/outsider reads.
  await sql.unsafe(`create policy ${LEGACY_POLICY} on storage.objects for select to authenticated using (true)`);
  await noSigning("legacy permissive policy");
  check(!(await canDownload(inactive.client, "feed-media", post)), "legacy policy cannot revive deactivated access");
  check(!(await canDownload(outsider.client, "feed-media", post)), "legacy policy cannot admit an outsider");
  check(!(await canDownload(member.client, "archives", archive)), "legacy policy cannot widen Archives");
  check(await canDownload(member.client, "feed-media", post), "legacy policy leaves member downloads working");
  const listed = await member.client.storage.from("feed-media").list(member.memberId);
  check(!listed.error && (listed.data ?? []).length === 0, "listing House object names is not a browser operation");

  console.log(`PASS: ${passed} real Storage API media-boundary assertions; fixtures removed.`);
} finally {
  await sql.unsafe(`drop policy if exists ${LEGACY_POLICY} on storage.objects`).catch(() => {});
  await sql.unsafe(`drop policy if exists ${CONTROL_POLICY} on storage.objects`).catch(() => {});
  for (const { bucket, path } of objects) await admin.storage.from(bucket).remove([path]).catch(() => {});
  await admin.storage.deleteBucket(CONTROL_BUCKET).catch(() => {});
  const memberIds = Object.values(identities).map((i) => i.memberId);
  if (memberIds.length) await sql`delete from public.members where id in ${sql(memberIds)}`.catch(() => {});
  for (const { userId } of Object.values(identities)) await admin.auth.admin.deleteUser(userId).catch(() => {});
  const names = objects.map((object) => object.path);
  const [left] = await sql`select
    (select count(*)::int from auth.users where email like '%@media.test') as users,
    (select count(*)::int from storage.objects where name = any(${names}::text[])) as objects,
    (select count(*)::int from pg_policy where polname in (${LEGACY_POLICY}, ${CONTROL_POLICY})) as policies,
    (select count(*)::int from storage.buckets where id = ${CONTROL_BUCKET}) as buckets`;
  await sql.end();
  if (left.users || left.objects || left.policies || left.buckets) {
    console.error("Storage fixture cleanup incomplete");
    process.exitCode = 1;
  }
}
