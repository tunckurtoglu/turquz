-- 0082_in_transit_hire.sql
-- Uçak bileti → in_transit (henüz personel değil).
-- Personel: acente işe başlama onayı veya manuel promote.
-- Boarding, in_transit iken de çalışır. Episode yalnız hired'da açılır.
-- Çalıştırma: 0081'den sonra SQL Editor > Run.

alter table public.candidate_status
  add column if not exists work_start_asked_at timestamptz,
  add column if not exists work_start_remind_count int not null default 0;

-- Havuz: hired + in_transit dışarıda
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    p.turquz_certified
  from public.profiles p
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not public.is_user_staff(p.user_id)
    and coalesce(cs.status, '') not in ('hired', 'in_transit')
    and (p.pool_passive_until is null or p.pool_passive_until <= now());
grant select on public.candidate_pool to authenticated;

-- Transit görünümü (personel değil; yolda / başlangıç bekliyor)
drop view if exists public.candidate_in_transit;
create view public.candidate_in_transit with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    p.turquz_certified,
    cs.work_start_at, cs.flight_depart_on, cs.planned_end_on, cs.boarding_status,
    cs.accepted_by, cs.work_start_asked_at, cs.work_start_remind_count
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'in_transit';
grant select on public.candidate_in_transit to authenticated;

-- Ortak: in_transit → hired + episode
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
    perform public._employment_notify(
      ag::uuid, 'employment_started', p_candidate,
      jsonb_build_object('candidateId', p_candidate, 'workStartAt', wstart)
    );
  end if;
end;
$$;

revoke all on function public._promote_to_hired(uuid) from public;

-- Acente: işe başladı → personel
create or replace function public.agency_confirm_hire(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null then raise exception 'bad_request'; end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.candidate_status cs
      where cs.user_id = p_candidate
        and cs.accepted_by = auth.uid()::text
        and cs.status = 'in_transit'
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  perform public._promote_to_hired(p_candidate);
end;
$$;

revoke all on function public.agency_confirm_hire(uuid) from public;
grant execute on function public.agency_confirm_hire(uuid) to authenticated;

-- Acente: henüz başlamadı → yeni tarih
create or replace function public.agency_defer_work_start(p_candidate uuid, p_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pend date;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null or p_start is null then raise exception 'bad_request'; end if;
  if p_start < current_date then raise exception 'bad_start_date'; end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.candidate_status cs
      where cs.user_id = p_candidate
        and cs.accepted_by = auth.uid()::text
        and cs.status = 'in_transit'
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  select coalesce(planned_end_on, (p_start + interval '1 year')::date) into pend
  from public.candidate_status where user_id = p_candidate;
  if pend <= p_start then
    pend := (p_start + interval '1 year')::date;
  end if;

  update public.candidate_status
  set work_start_at = p_start,
      planned_end_on = pend,
      work_start_asked_at = null,
      work_start_remind_count = 0,
      updated_at = now()
  where user_id = p_candidate
    and status = 'in_transit';
end;
$$;

revoke all on function public.agency_defer_work_start(uuid, date) from public;
grant execute on function public.agency_defer_work_start(uuid, date) to authenticated;

-- Bilet gönderilince: in_transit + boarding; episode YOK
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wstart date;
  fdep date;
  pend date;
  ag text;
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

    update public.candidate_status
      set status = 'in_transit',
          hired_at = null,
          work_start_at = wstart,
          planned_end_on = pend,
          -- work_end_at episode açılınca set edilir
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
          'plannedEndOn', pend,
          'inTransit', true
        )
      );
    end if;
  end if;
  return new;
end $$;

-- Tarih güncellemesi: in_transit boarding reset + confirm sorusu sıfırla
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
        when status in ('hired', 'in_transit')
          and boarding_status in ('missed', 'no_response')
          and p_flight_depart is not null
          then 'pending'
        else boarding_status
      end,
      boarding_asked_at = case
        when status in ('hired', 'in_transit')
          and boarding_status in ('missed', 'no_response')
          and p_flight_depart is not null
          then null
        else boarding_asked_at
      end,
      boarding_answered_at = case
        when status in ('hired', 'in_transit')
          and boarding_status in ('missed', 'no_response')
          and p_flight_depart is not null
          then null
        else boarding_answered_at
      end,
      work_start_asked_at = case when status = 'in_transit' then null else work_start_asked_at end,
      work_start_remind_count = case when status = 'in_transit' then 0 else work_start_remind_count end,
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

-- Boarding: in_transit veya hired
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
    where user_id = uid
      and status in ('hired', 'in_transit')
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

-- Scan: boarding (transit+hired) + işe başlama onayı + sessizlik hatırlatması
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
  n_start_ask int := 0;
  n_start_remind int := 0;
  r record;
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

  -- Boarding: hired VEYA in_transit
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at, cs.boarding_asked_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
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

  for r in
    select cs.user_id, cs.accepted_by, cs.boarding_asked_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
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

  -- İşe başlama onayı (ilk soru): work_start_at <= bugün, in_transit, henüz sorulmamış
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

  -- Sessizlik hatırlatması: soruldu, 2+ gün cevap yok, en fazla 3 hatırlatma, 48s aralık
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
    'boardingEscalated', n_board_escal,
    'workStartAsked', n_start_ask,
    'workStartReminded', n_start_remind
  );
end;
$$;

notify pgrst, 'reload schema';
