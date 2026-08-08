-- 0064_agency_favorites.sql
-- Acente: adayı işletme (otel) bazında favoriye ekler.
-- Aynı aday birden fazla işletmeye eklenebilir.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.agency_favorites (
  agency_id    uuid not null references auth.users (id) on delete cascade,
  employer_id  uuid not null references public.agency_employers (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (agency_id, employer_id, candidate_id)
);

create index if not exists agency_favorites_agency_emp_idx
  on public.agency_favorites (agency_id, employer_id);

create index if not exists agency_favorites_agency_cand_idx
  on public.agency_favorites (agency_id, candidate_id);

alter table public.agency_favorites enable row level security;

drop policy if exists agency_favorites_own on public.agency_favorites;
create policy agency_favorites_own on public.agency_favorites
  for all
  to authenticated
  using (agency_id = auth.uid() and public.is_staff())
  with check (agency_id = auth.uid() and public.is_staff());

-- Admin okur
drop policy if exists agency_favorites_admin_select on public.agency_favorites;
create policy agency_favorites_admin_select on public.agency_favorites
  for select
  to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
