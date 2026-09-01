-- 0110_agency_employer_notes.sql
-- Acente: otel/işletme bazlı yapışkan notlar (kontenjan, görüşme notu vb.).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.agency_employer_notes (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references auth.users (id) on delete cascade,
  employer_id uuid not null references public.agency_employers (id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint agency_employer_notes_body_len check (char_length(btrim(body)) between 1 and 400)
);

create index if not exists agency_employer_notes_emp_created_idx
  on public.agency_employer_notes (agency_id, employer_id, created_at desc);

alter table public.agency_employer_notes enable row level security;

drop policy if exists agency_employer_notes_own on public.agency_employer_notes;
create policy agency_employer_notes_own on public.agency_employer_notes
  for all
  to authenticated
  using (agency_id = auth.uid() and public.is_staff())
  with check (agency_id = auth.uid() and public.is_staff());

notify pgrst, 'reload schema';
