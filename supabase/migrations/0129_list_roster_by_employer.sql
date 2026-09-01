-- İşletme merkezi Faz 3: tek işletme için personel kadrosu (hired + transit).

create or replace function public.list_roster_by_employer(
  p_agency uuid,
  p_employer uuid
)
returns table (
  user_id uuid,
  title text,
  reg_no int,
  nationality text,
  data jsonb,
  roster_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with emp as (
    select
      lower(trim(coalesce(e.title, ''))) as nt,
      lower(trim(coalesce(e.name, ''))) as nn
    from public.agency_employers e
    where e.id = p_employer
      and e.agency_id = p_agency
  ),
  linked as (
    select distinct e.candidate_id as uid
    from public.employment_episodes e
    where e.agency_id = p_agency
      and e.employer_id = p_employer
      and e.outcome in ('active', 'early_exit_pending', 'disputed')
    union
    select f.candidate_id
    from public.agency_favorites f
    where f.agency_id = p_agency
      and f.employer_id = p_employer
      and (
        select count(distinct f2.employer_id)
        from public.agency_favorites f2
        where f2.agency_id = p_agency
          and f2.candidate_id = f.candidate_id
      ) = 1
    union
    select c.user_id
    from public.contracts c
    cross join emp
    where (emp.nt <> '' and lower(trim(coalesce(c.title, ''))) = emp.nt)
       or (emp.nn <> '' and lower(trim(coalesce(c.title, ''))) = emp.nn)
  )
  select
    h.user_id,
    h.title,
    h.reg_no,
    h.nationality,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    'active'::text as roster_status
  from public.candidate_hired h
  join public.profiles p on p.user_id = h.user_id
  join linked l on l.uid = h.user_id
  where h.accepted_by = p_agency::text
    and (p_agency = auth.uid() or public.is_admin())
  union all
  select
    t.user_id,
    t.title,
    t.reg_no,
    t.nationality,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    'transit'::text as roster_status
  from public.candidate_in_transit t
  join public.profiles p on p.user_id = t.user_id
  join linked l on l.uid = t.user_id
  where t.accepted_by = p_agency::text
    and (p_agency = auth.uid() or public.is_admin());
$$;

revoke all on function public.list_roster_by_employer(uuid, uuid) from public;
grant execute on function public.list_roster_by_employer(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
