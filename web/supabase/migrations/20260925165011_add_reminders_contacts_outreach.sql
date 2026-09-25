-- Relances : une ligne = "recontacter cette candidature à telle date".
-- Créée automatiquement (J+7) quand une candidature passe au statut "applied",
-- mais reste modifiable/supprimable à la main (date, note).
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  remind_at date not null,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Personnes rencontrées/contactées pour une candidature (recruteur, employé...).
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  name text not null,
  role text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Brouillons de messages LinkedIn générés pour un contact (jamais envoyés
-- automatiquement — copier/coller manuel dans LinkedIn, cf. plan F8).
create table outreach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null check (kind in ('connection_request', 'follow_up', 'thank_you')),
  content text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table reminders enable row level security;
create policy "Owner can manage their reminders" on reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table contacts enable row level security;
create policy "Owner can manage their contacts" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table outreach_messages enable row level security;
create policy "Owner can manage their outreach messages" on outreach_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
