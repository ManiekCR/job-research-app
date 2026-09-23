-- Assure que gen_random_uuid() est disponible pour générer des identifiants uniques
create extension if not exists "pgcrypto";

-- 1 ligne = ton CV structuré + les poids du score (modifiables plus tard)
create table profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cv_json jsonb not null default '{}'::jsonb,
  score_weights jsonb not null default '{"hard_skills":35,"experience":25,"languages":20,"soft_skills":20}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ta clé LLM personnelle (chiffrée avant d'arriver ici, jamais en clair)
create table llm_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('anthropic','openai','google')),
  fast_model text not null,
  quality_model text not null,
  encrypted_key text not null,
  key_last4 text not null,
  created_at timestamptz not null default now()
);

-- Entreprises découvertes pendant le scraping
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  website text,
  ats_type text,
  ats_identifier text,
  summary text,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

-- Un run de scraping = une exécution du bouton "Scraper"
create table scrape_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running','done','error')),
  jobs_found int not null default 0,
  jobs_new int not null default 0,
  log text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Les offres d'emploi elles-mêmes
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  scrape_run_id uuid references scrape_runs(id) on delete set null,
  source text not null,
  sources_seen text[] not null default '{}',
  url text not null,
  title text not null,
  location text,
  is_remote boolean not null default false,
  description text,
  posted_at timestamptz,
  ad_language text,
  fingerprint text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

-- Le score de matching calculé pour chaque offre
create table job_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade unique,
  hard_skills_score int not null,
  soft_skills_score int not null,
  experience_score int not null,
  languages_score int not null,
  final_score int not null,
  missing_skills text[] not null default '{}',
  reasoning text,
  model_used text,
  created_at timestamptz not null default now()
);

-- Liens d'apprentissage curés par compétence
create table learning_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  skill text not null,
  url text not null,
  label text not null,
  created_at timestamptz not null default now()
);

-- ===== Row Level Security =====
-- Chaque table : verrouillée par défaut, une seule règle "le propriétaire
-- de la ligne (auth.uid()) peut tout faire dessus (lire/écrire/modifier/supprimer)".
alter table profile enable row level security;
create policy "Owner can manage their profile" on profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table llm_credentials enable row level security;
create policy "Owner can manage their llm credentials" on llm_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table companies enable row level security;
create policy "Owner can manage their companies" on companies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table scrape_runs enable row level security;
create policy "Owner can manage their scrape runs" on scrape_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table jobs enable row level security;
create policy "Owner can manage their jobs" on jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table job_scores enable row level security;
create policy "Owner can manage their job scores" on job_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table learning_resources enable row level security;
create policy "Owner can manage their learning resources" on learning_resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
