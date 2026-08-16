-- 0075_boarding_check.sql
-- Uçuş / varış teyidi: adaya "uçağa bindiniz mi?", cevaba göre acenteye haber + tarih güncelleme.
-- Çalıştırma: 0074'ten sonra SQL Editor > Run.

alter table public.candidate_status
  add column if not exists flight_depart_on date,
  add column if not exists boarding_status text
    check (boarding_status is null or boarding_status in ('pending', 'confirmed', 'missed', 'no_response')),
  add column if not exists boarding_asked_at timestamptz,
  add column if not exists boarding_answered_at timestamptz;

-- Tarihler: işe başlama + uçuş günü
create or replace function public.agency_set_work_start(
  p_candidate uuid,
  p_start date,
  p_flight_depart date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ep_id uuid;
  st text;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null or p_start is null then raise exception 'bad_request'; end if;

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
      flight_depart_on = coalesce(p_flight_depart, flight_depart_on),
      work_end_at = case
        when status = 'hired' then (p_start + interval '1 year')::timestamptz
        else work_end_at
      end,
      -- Tarih değişince kaçırma sonrası tekrar sorulabilsin
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
        planned_end_at = (p_start + interval '1 year')::timestamptz,
        updated_at = now()
    where id = ep_id;
  end if;
end;
$$;

revoke all on function public.agency_set_work_start(uuid, date, date) from public;
grant execute on function public.agency_set_work_start(uuid, date, date) to authenticated;
-- Eski 2 argümanlı imza da kalsın
create or replace function public.agency_set_work_start(p_candidate uuid, p_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.agency_set_work_start(p_candidate, p_start, null);
end;
$$;
revoke all on function public.agency_set_work_start(uuid, date) from public;
grant execute on function public.agency_set_work_start(uuid, date) to authenticated;

-- Hire: boarding pending
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wstart date;
  fdep date;
  wend timestamptz;
  ag text;
  snap jsonb;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    select work_start_at, flight_depart_on into wstart, fdep
    from public.candidate_status
    where user_id = new.user_id;

    if wstart is null then
      raise exception 'work_start_required'
        using hint = 'Set work start date before submitting the flight ticket';
    end if;

    wend := (wstart + interval '1 year')::timestamptz;
    snap := public._contract_snapshot(new.user_id);

    update public.candidate_status
      set status = 'hired',
          hired_at = now(),
          work_start_at = wstart,
          work_end_at = wend,
          flight_depart_on = coalesce(fdep, wstart),
          boarding_status = 'pending',
          boarding_asked_at = null,
          boarding_answered_at = null,
          updated_at = now()
      where user_id = new.user_id
      returning accepted_by into ag;

    -- Adaya: bilet yolda / hazır
    perform public._employment_notify(
      new.user_id,
      'flight_ticket_ready',
      nullif(ag, '')::uuid,
      jsonb_build_object(
        'workStartAt', wstart,
        'flightDepartOn', coalesce(fdep, wstart)
      )
    );
    if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._employment_notify(
        ag::uuid,
        'flight_ticket_sent',
        new.user_id,
        jsonb_build_object('workStartAt', wstart, 'flightDepartOn', coalesce(fdep, wstart))
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

-- Aday cevabı
create or replace function public.candidate_answer_boarding(p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ag text;
  ans text := lower(trim(p_answer));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if ans not in ('confirmed', 'missed') then raise exception 'bad_answer'; end if;

  if not exists (
    select 1 from public.candidate_status
    where user_id = uid and status = 'hired'
      and boarding_status in ('pending', 'no_response')
  ) then
    raise exception 'not_pending';
  end if;

  update public.candidate_status
  set boarding_status = ans,
      boarding_answered_at = now(),
      updated_at = now()
  where user_id = uid
  returning accepted_by into ag;

  if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if ans = 'confirmed' then
      perform public._employment_notify(
        ag::uuid, 'boarding_confirmed', uid,
        jsonb_build_object('candidateId', uid)
      );
    else
      perform public._employment_notify(
        ag::uuid, 'boarding_missed', uid,
        jsonb_build_object('candidateId', uid, 'openWorkStart', true)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.candidate_answer_boarding(text) from public;
grant execute on function public.candidate_answer_boarding(text) to authenticated;

-- Tarama: boarding sor + cevap yok yükselt + mevcut employment scan
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
  n_board_escal int := 0;
  r record;
  check_day date;
begin
  -- Erken ayrılış sessizlik
  for r in
    select id from public.employment_episodes
    where outcome = 'early_exit_pending'
      and silence_deadline_at is not null
      and silence_deadline_at <= now()
  loop
    perform public._finalize_employment_episode(r.id, 'early_exit', null, 'silence');
    n_silence := n_silence + 1;
  end loop;

  -- Süre dolumu → sertifika
  for r in
    select id from public.employment_episodes
    where outcome = 'active'
      and planned_end_at is not null
      and planned_end_at <= now()
  loop
    perform public._finalize_employment_episode(r.id, 'completed', null, 'work_end_at');
    n_complete := n_complete + 1;
  end loop;

  -- Pending bitmek üzere hatırlatma
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

  -- Boarding: uçuş günü (veya işe başlama) gelince adaya sor
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at, cs.boarding_asked_at
    from public.candidate_status cs
    where cs.status = 'hired'
      and cs.boarding_status = 'pending'
      and coalesce(cs.flight_depart_on, cs.work_start_at) is not null
      and coalesce(cs.flight_depart_on, cs.work_start_at) <= current_date
      and (cs.boarding_asked_at is null or cs.boarding_asked_at < now() - interval '20 hours')
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

  -- 48s cevap yok → acenteye yükselt
  for r in
    select cs.user_id, cs.accepted_by, cs.boarding_asked_at
    from public.candidate_status cs
    where cs.status = 'hired'
      and cs.boarding_status = 'pending'
      and cs.boarding_asked_at is not null
      and cs.boarding_asked_at <= now() - interval '48 hours'
  loop
    if r.accepted_by is not null and r.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._employment_notify(
        r.accepted_by::uuid, 'boarding_no_response', r.user_id,
        jsonb_build_object('candidateId', r.user_id, 'openWorkStart', true)
      );
    end if;
    update public.candidate_status
      set boarding_status = 'no_response', updated_at = now()
      where user_id = r.user_id;
    n_board_escal := n_board_escal + 1;
  end loop;

  return jsonb_build_object(
    'silence', n_silence,
    'completed', n_complete,
    'boardingAsked', n_board_ask,
    'boardingEscalated', n_board_escal
  );
end;
$$;

-- Finalize: boarding alanlarını da temizle
create or replace function public._finalize_employment_episode(
  p_episode uuid,
  p_outcome text,
  p_actor uuid default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ep public.employment_episodes%rowtype;
  snap jsonb;
begin
  if p_outcome not in ('completed', 'early_exit') then
    raise exception 'bad_outcome';
  end if;

  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome in ('completed', 'early_exit') then
    return;
  end if;

  snap := coalesce(ep.contract_snapshot, public._contract_snapshot(ep.candidate_id));

  update public.employment_episodes
  set outcome = p_outcome,
      ended_at = coalesce(ended_at, now()),
      contract_snapshot = snap,
      employer_title = coalesce(nullif(employer_title, ''), snap->>'title'),
      "position" = coalesce(nullif(ep.position, ''), snap->>'position'),
      resolved_by = coalesce(p_actor, resolved_by),
      resolved_at = case when p_actor is not null then now() else resolved_at end,
      resolve_note = coalesce(p_note, resolve_note),
      silence_deadline_at = null,
      updated_at = now()
  where id = p_episode;

  insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
  values (ep.agency_id, ep.candidate_id, ep.hired_at, now())
  on conflict (agency_id, candidate_id) do update
    set ended_at = now(),
        hired_at = least(agency_employment_log.hired_at, excluded.hired_at),
        updated_at = now();

  delete from public.contracts where user_id = ep.candidate_id;
  delete from public.flights where user_id = ep.candidate_id;
  delete from public.interviews where user_id = ep.candidate_id;
  delete from public.user_documents where user_id = ep.candidate_id;
  delete from public.agency_cv_overrides where candidate_id = ep.candidate_id;

  update public.candidate_status
  set status = 'new',
      docs_unlocked = false,
      stage = 0,
      accepted_by = null,
      accepted_at = null,
      offered_at = null,
      hired_at = null,
      work_end_at = null,
      work_start_at = null,
      flight_depart_on = null,
      boarding_status = null,
      boarding_asked_at = null,
      boarding_answered_at = null,
      docs_deadline_notified_at = null,
      updated_at = now()
  where user_id = ep.candidate_id;

  perform public._refresh_turquz_certified(ep.candidate_id);

  perform public._employment_notify(
    ep.candidate_id,
    case when p_outcome = 'completed' then 'employment_completed' else 'employment_early_exit' end,
    ep.agency_id,
    jsonb_build_object('episodeId', p_episode, 'outcome', p_outcome, 'employerTitle', coalesce(snap->>'title', ep.employer_title))
  );
  perform public._employment_notify(
    ep.agency_id,
    case when p_outcome = 'completed' then 'employment_completed' else 'employment_early_exit' end,
    ep.candidate_id,
    jsonb_build_object('episodeId', p_episode, 'outcome', p_outcome, 'employerTitle', coalesce(snap->>'title', ep.employer_title))
  );
end;
$$;

notify pgrst, 'reload schema';
