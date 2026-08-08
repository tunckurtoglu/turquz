-- 0040_agency_cv_overrides.sql
-- Acentenin aday CV'sine yaptığı özel düzenlemeler (overlay).
-- Aday profili HİÇ değişmez; bu tablo sadece acente için bir "kişisel kopya" saklar.
-- Havuz görünümü, diğer acenteler ve adayın kendi görünümü etkilenmez.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.agency_cv_overrides (
  agency_id    uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  overrides    jsonb not null default '{}',   -- sadece değiştirilen alanlar; { title, profile, positions[], skills[], experience[], certificates[] }
  updated_at   timestamptz not null default now(),
  primary key (agency_id, candidate_id)
);

alter table public.agency_cv_overrides enable row level security;

-- Acente yalnızca kendi kayıtlarını okuyabilir/yazabilir.
drop policy if exists agency_cv_overrides_own on public.agency_cv_overrides;
create policy agency_cv_overrides_own
  on public.agency_cv_overrides
  for all
  to authenticated
  using  (agency_id = auth.uid())
  with check (agency_id = auth.uid());

notify pgrst, 'reload schema';
