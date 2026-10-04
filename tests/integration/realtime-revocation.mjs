/**
 * Real Realtime revocation checks (follow-up review candidate DS-V04).
 * Local Supabase only. An already-connected subscriber must stop receiving
 * private chamber messages after demotion, and every message after
 * deactivation, without reconnecting. "Not received" is proven by ordering:
 * a later message on a stream the observer may still read arrives first.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { loadTestEnv } from "../../scripts/e2e-env.mjs";

const env = loadTestEnv();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });
let passed = 0;
const check = (condition, label) => { assert.ok(condition, label); passed++; };
const users = [];
const channels = {};
const clients = [];

async function relative(role) {
  const email = `${randomUUID()}@realtime.test`;
  const password = `Rt-${randomBytes(12).toString("hex")}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Could not create a Realtime fixture");
  const memberId = randomUUID();
  users.push(created.data.user.id);
  await sql`insert into public.members(id, auth_user_id, display_name, role) values (${memberId}, ${created.data.user.id}, 'Realtime fixture', ${role})`;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  clients.push(client);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error("Could not sign in a Realtime fixture");
  await client.realtime.setAuth(signedIn.data.session.access_token);
  return { client, memberId };
}

/** Subscribe to one chamber's inserts and resolve once the database stream is live. */
function listen(client, channelId) {
  const received = [];
  const waiters = [];
  const subscription = client.channel(`probe:${channelId}:${randomUUID()}`);
  const ready = new Promise((resolve, reject) => {
    subscription
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` }, (payload) => {
        received.push(payload.new.content);
        waiters.splice(0).forEach((wake) => wake());
      })
      .on("system", {}, (payload) => {
        if (payload.extension === "postgres_changes" && payload.status === "ok") resolve();
        if (payload.extension === "postgres_changes" && payload.status === "error") reject(new Error("Realtime stream failed"));
      })
      .subscribe();
    setTimeout(() => reject(new Error("Realtime stream never became ready")), 20_000);
  });
  const until = (content) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${content}`)), 20_000);
    const test = () => (received.includes(content) ? (clearTimeout(timer), resolve()) : waiters.push(test));
    test();
  });
  return { ready, received, until };
}

/**
 * Round-trip a broadcast on this client's own socket. Frames the server had
 * already queued for the socket (a leaked change included) arrive before it.
 */
async function drain(client) {
  const topic = `echo:${randomUUID()}`;
  const channel = client.channel(topic, { config: { broadcast: { self: true } } });
  const echoed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Echo never returned")), 20_000);
    channel.on("broadcast", { event: "echo" }, () => { clearTimeout(timer); resolve(); });
  });
  await new Promise((resolve) => channel.subscribe((status) => status === "SUBSCRIBED" && resolve()));
  await channel.send({ type: "broadcast", event: "echo", payload: {} });
  await echoed;
  await client.removeChannel(channel);
}

const post = (channel, author, content) =>
  sql`insert into public.messages(channel_id, author_id, content) values (${channels[channel]}, ${author}, ${content})`;

try {
  for (const [name, type] of [["private", "private"], ["general", "general"]]) {
    const [row] = await sql`insert into public.channels(name, slug, type) values ('Realtime probe', ${`rt-${randomUUID()}`}, ${type}) returning id`;
    channels[name] = row.id;
  }
  const elder = await relative("elder");
  const privateObserver = await relative("elder");
  const member = await relative("member");
  const observer = await relative("member");
  const tag = randomUUID().slice(0, 8);

  // Demotion: the former Elder keeps the socket and the general stream.
  const elderPrivate = listen(elder.client, channels.private);
  const elderGeneral = listen(elder.client, channels.general);
  const stillElder = listen(privateObserver.client, channels.private);
  await Promise.all([elderPrivate.ready, elderGeneral.ready, stillElder.ready]);
  await post("private", elder.memberId, `${tag} private before`);
  await elderPrivate.until(`${tag} private before`);
  check(true, "an active Elder receives private chamber messages");
  await sql`update public.members set role = 'member' where id = ${elder.memberId}`;
  await post("private", member.memberId, `${tag} private after demotion`);
  await post("general", member.memberId, `${tag} general marker`);
  // An Elder still entitled to the chamber proves the row really streamed.
  await stillElder.until(`${tag} private after demotion`);
  await elderGeneral.until(`${tag} general marker`);
  await drain(elder.client);
  check(!elderPrivate.received.includes(`${tag} private after demotion`), "a demoted Elder's open subscription stops receiving private messages");
  check(elderGeneral.received.includes(`${tag} general marker`), "the demoted relative still receives chambers they may read");

  // Deactivation: an independent active observer proves the later rows streamed.
  const memberGeneral = listen(member.client, channels.general);
  const observerGeneral = listen(observer.client, channels.general);
  await Promise.all([memberGeneral.ready, observerGeneral.ready]);
  await post("general", observer.memberId, `${tag} general before`);
  await memberGeneral.until(`${tag} general before`);
  await sql`update public.members set is_active = false where id = ${member.memberId}`;
  await post("general", observer.memberId, `${tag} after deactivation`);
  await post("general", observer.memberId, `${tag} later marker`);
  await observerGeneral.until(`${tag} later marker`);
  // The observer proves both rows streamed; the echo on the deactivated
  // member's own socket proves nothing for it was still in flight.
  await drain(member.client);
  check(!memberGeneral.received.includes(`${tag} after deactivation`), "a deactivated member's open subscription stops receiving messages");
  check(!memberGeneral.received.includes(`${tag} later marker`), "nothing streams to a deactivated member afterwards");
  console.log(`PASS: ${passed} real Realtime revocation assertions; fixtures removed.`);
} finally {
  for (const client of clients) await client.removeAllChannels().catch(() => {});
  const ids = Object.values(channels);
  if (ids.length) await sql`delete from public.channels where id in ${sql(ids)}`.catch(() => {});
  if (users.length) await sql`delete from public.members where auth_user_id in ${sql(users)}`.catch(() => {});
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {});
  const [left] = await sql`select (select count(*)::int from auth.users where email like '%@realtime.test') as users,
    (select count(*)::int from public.channels where name = 'Realtime probe') as channels`;
  await sql.end();
  if (left.users || left.channels) {
    console.error("Realtime fixture cleanup incomplete");
    process.exitCode = 1;
  }
}
