-- 0004_integrity.sql
--
-- Data integrity: push the House's invariants down into the database, where the
-- app is only one of several possible writers (Drizzle Studio, psql, the ops
-- scripts in scripts/). Everything here is additive and idempotent — safe to run
-- before or after `drizzle-kit push`, and safe to run twice. (Historical note,
-- 2026-10-03, comment only: push is not a supported route to an existing House;
-- see docs/pkm/50-operations/migration-runbook.md.)
--
-- Mirrors src/lib/db/schema.ts exactly. If you change one, change the other.
--
-- SECURITY: this migration adds NO tables and NO columns, therefore it grants
-- nothing and needs no new RLS policy. Every table it touches is already locked
-- from the client Data API by 0002 (RLS on, no anon/authenticated grant), and
-- that posture is unchanged. See the AGENTS.md invariants.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Booleans and media_urls: NOT NULL with a default.
--
-- `NULL = false` evaluates to NULL, not true, so a row with a NULL flag is
-- invisible to every list in the app (The Wall filters `is_deleted = false`, the
-- Great Hall filters `is_cancelled = false`, the Council filters `is_archived =
-- false`). Absence has no meaning for any of these columns. Backfill first, then
-- constrain.
-- ─────────────────────────────────────────────────────────────────────────────

update public.posts
   set media_urls = coalesce(media_urls, '[]'::jsonb),
       is_pinned  = coalesce(is_pinned,  false),
       is_deleted = coalesce(is_deleted, false)
 where media_urls is null or is_pinned is null or is_deleted is null;

alter table public.posts alter column media_urls set default '[]'::jsonb;
alter table public.posts alter column media_urls set not null;
alter table public.posts alter column is_pinned  set default false;
alter table public.posts alter column is_pinned  set not null;
alter table public.posts alter column is_deleted set default false;
alter table public.posts alter column is_deleted set not null;

update public.comments
   set is_deleted = coalesce(is_deleted, false)
 where is_deleted is null;

alter table public.comments alter column is_deleted set default false;
alter table public.comments alter column is_deleted set not null;

update public.messages
   set media_urls = coalesce(media_urls, '[]'::jsonb),
       is_deleted = coalesce(is_deleted, false)
 where media_urls is null or is_deleted is null;

alter table public.messages alter column media_urls set default '[]'::jsonb;
alter table public.messages alter column media_urls set not null;
alter table public.messages alter column is_deleted set default false;
alter table public.messages alter column is_deleted set not null;

update public.channels
   set is_archived = coalesce(is_archived, false)
 where is_archived is null;

alter table public.channels alter column is_archived set default false;
alter table public.channels alter column is_archived set not null;

update public.gatherings
   set is_cancelled = coalesce(is_cancelled, false),
       is_all_day   = coalesce(is_all_day,   false)
 where is_cancelled is null or is_all_day is null;

alter table public.gatherings alter column is_cancelled set default false;
alter table public.gatherings alter column is_cancelled set not null;
alter table public.gatherings alter column is_all_day   set default false;
alter table public.gatherings alter column is_all_day   set not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) CHECK constraints — illegal states made unrepresentable.
--
-- Added NOT VALID then VALIDATE so an existing table is never rewritten under an
-- ACCESS EXCLUSIVE lock. Each is guarded on pg_constraint so a re-run is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

-- A gathering cannot end before it begins. gatheringSchema (validators.ts) says
-- the same at the boundary, with a message a relative can act on.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gatherings_time_order_ck') then
    -- Null out any pre-existing offender rather than failing the migration; the
    -- start time is the one the family actually organises around.
    update public.gatherings set ends_at = null
     where ends_at is not null and ends_at <= starts_at;

    alter table public.gatherings
      add constraint gatherings_time_order_ck
      check (ends_at is null or ends_at > starts_at) not valid;
    alter table public.gatherings validate constraint gatherings_time_order_ck;
  end if;
end $$;

-- An invite is the security boundary of this House. The redemption ceiling is
-- enforced by the database, not only by completeInitiation's advisory lock.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'access_codes_use_count_ck') then
    alter table public.access_codes
      add constraint access_codes_use_count_ck
      check (use_count >= 0 and (max_uses is null or use_count <= max_uses)) not valid;
    alter table public.access_codes validate constraint access_codes_use_count_ck;
  end if;
end $$;

-- Nobody is their own parent.
do $$ begin
  if to_regclass('public.member_relationships') is not null
     and not exists (select 1 from pg_constraint where conname = 'member_relationships_no_self_ck') then
    delete from public.member_relationships where parent_id = child_id;

    alter table public.member_relationships
      add constraint member_relationships_no_self_ck
      check (parent_id <> child_id) not valid;
    alter table public.member_relationships validate constraint member_relationships_no_self_ck;
  end if;
end $$;

-- reactions.emoji stores the reaction KEY ("heart"), not the glyph — constrain
-- it to the six the House offers (REACTION_EMOJIS in src/lib/constants.ts).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reactions_emoji_ck') then
    delete from public.reactions
     where emoji not in ('heart', 'fire', 'salute', 'laugh', 'pray', 'clap');

    alter table public.reactions
      add constraint reactions_emoji_ck
      check (emoji in ('heart', 'fire', 'salute', 'laugh', 'pray', 'clap')) not valid;
    alter table public.reactions validate constraint reactions_emoji_ck;
  end if;
end $$;

-- posts.milestone_kind is the other closed set stored as text
-- (MILESTONE_KINDS in src/lib/constants.ts).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_milestone_kind_ck') then
    update public.posts set milestone_kind = null
     where milestone_kind is not null
       and milestone_kind not in ('birth', 'graduation', 'marriage', 'new_job',
                                  'new_home', 'achievement', 'other');

    alter table public.posts
      add constraint posts_milestone_kind_ck
      check (
        milestone_kind is null
        or milestone_kind in ('birth', 'graduation', 'marriage', 'new_job',
                              'new_home', 'achievement', 'other')
      ) not valid;
    alter table public.posts validate constraint posts_milestone_kind_ck;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) messages.reply_to_id FK.
--
-- 0001 created it; schema.ts did not declare it, so the next `drizzle-kit push`
-- would have dropped it for good. schema.ts now declares the self-reference, and
-- this re-creates the constraint for any database that already lost it.
-- ON DELETE SET NULL: messages are soft-deleted, but if a row is ever removed
-- for real, its replies must survive as ordinary messages.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_reply_to_id_fkey') then
    update public.messages m
       set reply_to_id = null
     where reply_to_id is not null
       and not exists (select 1 from public.messages p where p.id = m.reply_to_id);

    alter table public.messages
      add constraint messages_reply_to_id_fkey
      foreign key (reply_to_id) references public.messages(id) on delete set null;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Indexes.
--
-- Only one is warranted. `posts` is the single table here that grows without
-- bound, and The Wall issues exactly one query against it:
--   where is_deleted = false order by is_pinned desc, created_at desc limit 50
-- A partial index on the ordering keys serves that end-to-end.
--
-- NOT added, deliberately: members(last_seen_at desc nulls last). The directory
-- reads every active member with no LIMIT, so the planner sorts the whole
-- (family-sized) set regardless — an index would be cargo-cult. Same for the
-- other tables: at a few dozen rows a sequential scan is the faster plan.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists posts_feed_idx
  on public.posts (is_pinned desc, created_at desc)
  where is_deleted = false;

commit;
