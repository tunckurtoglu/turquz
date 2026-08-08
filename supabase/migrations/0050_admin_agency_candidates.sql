-- 0050_admin_agency_candidates.sql
-- Bir acenteye bağlı adaylar (accepted_by = acente user_id).
-- Supabase SQL Editor'da çalıştır.

create or replace function public.admin_list_agency_candidates(p_agency uuid)
returns table (
  user_id       uuid,
  email         text,
  full_name     text,
  title         text,
  reg_no        int,
  nationality   text,
  status        text,
  stage         int,
  docs_unlocked boolean,
  accepted_at   timestamptz,
  offered_at    timestamptz,
  hired_at      timestamptz,
  updated_at    timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_agency is null then
    raise exception 'missing_agency';
  end if;

  return query
  select
    p.user_id,
    u.email::text,
    p.full_name,
    p.title,
    p.reg_no,
    coalesce(p.nationality, nullif(p.data->>'nationality', '')),
    cs.status,
    cs.stage,
    coalesce(cs.docs_unlocked, false),
    cs.accepted_at,
    cs.offered_at,
    cs.hired_at,
    p.updated_at
  from public.candidate_status cs
  join public.profiles p on p.user_id = cs.user_id
  join auth.users u on u.id = p.user_id
  where cs.accepted_by = p_agency::text
  order by
    case
      when cs.status = 'hired' then 1
      when cs.docs_unlocked or cs.status = 'accepted' then 2
      when cs.status = 'offered' then 3
      else 4
    end,
    coalesce(cs.hired_at, cs.accepted_at, cs.offered_at, p.updated_at) desc nulls last;
end;
$$;

revoke all on function public.admin_list_agency_candidates(uuid) from public;
grant execute on function public.admin_list_agency_candidates(uuid) to authenticated;

-- Acente listesine bağlı aday sayıları
drop function if exists public.admin_list_agencies();

create or replace function public.admin_list_agencies()
returns table (
  user_id              uuid,
  email                text,
  company_name         text,
  contact_first_name   text,
  contact_last_name    text,
  phone_authorized     text,
  phone_rep            text,
  tax_plate_path       text,
  completed_at         timestamptz,
  created_at           timestamptz,
  updated_at           timestamptz,
  cnt_offered          int,
  cnt_process          int,
  cnt_hired            int
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    ur.user_id,
    u.email::text,
    ap.company_name,
    ap.contact_first_name,
    ap.contact_last_name,
    ap.phone_authorized,
    ap.phone_rep,
    ap.tax_plate_path,
    ap.completed_at,
    coalesce(ap.created_at, u.created_at) as created_at,
    coalesce(ap.updated_at, u.created_at) as updated_at,
    coalesce((
      select count(*)::int from public.candidate_status cs
      where cs.accepted_by = ur.user_id::text and cs.status = 'offered'
    ), 0),
    coalesce((
      select count(*)::int from public.candidate_status cs
      where cs.accepted_by = ur.user_id::text
        and (cs.docs_unlocked = true or cs.status = 'accepted')
        and coalesce(cs.status, '') <> 'hired'
    ), 0),
    coalesce((
      select count(*)::int from public.candidate_status cs
      where cs.accepted_by = ur.user_id::text and cs.status = 'hired'
    ), 0)
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  left join public.agency_profiles ap on ap.user_id = ur.user_id
  where ur.role = 'agency'
  order by coalesce(ap.created_at, u.created_at) desc;
end;
$$;

grant execute on function public.admin_list_agencies() to authenticated;
notify pgrst, 'reload schema';
