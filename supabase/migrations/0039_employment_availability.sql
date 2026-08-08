-- 0039_employment_availability.sql
-- Adayın çalışma durumu (öğrenci/çalışan) ve kaç ay çalışabileceği bilgisi.
-- Filtreleme sütunları olarak profiles'a eklenir; saveProfile tetiklenince güncellenir.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.profiles
  add column if not exists employment_status text,        -- 'student' | 'employed'
  add column if not exists available_months  int;         -- 1..12

-- Mevcut kayıtları data (jsonb) içinden doldur (tek seferlik backfill).
update public.profiles set
  employment_status = nullif(data->>'employmentStatus', ''),
  available_months  = nullif(data->>'availableMonths', '')::int
where data is not null;

-- İndeksler (filtre sorgularını hızlandırır)
create index if not exists profiles_employment_status_idx on public.profiles (employment_status);
create index if not exists profiles_available_months_idx  on public.profiles (available_months);

-- Havuz görünümünü yeni sütunlarla yeniden oluştur
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.available_months
  from public.profiles p
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not public.is_user_staff(p.user_id)
    and coalesce(cs.status, '') <> 'hired';
grant select on public.candidate_pool to authenticated;

-- Personel görünümünü de yenile
drop view if exists public.candidate_hired;
create view public.candidate_hired with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.available_months,
    cs.work_end_at, cs.accepted_by
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

notify pgrst, 'reload schema';
