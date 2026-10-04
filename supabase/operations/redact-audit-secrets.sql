-- Redact secrets copied into historical audit metadata (follow-up audit DS-02).
--
-- OPERATOR-RUN ONLY, after a verified backup and the owner's approval. This is
-- deliberately not a migration: it rewrites existing Elder-only history, so it
-- must never run as a side effect of provisioning or a deploy.
--
--   psql "$TARGET" -v ON_ERROR_STOP=1 -f supabase/operations/redact-audit-secrets.sql            # dry run
--   psql "$TARGET" -v ON_ERROR_STOP=1 -v apply=true -f supabase/operations/redact-audit-secrets.sql # commit
--
-- Removes only the `code` key from invitation events and the `preview` key
-- from Elder removals. Every event keeps its id, actor, action, entity, time
-- and remaining fields. Output is counts only — no codes or text are printed.
-- Backups taken before this runs still hold the old keys; expire them on the
-- normal retention schedule rather than editing them.
\set ON_ERROR_STOP on
-- Commit only on an explicit true: `-v apply=0` or a missing value is a dry run.
\if :{?apply}
\else
\set apply false
\endif
begin;

select action,
  count(*) filter (where metadata ? 'code') as rows_with_code,
  count(*) filter (where metadata ? 'preview') as rows_with_preview
from public.audit_logs
where metadata ?| array['code', 'preview']
group by action
order by action;

update public.audit_logs set metadata = metadata - 'code'
where action in ('access_code.created', 'access_code.revoked') and metadata ? 'code';

update public.audit_logs set metadata = metadata - 'preview'
where action in ('message.deleted_by_elder', 'post.deleted_by_elder', 'comment.deleted_by_elder')
  and metadata ? 'preview';

-- Expect zero for these actions; any other action still holding a key is
-- outside this script's reviewed scope and is left untouched for review.
select action, count(*) as rows_still_holding_a_key
from public.audit_logs
where metadata ?| array['code', 'preview']
group by action
order by action;

\if :apply
commit;
\echo 'Committed: historical audit secrets redacted.'
\else
rollback;
\echo 'Dry run rolled back. Review the counts, then re-run with -v apply=true.'
\endif
