-- Complete the historical baseline, repair Council RLS, and protect family media.
-- Fresh database: apply all migrations in order. Existing schema-first database:
-- apply 0002, 0003, 0004, then this migration; never replay 0001 over live tables.
-- Deploy the matching /api/media application code before switching live buckets.
begin;
set local lock_timeout = '5s';

-- These were originally created only by drizzle-kit push. A clean migration
-- replay must reproduce the actual application schema without an extra tool.
alter table public.gatherings add column if not exists archived_at timestamptz;
create table if not exists public.member_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.members(id) on delete cascade,
  child_id uuid not null references public.members(id) on delete cascade,
  created_by uuid references public.members(id),
  created_at timestamptz not null default now(),
  constraint member_relationships_no_self_ck check (parent_id <> child_id)
);
create unique index if not exists member_relationships_unique_idx on public.member_relationships(parent_id, child_id);
create index if not exists member_relationships_child_idx on public.member_relationships(child_id);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.members(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
alter table public.member_relationships enable row level security;
alter table public.audit_logs enable row level security;
revoke all on public.member_relationships, public.audit_logs from public, anon, authenticated;
revoke all on all tables in schema public from public;

-- The legacy baseline named this FK correctly but omitted ON DELETE SET NULL.
do $$ begin
  if exists (select 1 from pg_constraint where conrelid='public.messages'::regclass
    and conname='messages_reply_to_id_fkey' and confdeltype <> 'n') then
    alter table public.messages drop constraint messages_reply_to_id_fkey;
    alter table public.messages add constraint messages_reply_to_id_fkey
      foreign key(reply_to_id) references public.messages(id) on delete set null;
  end if;
end $$;

-- Every routine gets PUBLIC execute by default in Postgres; revoking only the
-- named API roles does not remove that inherited permission.
revoke all on all routines in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Narrow SECURITY DEFINER functions are required to look up membership without
-- recursive members RLS. No caller-controlled user id, fixed empty search_path,
-- and the schema must remain outside PostgREST's exposed schemas.
create or replace function private.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.members where auth_user_id = auth.uid() and is_active
  );
$$;
create or replace function private.can_read_channel(channel_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.members m cross join public.channels c
    where m.auth_user_id = auth.uid() and m.is_active
      and c.id = channel_id and not c.is_archived
      and (c.type <> 'private' or m.role = 'elder')
  );
$$;
create or replace function private.can_upload_media(bucket text, object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and bucket = 'feed-media' and exists (
    select 1 from public.members m where m.auth_user_id = auth.uid() and m.is_active
      and (
        object_name like 'avatars/' || m.id::text || '/%'
        or (m.role in ('elder','member') and object_name like m.id::text || '/%')
      )
  );
$$;
create or replace function private.can_read_media(bucket text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.members m where m.auth_user_id = auth.uid() and m.is_active
      and (bucket in ('feed-media','avatars') or (bucket = 'archives' and m.role = 'elder'))
  );
$$;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_member(), private.can_read_channel(uuid), private.can_upload_media(text,text), private.can_read_media(text) to authenticated;

-- No channels SELECT grant is needed: the helper performs the private lookup.
-- The previous subquery ran with the API role and failed its table permission.
drop policy if exists members_client_read on public.members;
create policy members_client_read on public.members for select to authenticated
  using ((select private.is_active_member()));
drop policy if exists messages_client_read on public.messages;
create policy messages_client_read on public.messages for select to authenticated
  using (private.can_read_channel(channel_id));
drop function if exists public.is_active_member();
drop function if exists public.is_active_elder();

-- Keep deleted rows as content-free tombstones so Realtime can deliver the
-- UPDATE while the deleted private text cannot be fetched through the API.
update public.messages set content = '', media_urls = '[]'::jsonb where is_deleted;

-- Private, bounded image buckets. Existing objects and their names survive.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('feed-media','feed-media',false,10485760,array['image/jpeg','image/png','image/webp','image/gif']),
 ('archives','archives',false,10485760,array['image/jpeg','image/png','image/webp','image/gif']),
 ('avatars','avatars',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists house_media_read on storage.objects;
create policy house_media_read on storage.objects for select to authenticated
  using (private.can_read_media(bucket_id));
drop policy if exists house_media_upload on storage.objects;
create policy house_media_upload on storage.objects for insert to authenticated
  with check (private.can_upload_media(bucket_id,name));
-- Restrictive policies also close broad policies left by older manual setup;
-- unrelated buckets retain their own behavior. New files use unique paths.
drop policy if exists house_media_read_guard on storage.objects;
create policy house_media_read_guard on storage.objects as restrictive for select to authenticated
  using (bucket_id not in ('feed-media','archives','avatars') or private.can_read_media(bucket_id));
drop policy if exists house_media_upload_guard on storage.objects;
create policy house_media_upload_guard on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('feed-media','archives','avatars') or private.can_upload_media(bucket_id,name));
drop policy if exists house_media_update_guard on storage.objects;
create policy house_media_update_guard on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('feed-media','archives','avatars')) with check (bucket_id not in ('feed-media','archives','avatars'));
drop policy if exists house_media_delete_guard on storage.objects;
create policy house_media_delete_guard on storage.objects as restrictive for delete to authenticated
  using (bucket_id not in ('feed-media','archives','avatars'));
drop policy if exists house_media_anon_guard on storage.objects;
create policy house_media_anon_guard on storage.objects as restrictive for all to anon
  using (bucket_id not in ('feed-media','archives','avatars')) with check (bucket_id not in ('feed-media','archives','avatars'));

-- Convert only legacy bucket URLs, retaining objects byte-for-byte. Relative
-- application URLs are stable across deployments and require membership on
-- every request. Existing unrelated HTTPS cover images remain untouched.
create or replace function private.migrate_media_url(value text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(value, '^https?://[^/]+/storage/v1/object/public/(feed-media|archives|avatars)/', '/api/media/\1/');
$$;
update public.members set avatar_url=private.migrate_media_url(avatar_url) where avatar_url is not null;
update public.gatherings set cover_image_url=private.migrate_media_url(cover_image_url) where cover_image_url is not null;
update public.albums set cover_photo_url=private.migrate_media_url(cover_photo_url) where cover_photo_url is not null;
update public.photos set url=private.migrate_media_url(url), thumbnail_url=private.migrate_media_url(thumbnail_url);
update public.posts p set media_urls=(select coalesce(jsonb_agg(private.migrate_media_url(u)), '[]'::jsonb) from jsonb_array_elements_text(p.media_urls) u);
update public.messages m set media_urls=(select coalesce(jsonb_agg(private.migrate_media_url(u)), '[]'::jsonb) from jsonb_array_elements_text(m.media_urls) u);
update public.house_settings set value=to_jsonb(private.migrate_media_url(value #>> '{}')) where key='coverImageUrl' and jsonb_typeof(value)='string';
drop function private.migrate_media_url(text);

-- Make the migration chain sufficient for live chat on a clean local project.
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='channels') then
      alter publication supabase_realtime add table public.channels;
    end if;
  end if;
end $$;
commit;
