-- İş geçmişi: sertifika PDF için work_start_at dön.
-- RETURNS TABLE değişince önce DROP gerekir (42P13).
drop function if exists public.list_candidate_work_history(uuid);

create or replace function public.list_candidate_work_history(p_candidate uuid)
returns table (
  episode_id uuid,
  employer_title text,
  job_position text,
  hired_at timestamptz,
  work_start_at date,
  ended_at timestamptz,
  outcome text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.employer_title,
    e.position,
    e.hired_at,
    e.work_start_at,
    e.ended_at,
    e.outcome
  from public.employment_episodes e
  where e.candidate_id = p_candidate
    and (
      e.outcome = 'completed'
      or e.candidate_id = auth.uid()
      or e.agency_id = auth.uid()
      or public.is_admin()
    )
  order by coalesce(e.ended_at, e.hired_at) desc;
$$;

revoke all on function public.list_candidate_work_history(uuid) from public;
grant execute on function public.list_candidate_work_history(uuid) to authenticated;
