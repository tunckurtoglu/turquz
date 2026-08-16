-- 0077_planned_end_term.sql
-- Çalışma süresi: varsayılan 1 yıl; acente 6 ay / 1 yıl / özel bitiş seçebilir.
-- Çalıştırma: 0076'dan sonra SQL Editor > Run.

alter table public.candidate_status
  add column if not exists planned_end_on date;

-- Önce eski imzaları düş (argüman sayısı/varsayılan değişince gerekir)
drop function if exists public.agency_set_work_start(uuid, date, date);
drop function if exists public.agency_set_work_start(uuid, date);

create or replace function public.agency_set_work_start(
  p_candidate uuid,
  p_start date,
  p_flight_depart date default null,
  p_end date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ep_id uuid;
  st text;
  pend date;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null or p_start is null then raise exception 'bad_request'; end if;

  pend := coalesce(p_end, (p_start + interval '1 year')::date);
  if pend <= p_start then
    raise exception 'bad_end_date'
      using hint = 'Planned end must be after work start';
  end if;

  select status into st from public.candidate_status where user_id = p_candidate;
  if st is null then raise exception 'not_found'; end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.candidate_status cs
      where cs.user_id = p_candidate
        and cs.accepted_by = auth.uid()::text
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  update public.candidate_status
  set work_start_at = p_start,
      planned_end_on = pend,
      flight_depart_on = coalesce(p_flight_depart, flight_depart_on),
      work_end_at = case
        when status = 'hired' then pend::timestamptz
        else work_end_at
      end,
      boarding_status = case
        when status = 'hired' and boarding_status in ('missed', 'no_response') and p_flight_depart is not null
          then 'pending'
        else boarding_status
      end,
      boarding_asked_at = case
        when status = 'hired' and boarding_status in ('missed', 'no_response') and p_flight_depart is not null
          then null
        else boarding_asked_at
      end,
      boarding_answered_at = case
        when status = 'hired' and boarding_status in ('missed', 'no_response') and p_flight_depart is not null
          then null
        else boarding_answered_at
      end,
      updated_at = now()
  where user_id = p_candidate;

  select id into ep_id
  from public.employment_episodes
  where candidate_id = p_candidate
    and outcome in ('active', 'early_exit_pending', 'disputed')
  order by created_at desc
  limit 1;

  if ep_id is not null then
    update public.employment_episodes
    set work_start_at = p_start,
        planned_end_at = pend::timestamptz,
        updated_at = now()
    where id = ep_id;
  end if;
end;
$$;

revoke all on function public.agency_set_work_start(uuid, date, date, date) from public;
grant execute on function public.agency_set_work_start(uuid, date, date, date) to authenticated;

-- Hire: planned_end_on varsa onu kullan, yoksa +1 yıl
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wstart date;
  fdep date;
  pend date;
  wend timestamptz;
  ag text;
  snap jsonb;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    select work_start_at, flight_depart_on, planned_end_on into wstart, fdep, pend
    from public.candidate_status
    where user_id = new.user_id;

    if wstart is null then
      raise exception 'work_start_required'
        using hint = 'Set work start date before submitting the flight ticket';
    end if;

    pend := coalesce(pend, (wstart + interval '1 year')::date);
    if pend <= wstart then
      pend := (wstart + interval '1 year')::date;
    end if;
    wend := pend::timestamptz;
    snap := public._contract_snapshot(new.user_id);

    update public.candidate_status
      set status = 'hired',
          hired_at = now(),
          work_start_at = wstart,
          planned_end_on = pend,
          work_end_at = wend,
          flight_depart_on = coalesce(fdep, wstart),
          boarding_status = 'pending',
          boarding_asked_at = null,
          boarding_answered_at = null,
          updated_at = now()
      where user_id = new.user_id
      returning accepted_by into ag;

    perform public._employment_notify(
      new.user_id,
      'flight_ticket_ready',
      nullif(ag, '')::uuid,
      jsonb_build_object(
        'workStartAt', wstart,
        'flightDepartOn', coalesce(fdep, wstart),
        'plannedEndOn', pend
      )
    );
    if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._employment_notify(
        ag::uuid,
        'flight_ticket_sent',
        new.user_id,
        jsonb_build_object(
          'workStartAt', wstart,
          'flightDepartOn', coalesce(fdep, wstart),
          'plannedEndOn', pend
        )
      );

      insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
      values (ag::uuid, new.user_id, now(), null)
      on conflict (agency_id, candidate_id) do update
        set ended_at = null,
            hired_at = coalesce(agency_employment_log.hired_at, excluded.hired_at),
            updated_at = now();

      if not exists (
        select 1 from public.employment_episodes e
        where e.candidate_id = new.user_id
          and e.outcome in ('active', 'early_exit_pending', 'disputed')
      ) then
        insert into public.employment_episodes (
          candidate_id, agency_id, employer_title, position,
          hired_at, work_start_at, planned_end_at, outcome, contract_snapshot
        )
        values (
          new.user_id, ag::uuid, snap->>'title', snap->>'position',
          now(), wstart, wend, 'active', snap
        );
      else
        update public.employment_episodes
        set work_start_at = wstart,
            planned_end_at = wend,
            updated_at = now()
        where candidate_id = new.user_id
          and outcome in ('active', 'early_exit_pending', 'disputed');
      end if;
    end if;
  end if;
  return new;
end $$;
