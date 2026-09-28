-- Flat read model for the /jobs page: jobs + company name + score + application
-- status in one row, so the page can filter and sort server-side with plain
-- PostgREST operators (no cross-table .or(), no anti-joins).
--
-- security_invoker = true: the view runs with the CALLER's rights, so the RLS
-- policies of the underlying tables still apply (without it, a view runs as
-- its owner and would bypass RLS).
--
-- job_scores.job_id and applications (user_id, job_id) are both UNIQUE, so the
-- left joins never multiply rows.
--
-- Later migrations that add columns must use `create or replace view` and
-- append the new columns at the END of the select list.
create view jobs_overview
with (security_invoker = true) as
select
  j.id,
  j.user_id,
  j.title,
  j.location,
  j.is_remote,
  j.url,
  j.posted_at,
  j.created_at,
  j.source,
  j.sources_seen,
  j.is_hidden,
  c.name as company_name,
  s.final_score,
  s.reasoning,
  s.missing_skills,
  a.status as application_status
from jobs j
left join companies c on c.id = j.company_id
left join job_scores s on s.job_id = j.id
left join applications a on a.job_id = j.id and a.user_id = j.user_id;

-- Cheap insurance: at single-user volume sequential scans are fine anyway.
create index if not exists jobs_user_posted_at_idx on jobs (user_id, posted_at desc);
create index if not exists job_scores_final_score_idx on job_scores (final_score);
create index if not exists companies_name_trgm_idx on companies using gin (name gin_trgm_ops);
