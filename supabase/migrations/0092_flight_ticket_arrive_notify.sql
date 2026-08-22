-- Bilet gönderilince aday bildirimine iniş anı (arrive_at) eklenir.
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wstart date;
  fdep date;
  pend date;
  ag text;
  arrive_txt text;
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

    select arrive_at into arrive_txt
    from public.flights
    where user_id = new.user_id;

    update public.candidate_status
      set status = 'in_transit',
          hired_at = null,
          work_start_at = wstart,
          planned_end_on = pend,
          flight_depart_on = coalesce(fdep, wstart),
          boarding_status = 'pending',
          boarding_asked_at = null,
          boarding_answered_at = null,
          work_start_asked_at = null,
          work_start_remind_count = 0,
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
        'plannedEndOn', pend,
        'arriveAt', arrive_txt
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
          'plannedEndOn', pend,
          'arriveAt', arrive_txt,
          'inTransit', true
        )
      );
    end if;
  end if;
  return new;
end $$;
