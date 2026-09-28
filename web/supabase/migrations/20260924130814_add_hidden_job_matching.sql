-- pg_trgm: measures similarity between two pieces of text (useful for
-- spotting the same role titled differently on two sites, without doing an
-- exact comparison).
create extension if not exists pg_trgm;

create index if not exists jobs_title_trgm_idx on jobs using gin (title gin_trgm_ops);

-- Returns true if a similar "major platform" (LinkedIn/Indeed) listing
-- already exists for the same company, within the last 30 days.
-- SECURITY INVOKER (the default): the function runs with the caller's
-- rights, so RLS keeps applying normally.
create or replace function job_has_similar_big_platform_listing(
  p_user_id uuid,
  p_company_id uuid,
  p_title text,
  p_exclude_job_id uuid
) returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from jobs j
    where j.user_id = p_user_id
      and j.company_id = p_company_id
      and j.id != p_exclude_job_id
      and j.posted_at > now() - interval '30 days'
      and (
        j.source in ('linkedin', 'indeed')
        or 'linkedin' = any(j.sources_seen)
        or 'indeed' = any(j.sources_seen)
      )
      and similarity(j.title, p_title) > 0.4
  );
$$;