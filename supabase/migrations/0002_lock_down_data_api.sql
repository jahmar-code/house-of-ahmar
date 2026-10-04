-- 0002_lock_down_data_api.sql
--
-- SECURITY (launch-blocker fix). House of Ahmar reaches its database ONLY through
-- DATABASE_URL (the owner role, which bypasses RLS + grants). But sign-up is open
-- and the Supabase publishable key ships in the browser bundle, so ANY visitor can
-- get an `authenticated` session and hit the PostgREST/Realtime Data API directly.
-- With 0001 leaving RLS off everywhere except messages/channels, that let a client
-- read access_codes (defeating the invite gate), exfiltrate all member PII, and even
-- PATCH their own members.role to 'elder'. This migration denies the Data API by
-- default and re-opens ONLY the minimal read the Council realtime feature needs.
--
-- Historical note: this header once suggested `supabase db push` and
-- `drizzle-kit push`. Neither is a supported route to an existing House; follow
-- docs/pkm/50-operations/migration-runbook.md (comment-only change, 2026-10-03).
-- Verify afterwards: an authenticated client GET /rest/v1/access_codes and
-- /rest/v1/members?select=email returns nothing/403, and Council chat streams.

begin;

-- 1) Deny-by-default: strip all direct table/sequence/routine access from the
--    browser-facing roles, now and for any future objects.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines  in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 2) Enable RLS on every table (defense in depth — with no policy, the client
--    roles are denied even if a grant is ever re-added by mistake). The owner
--    role behind DATABASE_URL is exempt, so the app is unaffected.
--
--    Order-independent: `member_relationships` and `audit_logs` were added by
--    `drizzle-kit push` and do not exist in 0001, so a plain ALTER would abort
--    this transaction on a clean rebuild and silently roll back the ENTIRE
--    lockdown (grants intact, RLS off). Skip a table that is not there yet
--    rather than losing everything — the loop covers it on the next run.
--    ⚠️  Verify after any rebuild: `select relname, relrowsecurity from pg_class
--        where relnamespace = 'public'::regnamespace and relkind = 'r';`
do $$
declare t text;
begin
  foreach t in array array[
    'members', 'access_codes', 'posts', 'comments', 'reactions',
    'gatherings', 'rsvps', 'channels', 'messages', 'albums', 'photos',
    'house_settings', 'member_relationships', 'audit_logs'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    else
      raise warning
        '[0002] table public.% does not exist yet — RLS NOT enabled. Run drizzle-kit push, then re-run this migration.', t;
    end if;
  end loop;
end $$;

-- 3) Remove 0001's over-permissive policies (membership-only, no channel-type
--    check, and a client INSERT the app never uses — writes go via server actions).
drop policy if exists members_read_messages   on public.messages;
drop policy if exists members_insert_messages  on public.messages;
drop policy if exists members_read_channels    on public.channels;

-- 4) SECURITY DEFINER helpers. They query members as the owner, so a policy ON
--    members that calls them does NOT recurse into members' own RLS.
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where auth_user_id = auth.uid() and is_active
  );
$$;

create or replace function public.is_active_elder()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where auth_user_id = auth.uid() and is_active and role = 'elder'
  );
$$;

revoke all on function public.is_active_member() from anon, authenticated;
revoke all on function public.is_active_elder()  from anon, authenticated;

-- 5) Minimal client grants — the Council realtime feature is the ONLY thing the
--    browser reads via the Data API.

-- members: expose ONLY the non-PII columns a chat message renders (name/avatar/
--    role). email, phone, bio, birthday, auth_user_id, last_seen_at stay hidden.
grant select (id, display_name, avatar_url, role) on public.members to authenticated;
drop policy if exists members_client_read on public.members;
create policy members_client_read on public.members
  for select to authenticated
  using (public.is_active_member());

-- messages: realtime read only (no insert/update/delete grant — the app writes
--    via server actions over DATABASE_URL). Private chambers are elder-only.
grant select on public.messages to authenticated;
drop policy if exists messages_client_read on public.messages;
create policy messages_client_read on public.messages
  for select to authenticated
  using (
    public.is_active_member()
    and (
      public.is_active_elder()
      or not exists (
        select 1 from public.channels c
        where c.id = messages.channel_id and c.type = 'private'
      )
    )
  );

-- (channels, access_codes, posts, comments, reactions, gatherings, rsvps, albums,
--  photos, house_settings, member_relationships, audit_logs get NO client grant
--  and NO policy → fully denied to anon/authenticated via the Data API.)

-- 6) Provisioning completeness — make one artifact yield a working prod DB even
--    when tables came from `drizzle-kit push` (which never runs the 0001 SQL).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'members_auth_user_id_fkey') then
    alter table public.members
      add constraint members_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

insert into public.channels (name, slug, description, type, sort_order) values
  ('General',       'general',       'Open family chat',              'general',      0),
  ('Announcements', 'announcements', 'Important House updates',       'announcement', 1),
  ('Elders Only',   'elders-only',   'Private discussions for Elders','private',      2)
on conflict (slug) do nothing;

commit;
