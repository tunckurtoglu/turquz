-- İşletme merkezi Faz 2: eski personelde employer_id + işletmeye göre filtre.

drop function if exists public.list_former_staff(uuid);

create or replace function public.list_former_staff(
  p_agency uuid default null,
  p_employer uuid default null
)
returns table (
  episode_id uuid,
  candidate_id uuid,
  employer_id uuid,
  employer_title text,
  job_position text,
  hired_at timestamptz,
  ended_at timestamptz,
  outcome text,
  title text,
  reg_no int,
  nationality text,
  data jsonb,
  needs_rating boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.candidate_id,
    e.employer_id,
    e.employer_title,
    e.position,
    e.hired_at,
    e.ended_at,
    e.outcome,
    p.title,
    p.reg_no,
    p.nationality,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    (
      e.outcome = 'completed'
      and not exists (
        select 1 from public.candidate_ratings cr
        where cr.agency_id = e.agency_id
          and cr.candidate_id = e.candidate_id
      )
    ) as needs_rating
  from public.employment_episodes e
  join public.profiles p on p.user_id = e.candidate_id
  where e.agency_id = coalesce(p_agency, auth.uid())
    and (e.agency_id = auth.uid() or public.is_admin())
    and e.outcome in ('completed', 'early_exit')
    and (p_employer is null or e.employer_id = p_employer)
  order by e.ended_at desc nulls last;
$$;

revoke all on function public.list_former_staff(uuid, uuid) from public;
grant execute on function public.list_former_staff(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
