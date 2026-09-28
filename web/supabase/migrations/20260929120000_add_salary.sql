-- F2 salary.
--
-- 1) OFFERED salary: extracted from the posting by the worker (same LLM call
--    as scoring) or given as structured data by a source. All nullable: null
--    means "not stated in the posting". salary_min/max are the figures as
--    written, in salary_period; salary_yearly_* are computed IN CODE
--    (worker/salary.py::normalize_to_yearly), never by the LLM.
alter table jobs
  add column salary_min numeric,
  add column salary_max numeric,
  add column salary_currency char(3),
  add column salary_period text
    check (salary_period in ('year', 'month', 'week', 'day', 'hour')),
  add column salary_yearly_min numeric,
  add column salary_yearly_max numeric,
  add column salary_source text
    check (salary_source in ('llm_extracted', 'source_structured'));

-- 2) EXPECTED salary: on-demand AI estimate, one row per job (regenerating
--    overwrites it). Clearly an estimate, never market data.
create table salary_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null unique references jobs(id) on delete cascade,
  min_eur numeric not null,
  max_eur numeric not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  rationale text not null,
  negotiation_tips text[] not null default '{}',
  model text not null,
  created_at timestamptz not null default now()
);

alter table salary_estimates enable row level security;
create policy "Owner can manage their salary estimates" on salary_estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) New llm_usage.call_type value. The check constraint was created inline,
--    so Postgres named it llm_usage_call_type_check.
alter table llm_usage drop constraint llm_usage_call_type_check;
alter table llm_usage add constraint llm_usage_call_type_check
  check (call_type in ('scoring', 'cv_letter', 'outreach_message', 'salary_estimate'));

-- 4) Expose the offered salary in the /jobs read model. create or replace
--    view only allows appending columns at the END of the select list.
create or replace view jobs_overview
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
  a.status as application_status,
  j.salary_min,
  j.salary_max,
  j.salary_currency,
  j.salary_period,
  j.salary_yearly_min,
  j.salary_yearly_max,
  j.salary_source
from jobs j
left join companies c on c.id = j.company_id
left join job_scores s on s.job_id = j.id
left join applications a on a.job_id = j.id and a.user_id = j.user_id;
