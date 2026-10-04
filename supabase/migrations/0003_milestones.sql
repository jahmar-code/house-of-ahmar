-- 0003_milestones.sql
--
-- Milestones feature: a post can celebrate a life event (new arrival, graduation,
-- marriage, new job, new home, achievement). Adds one nullable column; posts
-- remains locked from the client Data API by 0002. Additive + idempotent — safe
-- to run after `drizzle-kit push` (which adds the same column from schema.ts).
-- Historical note (2026-10-03, comment only): `drizzle-kit push` is not a
-- supported route to an existing House; see docs/pkm/50-operations/migration-runbook.md.

alter table public.posts add column if not exists milestone_kind text;
