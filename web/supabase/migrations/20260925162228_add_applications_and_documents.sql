create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  status text not null default 'to_apply' check (
    status in ('to_apply', 'applied', 'hr_interview', 'technical_interview', 'offer', 'rejected', 'no_response')
  ),
  cv_pdf_path text,
  cover_letter_pdf_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- History of status changes, for the future Kanban display (11c).
create table application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

alter table applications enable row level security;
create policy "Owner can manage their applications" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table application_events enable row level security;
create policy "Owner can manage their application events" on application_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for generated PDFs (CVs + letters). Private: accessible
-- only via the authenticated Supabase API, never through a direct public URL.
insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;

-- Each file is stored under {user_id}/{application_id}/... — this policy
-- checks that the path's first segment matches the signed-in user.
create policy "Owner can manage their application documents"
  on storage.objects for all
  using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = auth.uid()::text);