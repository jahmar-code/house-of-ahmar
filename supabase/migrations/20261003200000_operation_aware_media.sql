-- Make House media policies operation-aware (follow-up audit DS-01).
--
-- Storage evaluates storage.objects SELECT policies for several operations,
-- not only downloads. A member could therefore call Storage directly to sign a
-- bearer URL (or many) that kept serving the photo after deactivation. Browser
-- sessions now get exactly the operations the House uses: authenticated
-- download/info for reads and a direct upload for writes. Signing, batch
-- signing, signed uploads, listing, image rendering, TUS and S3 operations on
-- House buckets are refused even if an older broad policy still exists.
--
-- Additive: objects, object names and stored media references are untouched.
-- It does NOT revoke signed URLs issued before it is applied — see
-- docs/pkm/50-operations/backup-and-recovery.md and the media rollout notes in
-- docs/pkm/50-operations/migration-runbook.md before applying to a live House.
begin;
set local lock_timeout = '5s';

-- Operation names come from the Storage server (verified against
-- storage-api v1.79.28). Refuse to install on a Storage version without the
-- operation helpers instead of silently denying every download.
do $$ begin
  if to_regprocedure('storage.allow_any_operation(text[])') is null
    or to_regprocedure('storage.allow_only_operation(text)') is null then
    raise exception 'Storage lacks operation-aware policy helpers; upgrade Storage before applying this migration';
  end if;
  if not has_function_privilege('authenticated', 'storage.allow_any_operation(text[])', 'execute')
    or not has_function_privilege('authenticated', 'storage.allow_only_operation(text)', 'execute') then
    raise exception 'authenticated cannot execute the Storage operation helpers; every House photo would 404';
  end if;
end $$;

-- Download and metadata reads only. The helper normalizes the optional
-- `storage.` prefix, so the legacy `object.*_authenticated_info` names match.
create or replace function private.is_media_read_operation()
returns boolean language sql stable set search_path = '' as $$
  select storage.allow_any_operation(array[
    'storage.object.get_authenticated',
    'storage.object.info_authenticated',
    'object.get_authenticated_info',
    'object.head_authenticated_info'
  ]);
$$;
create or replace function private.is_media_upload_operation()
returns boolean language sql stable set search_path = '' as $$
  select storage.allow_only_operation('storage.object.upload');
$$;
revoke all on function private.is_media_read_operation(), private.is_media_upload_operation() from public, anon, authenticated;
grant execute on function private.is_media_read_operation(), private.is_media_upload_operation() to authenticated;

-- Restrictive guards AND with every permissive policy, so a legacy
-- `using (true)` read policy cannot reopen signing or deactivated access.
-- The operation check is row-independent: `(select …)` runs it once per query.
drop policy if exists house_media_read_guard on storage.objects;
create policy house_media_read_guard on storage.objects as restrictive for select to authenticated
  using (bucket_id not in ('feed-media','archives','avatars')
    or ((select private.is_media_read_operation()) and private.can_read_media(bucket_id)));
drop policy if exists house_media_upload_guard on storage.objects;
create policy house_media_upload_guard on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('feed-media','archives','avatars')
    or ((select private.is_media_upload_operation()) and private.can_upload_media(bucket_id,name)));

-- A bucket made public would serve every object at /object/public/ with no
-- RLS at all. No browser session may create, change or remove a House bucket,
-- whatever older bucket policies exist. Reads are untouched.
drop policy if exists house_bucket_insert_guard on storage.buckets;
create policy house_bucket_insert_guard on storage.buckets as restrictive for insert to authenticated, anon
  with check (id not in ('feed-media','archives','avatars'));
drop policy if exists house_bucket_update_guard on storage.buckets;
create policy house_bucket_update_guard on storage.buckets as restrictive for update to authenticated, anon
  using (id not in ('feed-media','archives','avatars')) with check (id not in ('feed-media','archives','avatars'));
drop policy if exists house_bucket_delete_guard on storage.buckets;
create policy house_bucket_delete_guard on storage.buckets as restrictive for delete to authenticated, anon
  using (id not in ('feed-media','archives','avatars'));
commit;
