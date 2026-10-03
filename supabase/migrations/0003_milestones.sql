-- 0003_milestones.sql
--
-- Milestones feature: a post can celebrate a life event (new arrival, graduation,
-- marriage, new job, new home, achievement). Adds one nullable column; posts
-- remains locked from the client Data API by 0002. Additive + idempotent — safe
-- to run after `drizzle-kit push` (which adds the same column from schema.ts).

alter table public.posts add column if not exists milestone_kind text;
