-- 0021_interviews.sql
-- Videolu mülakat — FAZ 1: randevu/planlama. Acente birkaç müsait slot önerir, aday birini seçer.
-- (Görüntülü görüşme + transkript sonraki fazlarda.) Aday başına tek aktif mülakat (pk user_id).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.interviews (
  user_id       uuid primary key references auth.users (id) on delete cascade, -- aday
  created_by    uuid,                 -- planlayan acente
  status        text not null default 'proposed'
                  check (status in ('proposed', 'scheduled', 'cancelled', 'done')),
  slots         jsonb not null default '[]'::jsonb,  -- önerilen slotlar: ["12.06.2026 14:30", ...]
  selected_slot text,                 -- adayın seçtiği slot
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.interviews enable row level security;

-- Aday kendi mülakatını görür + slot seçebilir (günceller).
drop policy if exists interviews_select_own on public.interviews;
create policy interviews_select_own on public.interviews
  for select using (auth.uid() = user_id);

drop policy if exists interviews_update_own on public.interviews;
create policy interviews_update_own on public.interviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Acente/admin tüm mülakatları görür + yazar.
drop policy if exists interviews_all_staff on public.interviews;
create policy interviews_all_staff on public.interviews
  for all using (public.is_staff()) with check (public.is_staff());

-- Anlık yansıma (acente slot önerince adayda, aday seçince acentede otomatik görünsün).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'interviews'
  ) then
    alter publication supabase_realtime add table public.interviews;
  end if;
end $$;

notify pgrst, 'reload schema';
