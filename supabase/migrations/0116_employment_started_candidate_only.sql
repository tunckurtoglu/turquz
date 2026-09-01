-- 0116_employment_started_candidate_only.sql
-- employment_started yalnız adaya gider; acente zaten personel kaydını kendisi onaylar.

-- Yanlışlıkla acente hesaplarına düşmüş kayıtları temizle
delete from public.notifications n
where n.type = 'employment_started'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = n.user_id
      and ur.role in ('agency', 'admin')
  );

create or replace function public._promote_to_hired(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wstart date;
  fdep date;
  pend date;
  wend timestamptz;
  ag text;
  snap jsonb;
  st text;
begin
  select status, work_start_at, flight_depart_on, planned_end_on, accepted_by
    into st, wstart, fdep, pend, ag
  from public.candidate_status
  where user_id = p_candidate
  for update;

  if st is null then raise exception 'not_found'; end if;
  if st = 'hired' then return; end if;
  if st <> 'in_transit' then raise exception 'not_in_transit'; end if;
  if wstart is null then raise exception 'work_start_required'; end if;

  pend := coalesce(pend, (wstart + interval '1 year')::date);
  if pend <= wstart then
    pend := (wstart + interval '1 year')::date;
  end if;
  wend := pend::timestamptz;
  snap := public._contract_snapshot(p_candidate);

  update public.candidate_status
  set status = 'hired',
      hired_at = coalesce(hired_at, now()),
      planned_end_on = pend,
      work_end_at = wend,
      flight_depart_on = coalesce(fdep, wstart),
      work_start_asked_at = null,
      work_start_remind_count = 0,
      updated_at = now()
  where user_id = p_candidate;

  if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
    values (ag::uuid, p_candidate, now(), null)
    on conflict (agency_id, candidate_id) do update
      set ended_at = null,
          hired_at = coalesce(agency_employment_log.hired_at, excluded.hired_at),
          updated_at = now();

    if not exists (
      select 1 from public.employment_episodes e
      where e.candidate_id = p_candidate
        and e.outcome in ('active', 'early_exit_pending', 'disputed')
    ) then
      insert into public.employment_episodes (
        candidate_id, agency_id, employer_title, position,
        hired_at, work_start_at, planned_end_at, outcome, contract_snapshot
      )
      values (
        p_candidate, ag::uuid, snap->>'title', snap->>'position',
        now(), wstart, wend, 'active', snap
      );
    end if;

    perform public._employment_notify(
      p_candidate, 'employment_started', ag::uuid,
      jsonb_build_object('workStartAt', wstart, 'plannedEndOn', pend)
    );
  end if;
end;
$$;

revoke all on function public._promote_to_hired(uuid) from public;
