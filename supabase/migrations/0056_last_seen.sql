-- 0056_last_seen.sql
-- Adayın uygulamayı en son açtığı zaman. Havuz sıralaması + "son çevrimiçi" rozeti.
-- App silindi sinyali yok; last_seen ile aktiflik ölçülür.

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists activity_nudge_at timestamptz; -- günlük hatırlatma (edge) idempotent

create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at desc nulls last);

-- Mevcut adaylar: en azından CV güncellemesi kadar "görüldü" sayılsın
update public.profiles
set last_seen_at = coalesce(last_seen_at, updated_at, now())
where last_seen_at is null;

-- Aday kendi last_seen'ini günceller (updated_at'e dokunmaz — CV "yeni" sıralamasını bozmaz)
create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  update public.profiles
  set last_seen_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
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
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    cs.work_end_at, cs.accepted_by
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

notify pgrst, 'reload schema';
