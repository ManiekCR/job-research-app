-- pg_trgm : mesure la similarité entre deux textes (utile pour repérer un
-- même poste titré différemment sur deux sites, sans faire de comparaison
-- exacte).
create extension if not exists pg_trgm;

create index if not exists jobs_title_trgm_idx on jobs using gin (title gin_trgm_ops);

-- Renvoie true si une offre "grande plateforme" (LinkedIn/Indeed) similaire
-- existe déjà pour la même entreprise, dans les 30 derniers jours.
-- SECURITY INVOKER (par défaut) : la fonction s'exécute avec les droits de
-- l'appelant, donc RLS continue de s'appliquer normalement.
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