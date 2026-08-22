-- 0093: uçuş teyidi aynı gün hatırlatma + 16s sonra acente “geldi/gelmedi”
-- Çalıştırma: SQL Editor > Run.

create or replace function public.agency_answer_boarding(p_candidate uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ans text := lower(trim(p_answer));
  ag text;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null then raise exception 'bad_request'; end if;
  if ans not in ('confirmed', 'missed') then raise exception 'bad_answer'; end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.candidate_status cs
      where cs.user_id = p_candidate
        and cs.accepted_by = auth.uid()::text
        and cs.status in ('hired', 'in_transit')
        and cs.boarding_status in ('pending', 'no_response')
    ) then
      raise exception 'forbidden';
    end if;
  elsif not exists (
    select 1 from public.candidate_status cs
    where cs.user_id = p_candidate
      and cs.status in ('hired', 'in_transit')
      and cs.boarding_status in ('pending', 'no_response')
  ) then
    raise exception 'not_pending';
  end if;

  update public.candidate_status
  set boarding_status = ans,
      boarding_answered_at = now(),
      updated_at = now()
  where user_id = p_candidate
    and boarding_status in ('pending', 'no_response')
  returning accepted_by into ag;

  if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if ans = 'confirmed' then
      perform public._employment_notify(
        ag::uuid, 'boarding_confirmed', p_candidate,
        jsonb_build_object('candidateId', p_candidate, 'byAgency', true)
      );
    else
      perform public._employment_notify(
        ag::uuid, 'boarding_missed', p_candidate,
        jsonb_build_object('candidateId', p_candidate, 'openWorkStart', true, 'byAgency', true)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.agency_answer_boarding(uuid, text) from public;
grant execute on function public.agency_answer_boarding(uuid, text) to authenticated;

create or replace function public.scan_employment_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_silence int := 0;
  n_complete int := 0;
  n_board_ask int := 0;
  n_board_remind int := 0;
  n_board_escal int := 0;
  n_start_ask int := 0;
  n_start_remind int := 0;
  r record;
  today_tr date := (timezone('Europe/Istanbul', now()))::date;
begin
  for r in
    select id from public.employment_episodes
    where outcome = 'early_exit_pending'
      and silence_deadline_at is not null
      and silence_deadline_at <= now()
  loop
    perform public._finalize_employment_episode(r.id, 'early_exit', null, 'silence');
    n_silence := n_silence + 1;
  end loop;

  for r in
    select id from public.employment_episodes
    where outcome = 'active'
      and planned_end_at is not null
      and planned_end_at <= now()
  loop
    perform public._finalize_employment_episode(r.id, 'completed', null, 'work_end_at');
    n_complete := n_complete + 1;
  end loop;

  for r in
    select e.id, e.candidate_id, e.agency_id, e.employer_title, e.silence_deadline_at
    from public.employment_episodes e
    where e.outcome = 'early_exit_pending'
      and e.silence_deadline_at is not null
      and e.silence_deadline_at > now()
      and e.silence_deadline_at <= now() + interval '48 hours'
      and not exists (
        select 1 from public.notifications n
        where n.type = 'employment_end_remind'
          and n.payload->>'episodeId' = e.id::text
          and n.created_at > now() - interval '20 hours'
      )
  loop
    perform public._employment_notify(
      r.candidate_id, 'employment_end_remind', r.agency_id,
      jsonb_build_object('episodeId', r.id, 'silenceDeadlineAt', r.silence_deadline_at, 'employerTitle', r.employer_title)
    );
    perform public._employment_notify(
      r.agency_id, 'employment_end_remind', r.candidate_id,
      jsonb_build_object('episodeId', r.id, 'silenceDeadlineAt', r.silence_deadline_at, 'employerTitle', r.employer_title)
    );
  end loop;

  -- İlk soru: kalkış günü (İstanbul), henüz sorulmamış
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
      and cs.boarding_status = 'pending'
      and coalesce(cs.flight_depart_on, cs.work_start_at) is not null
      and coalesce(cs.flight_depart_on, cs.work_start_at) <= today_tr
      and cs.boarding_asked_at is null
  loop
    perform public._employment_notify(
      r.user_id, 'boarding_check', nullif(r.accepted_by, '')::uuid,
      jsonb_build_object(
        'flightDepartOn', r.flight_depart_on,
        'workStartAt', r.work_start_at
      )
    );
    update public.candidate_status
      set boarding_asked_at = now(), updated_at = now()
      where user_id = r.user_id;
    n_board_ask := n_board_ask + 1;
  end loop;

  -- Aynı gün hatırlatma: ilk sorudan 8s sonra, escalate'den önce. asked_at dokunulmaz.
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
      and cs.boarding_status = 'pending'
      and cs.boarding_asked_at is not null
      and cs.boarding_asked_at <= now() - interval '8 hours'
      and cs.boarding_asked_at > now() - interval '16 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = cs.user_id
          and n.type = 'boarding_check'
          and n.created_at > now() - interval '7 hours'
      )
  loop
    perform public._employment_notify(
      r.user_id, 'boarding_check', nullif(r.accepted_by, '')::uuid,
      jsonb_build_object(
        'flightDepartOn', r.flight_depart_on,
        'workStartAt', r.work_start_at,
        'remind', true
      )
    );
    n_board_remind := n_board_remind + 1;
  end loop;

  -- 16s cevap yok → acente: geldi / gelmedi
  for r in
    select cs.user_id, cs.accepted_by, cs.boarding_asked_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
      and cs.boarding_status = 'pending'
      and cs.boarding_asked_at is not null
      and cs.boarding_asked_at <= now() - interval '16 hours'
  loop
    if r.accepted_by is not null and r.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._employment_notify(
        r.accepted_by::uuid, 'boarding_no_response', r.user_id,
        jsonb_build_object('candidateId', r.user_id, 'openBoardingResolve', true)
      );
    end if;
    update public.candidate_status
      set boarding_status = 'no_response', updated_at = now()
      where user_id = r.user_id;
    n_board_escal := n_board_escal + 1;
  end loop;

  for r in
    select cs.user_id, cs.accepted_by, cs.work_start_at, cs.flight_depart_on
    from public.candidate_status cs
    where cs.status = 'in_transit'
      and cs.work_start_at is not null
      and cs.work_start_at <= current_date
      and cs.work_start_asked_at is null
      and cs.accepted_by is not null
      and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  loop
    perform public._employment_notify(
      r.accepted_by::uuid, 'work_start_confirm', r.user_id,
      jsonb_build_object(
        'candidateId', r.user_id,
        'workStartAt', r.work_start_at,
        'flightDepartOn', r.flight_depart_on,
        'openHireConfirm', true
      )
    );
    update public.candidate_status
      set work_start_asked_at = now(),
          work_start_remind_count = 0,
          updated_at = now()
      where user_id = r.user_id;
    n_start_ask := n_start_ask + 1;
  end loop;

  for r in
    select cs.user_id, cs.accepted_by, cs.work_start_at, cs.work_start_asked_at, cs.work_start_remind_count
    from public.candidate_status cs
    where cs.status = 'in_transit'
      and cs.work_start_asked_at is not null
      and cs.work_start_asked_at <= now() - interval '2 days'
      and coalesce(cs.work_start_remind_count, 0) < 3
      and cs.accepted_by is not null
      and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = cs.accepted_by::uuid
          and n.type = 'work_start_remind'
          and n.ref_user = cs.user_id
          and n.created_at > now() - interval '48 hours'
      )
  loop
    perform public._employment_notify(
      r.accepted_by::uuid, 'work_start_remind', r.user_id,
      jsonb_build_object(
        'candidateId', r.user_id,
        'workStartAt', r.work_start_at,
        'openHireConfirm', true,
        'remindCount', coalesce(r.work_start_remind_count, 0) + 1
      )
    );
    update public.candidate_status
      set work_start_remind_count = coalesce(work_start_remind_count, 0) + 1,
          updated_at = now()
      where user_id = r.user_id;
    n_start_remind := n_start_remind + 1;
  end loop;

  return jsonb_build_object(
    'silence', n_silence,
    'completed', n_complete,
    'boardingAsked', n_board_ask,
    'boardingReminded', n_board_remind,
    'boardingEscalated', n_board_escal,
    'workStartAsked', n_start_ask,
    'workStartReminded', n_start_remind
  );
end;
$$;

notify pgrst, 'reload schema';
