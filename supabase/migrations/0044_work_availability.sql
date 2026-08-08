-- 0044_work_availability.sql
-- Çalışma süresi: 1–12 ay yerine 'seasonal' | 'full_year' (Sezonluk / Tüm Yıl).
-- Filtre sütunu work_availability; eski available_months backfill sonrası kullanılmaz.

alter table public.profiles
  add column if not exists work_availability text; -- 'seasonal' | 'full_year'

-- Mevcut kayıtları doldur (jsonb, int sütun veya yeni string değerler).
update public.profiles set work_availability = case
  when data->>'availableMonths' in ('seasonal', 'full_year') then data->>'availableMonths'
  when available_months >= 12 then 'full_year'
  when available_months between 1 and 11 then 'seasonal'
  when (data->>'availableMonths') ~ '^\d+$' and (data->>'availableMonths')::int >= 12 then 'full_year'
  when (data->>'availableMonths') ~ '^\d+$' then 'seasonal'
  else null
end
where work_availability is null;

create index if not exists profiles_work_availability_idx on public.profiles (work_availability);

drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability
  from public.profiles p
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not public.is_user_staff(p.user_id)
    and coalesce(cs.status, '') <> 'hired';
grant select on public.candidate_pool to authenticated;

drop view if exists public.candidate_hired;
create view public.candidate_hired with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    cs.work_end_at, cs.accepted_by
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

notify pgrst, 'reload schema';
