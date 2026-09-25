-- Suivi des tokens/coût LLM : une ligne par appel (scoring, CV+lettre,
-- message LinkedIn). Le coût est estimé quand on peut le calculer (le
-- worker Python le fait via litellm.completion_cost) ; sinon NULL — on
-- affiche alors seulement les tokens, jamais un chiffre inventé.
create table llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('scoring', 'cv_letter', 'outreach_message')),
  provider text not null,
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

alter table llm_usage enable row level security;
create policy "Owner can manage their llm usage" on llm_usage
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
