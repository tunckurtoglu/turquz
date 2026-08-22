-- 0095: sezon bitişi çift onay; otomatik sertifika yok. Admin kuyruk + yanlış kesinleşmeyi geri al.
-- Çalıştırma: 0094'ten sonra SQL Editor > Run.

do $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'employment_episodes'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%outcome%'
  loop
    execute format('alter table public.employment_episodes drop constraint %I', c);
  end loop;
end $$;

alter table public.employment_episodes
  add constraint employment_episodes_outcome_check
  check (outcome in (
    'active', 'early_exit_pending', 'completion_pending', 'disputed', 'completed', 'early_exit'
  ));

alter table public.employment_episodes
  add column if not exists term_vote_candidate text
    check (term_vote_candidate is null or term_vote_candidate in ('ok', 'problem')),
  add column if not exists term_vote_agency text
    check (term_vote_agency is null or term_vote_agency in ('ok', 'problem')),
  add column if not exists term_vote_candidate_at timestamptz,
  add column if not exists term_vote_agency_at timestamptz;

drop index if exists public.employment_episodes_one_open_idx;
create unique index employment_episodes_one_open_idx
  on public.employment_episodes (candidate_id)
  where outcome in ('active', 'early_exit_pending', 'completion_pending', 'disputed');

create or replace function public.get_my_employment_episode()
returns public.employment_episodes
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.employment_episodes e
  where e.candidate_id = auth.uid()
    and e.outcome in ('active', 'early_exit_pending', 'completion_pending', 'disputed')
  order by e.created_at desc
  limit 1;
$$;

create or replace function public.get_candidate_employment_episode(p_candidate uuid)
returns public.employment_episodes
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.employment_episodes e
  where e.candidate_id = p_candidate
    and e.outcome in ('active', 'early_exit_pending', 'completion_pending', 'disputed')
    and (public.is_staff() or public.is_admin() or e.agency_id = auth.uid() or e.candidate_id = auth.uid())
  order by e.created_at desc
  limit 1;
$$;

create or replace function public.answer_employment_term(p_episode uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
  role_txt text;
  cand_v text;
  ag_v text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_answer not in ('ok', 'problem') then raise exception 'bad_answer'; end if;

  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'completion_pending' then raise exception 'not_term_pending'; end if;

  if uid = ep.candidate_id then role_txt := 'candidate';
  elsif uid = ep.agency_id or public.is_admin() then role_txt := 'agency';
  else raise exception 'forbidden';
  end if;

  if p_answer = 'problem' then
    update public.employment_episodes
    set outcome = 'disputed',
        contest_by = uid,
        contest_at = now(),
        contest_note = 'term_problem',
        silence_deadline_at = null,
        term_vote_candidate = case when role_txt = 'candidate' then 'problem' else term_vote_candidate end,
        term_vote_agency = case when role_txt = 'agency' then 'problem' else term_vote_agency end,
        term_vote_candidate_at = case when role_txt = 'candidate' then now() else term_vote_candidate_at end,
        term_vote_agency_at = case when role_txt = 'agency' then now() else term_vote_agency_at end,
        updated_at = now()
    where id = p_episode;
    perform public._employment_notify(ep.candidate_id, 'employment_disputed', uid, jsonb_build_object('episodeId', p_episode, 'source', 'term'));
    perform public._employment_notify(ep.agency_id, 'employment_disputed', uid, jsonb_build_object('episodeId', p_episode, 'source', 'term'));
    return;
  end if;

  if role_txt = 'candidate' then
    update public.employment_episodes
      set term_vote_candidate = 'ok', term_vote_candidate_at = now(), updated_at = now()
      where id = p_episode;
  else
    update public.employment_episodes
      set term_vote_agency = 'ok', term_vote_agency_at = now(), updated_at = now()
      where id = p_episode;
  end if;

  select term_vote_candidate, term_vote_agency into cand_v, ag_v
  from public.employment_episodes where id = p_episode;

  if cand_v = 'ok' and ag_v = 'ok' then
    perform public._finalize_employment_episode(p_episode, 'completed', uid, 'term_both_ok');
  else
    perform public._employment_notify(
      case when role_txt = 'candidate' then ep.agency_id else ep.candidate_id end,
      'employment_term_voted',
      uid,
      jsonb_build_object('episodeId', p_episode, 'role', role_txt, 'answer', 'ok')
    );
  end if;
end;
$$;

revoke all on function public.answer_employment_term(uuid, text) from public;
grant execute on function public.answer_employment_term(uuid, text) to authenticated;

create or replace function public.admin_list_employment_disputes()
returns setof public.employment_episodes
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.employment_episodes e
  where public.is_admin()
    and e.outcome in ('disputed', 'completion_pending', 'early_exit_pending')
  order by
    case e.outcome when 'disputed' then 0 when 'completion_pending' then 1 else 2 end,
    coalesce(e.contest_at, e.silence_deadline_at, e.updated_at) desc nulls last;
$$;

create or replace function public.admin_list_employment_closed(p_days int default 90)
returns setof public.employment_episodes
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.employment_episodes e
  where public.is_admin()
    and e.outcome in ('completed', 'early_exit')
    and e.ended_at is not null
    and e.ended_at >= now() - make_interval(days => greatest(coalesce(p_days, 90), 1))
  order by e.ended_at desc
  limit 80;
$$;

revoke all on function public.admin_list_employment_closed(int) from public;
grant execute on function public.admin_list_employment_closed(int) to authenticated;

create or replace function public.admin_resolve_employment(
  p_episode uuid,
  p_decision text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
  pend timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;

  if p_decision = 'restore' then
    if ep.outcome not in ('completed', 'early_exit') then raise exception 'bad_state'; end if;
    if exists (
      select 1 from public.candidate_status cs
      where cs.user_id = ep.candidate_id
        and cs.status in ('hired', 'in_transit', 'accepted', 'offered')
    ) then
      raise exception 'candidate_busy';
    end if;
    if exists (
      select 1 from public.employment_episodes x
      where x.candidate_id = ep.candidate_id
        and x.id <> ep.id
        and x.outcome in ('active', 'early_exit_pending', 'completion_pending', 'disputed')
    ) then
      raise exception 'open_episode';
    end if;

    pend := coalesce(ep.planned_end_at, now() + interval '30 days');
    update public.employment_episodes
    set outcome = 'active',
        ended_at = null,
        silence_deadline_at = null,
        term_vote_candidate = null,
        term_vote_agency = null,
        term_vote_candidate_at = null,
        term_vote_agency_at = null,
        end_requested_by = null,
        end_requested_at = null,
        end_request_role = null,
        end_reason = null,
        contest_by = null,
        contest_at = null,
        contest_note = null,
        resolved_by = uid,
        resolved_at = now(),
        resolve_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), 'admin_restore'),
        updated_at = now()
    where id = p_episode;

    update public.candidate_status
    set status = 'hired',
        accepted_by = ep.agency_id::text,
        hired_at = coalesce(ep.hired_at, now()),
        work_start_at = coalesce(ep.work_start_at, work_start_at),
        work_end_at = pend,
        planned_end_on = pend::date,
        docs_unlocked = true,
        updated_at = now()
    where user_id = ep.candidate_id;

    insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
    values (ep.agency_id, ep.candidate_id, coalesce(ep.hired_at, now()), null)
    on conflict (agency_id, candidate_id) do update
      set ended_at = null, updated_at = now();

    perform public._refresh_turquz_certified(ep.candidate_id);
    perform public._employment_notify(ep.candidate_id, 'employment_restored', uid, jsonb_build_object('episodeId', p_episode));
    perform public._employment_notify(ep.agency_id, 'employment_restored', uid, jsonb_build_object('episodeId', p_episode, 'candidateId', ep.candidate_id));
    return;
  end if;

  if ep.outcome not in ('disputed', 'early_exit_pending', 'completion_pending') then
    raise exception 'bad_state';
  end if;

  if p_decision = 'continue' then
    pend := greatest(coalesce(ep.planned_end_at, now()), now()) + interval '30 days';
    update public.employment_episodes
    set outcome = 'active',
        planned_end_at = pend,
        end_requested_by = null,
        end_requested_at = null,
        end_request_role = null,
        end_reason = null,
        contest_by = null,
        contest_at = null,
        contest_note = null,
        silence_deadline_at = null,
        term_vote_candidate = null,
        term_vote_agency = null,
        term_vote_candidate_at = null,
        term_vote_agency_at = null,
        resolved_by = uid,
        resolved_at = now(),
        resolve_note = nullif(trim(coalesce(p_note, '')), ''),
        updated_at = now()
    where id = p_episode;
    update public.candidate_status
      set work_end_at = pend, planned_end_on = pend::date, updated_at = now()
      where user_id = ep.candidate_id;
    perform public._employment_notify(ep.candidate_id, 'employment_continued', uid, jsonb_build_object('episodeId', p_episode, 'note', p_note));
    perform public._employment_notify(ep.agency_id, 'employment_continued', uid, jsonb_build_object('episodeId', p_episode, 'note', p_note));
  elsif p_decision = 'early_exit' then
    perform public._finalize_employment_episode(p_episode, 'early_exit', uid, p_note);
  elsif p_decision = 'completed' then
    perform public._finalize_employment_episode(p_episode, 'completed', uid, coalesce(p_note, 'admin_completed'));
  else
    raise exception 'bad_decision';
  end if;
end;
$$;

create or replace function public.scan_employment_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_silence int := 0;
  n_complete int := 0;
  n_term_ask int := 0;
  n_term_remind int := 0;
  n_term_stalled int := 0;
  n_board_ask int := 0;
  n_board_remind int := 0;
  n_board_escal int := 0;
  n_start_ask int := 0;
  n_start_remind int := 0;
  n_board_agency_remind int := 0;
  n_stalled int := 0;
  r record;
  adm record;
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
    select id, candidate_id, agency_id, employer_title, planned_end_at
    from public.employment_episodes
    where outcome = 'active'
      and planned_end_at is not null
      and planned_end_at <= now()
  loop
    update public.employment_episodes
    set outcome = 'completion_pending',
        silence_deadline_at = now() + interval '7 days',
        term_vote_candidate = null,
        term_vote_agency = null,
        term_vote_candidate_at = null,
        term_vote_agency_at = null,
        updated_at = now()
    where id = r.id;
    perform public._employment_notify(
      r.candidate_id, 'employment_term_due', r.agency_id,
      jsonb_build_object('episodeId', r.id, 'plannedEndAt', r.planned_end_at, 'employerTitle', r.employer_title)
    );
    perform public._employment_notify(
      r.agency_id, 'employment_term_due', r.candidate_id,
      jsonb_build_object('episodeId', r.id, 'candidateId', r.candidate_id, 'plannedEndAt', r.planned_end_at, 'employerTitle', r.employer_title)
    );
    n_term_ask := n_term_ask + 1;
  end loop;

  for r in
    select e.id, e.candidate_id, e.agency_id, e.employer_title, e.silence_deadline_at
    from public.employment_episodes e
    where e.outcome = 'completion_pending'
      and e.silence_deadline_at is not null
      and e.silence_deadline_at > now()
      and e.silence_deadline_at <= now() + interval '48 hours'
      and not exists (
        select 1 from public.notifications n
        where n.type = 'employment_term_remind'
          and n.payload->>'episodeId' = e.id::text
          and n.created_at > now() - interval '20 hours'
      )
  loop
    perform public._employment_notify(
      r.candidate_id, 'employment_term_remind', r.agency_id,
      jsonb_build_object('episodeId', r.id, 'silenceDeadlineAt', r.silence_deadline_at, 'employerTitle', r.employer_title)
    );
    perform public._employment_notify(
      r.agency_id, 'employment_term_remind', r.candidate_id,
      jsonb_build_object('episodeId', r.id, 'candidateId', r.candidate_id, 'silenceDeadlineAt', r.silence_deadline_at)
    );
    n_term_remind := n_term_remind + 1;
  end loop;

  -- 7 gün sessizlik: sertifika/havuz yok — admin kuyruğu
  for r in
    select e.id, e.candidate_id, e.agency_id, e.employer_title
    from public.employment_episodes e
    where e.outcome = 'completion_pending'
      and e.silence_deadline_at is not null
      and e.silence_deadline_at <= now()
      and not exists (
        select 1 from public.notifications n
        where n.type = 'employment_term_stalled'
          and n.payload->>'episodeId' = e.id::text
          and n.created_at > now() - interval '7 days'
      )
  loop
    for adm in
      select ur.user_id from public.user_roles ur where ur.role = 'admin'
    loop
      perform public._employment_notify(
        adm.user_id, 'employment_term_stalled', r.candidate_id,
        jsonb_build_object(
          'episodeId', r.id,
          'candidateId', r.candidate_id,
          'agencyId', r.agency_id,
          'employerTitle', r.employer_title
        )
      );
    end loop;
    n_term_stalled := n_term_stalled + 1;
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

  -- Acente de susarsa: 24s aralık, en fazla 3 boarding_no_response. Adaya son bir biniş sorusu.
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
      and cs.boarding_status = 'no_response'
      and cs.accepted_by is not null
      and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        select count(*) from public.notifications n
        where n.user_id = cs.accepted_by::uuid
          and n.type = 'boarding_no_response'
          and n.ref_user = cs.user_id
      ) < 3
      and not exists (
        select 1 from public.notifications n
        where n.user_id = cs.accepted_by::uuid
          and n.type = 'boarding_no_response'
          and n.ref_user = cs.user_id
          and n.created_at > now() - interval '24 hours'
      )
  loop
    perform public._employment_notify(
      r.accepted_by::uuid, 'boarding_no_response', r.user_id,
      jsonb_build_object('candidateId', r.user_id, 'openBoardingResolve', true, 'remind', true)
    );
    if (
      select count(*) from public.notifications n
      where n.user_id = r.user_id and n.type = 'boarding_check'
    ) < 3 then
      perform public._employment_notify(
        r.user_id, 'boarding_check', nullif(r.accepted_by, '')::uuid,
        jsonb_build_object(
          'flightDepartOn', r.flight_depart_on,
          'workStartAt', r.work_start_at,
          'lastChance', true
        )
      );
    end if;
    n_board_agency_remind := n_board_agency_remind + 1;
  end loop;

  -- İşe başlama hatırlatmaları bitti, hâlâ Yolda → acente + admin. Personel/havuz otomatik değil.
  for r in
    select cs.user_id, cs.accepted_by, cs.work_start_at, cs.boarding_status
    from public.candidate_status cs
    where cs.status = 'in_transit'
      and cs.work_start_asked_at is not null
      and coalesce(cs.work_start_remind_count, 0) >= 3
      and not exists (
        select 1 from public.notifications n
        where n.type = 'work_start_remind'
          and n.ref_user = cs.user_id
          and n.created_at > now() - interval '48 hours'
      )
      and not exists (
        select 1 from public.notifications n
        where n.type = 'transit_stalled'
          and n.ref_user = cs.user_id
          and n.created_at > now() - interval '7 days'
      )
  loop
    if r.accepted_by is not null and r.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform public._employment_notify(
        r.accepted_by::uuid, 'transit_stalled', r.user_id,
        jsonb_build_object(
          'candidateId', r.user_id,
          'workStartAt', r.work_start_at,
          'boardingStatus', r.boarding_status,
          'openHireConfirm', true
        )
      );
    end if;
    for adm in
      select ur.user_id from public.user_roles ur where ur.role = 'admin'
    loop
      perform public._employment_notify(
        adm.user_id, 'transit_stalled', r.user_id,
        jsonb_build_object(
          'candidateId', r.user_id,
          'workStartAt', r.work_start_at,
          'boardingStatus', r.boarding_status,
          'agencyId', r.accepted_by
        )
      );
    end loop;
    n_stalled := n_stalled + 1;
  end loop;

  return jsonb_build_object(
    'silence', n_silence,
    'completed', n_complete,
    'termAsked', n_term_ask,
    'termReminded', n_term_remind,
    'termStalled', n_term_stalled,
    'boardingAsked', n_board_ask,
    'boardingReminded', n_board_remind,
    'boardingEscalated', n_board_escal,
    'boardingAgencyReminded', n_board_agency_remind,
    'workStartAsked', n_start_ask,
    'workStartReminded', n_start_remind,
    'transitStalled', n_stalled
  );
end;
$$;

notify pgrst, 'reload schema';

create or replace function public.request_employment_end(
  p_candidate uuid default null,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cand uuid;
  ep public.employment_episodes%rowtype;
  role_txt text;
  other uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  cand := coalesce(p_candidate, uid);

  select * into ep
  from public.employment_episodes
  where candidate_id = cand
    and outcome in ('active', 'early_exit_pending', 'completion_pending', 'disputed')
  order by created_at desc
  limit 1
  for update;

  if not found then
    if exists (
      select 1 from public.candidate_status cs
      where cs.user_id = cand and cs.status = 'hired'
        and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) then
      insert into public.employment_episodes (
        candidate_id, agency_id, employer_title, position,
        hired_at, planned_end_at, outcome, contract_snapshot
      )
      select
        cs.user_id, cs.accepted_by::uuid, c.title, c.position,
        coalesce(cs.hired_at, now()), cs.work_end_at, 'active',
        public._contract_snapshot(cs.user_id)
      from public.candidate_status cs
      left join public.contracts c on c.user_id = cs.user_id
      where cs.user_id = cand
      returning * into ep;
    else
      raise exception 'not_hired';
    end if;
  end if;

  if ep.outcome = 'disputed' then raise exception 'disputed'; end if;
  if ep.outcome = 'completion_pending' then raise exception 'term_confirm_open'; end if;
  if ep.outcome = 'early_exit_pending' then return ep.id; end if;

  if uid = ep.candidate_id then
    role_txt := 'candidate';
  elsif uid = ep.agency_id or public.is_admin() then
    if not public.is_staff() and not public.is_admin() then raise exception 'forbidden'; end if;
    role_txt := 'agency';
  else
    raise exception 'forbidden';
  end if;

  update public.employment_episodes
  set outcome = 'early_exit_pending',
      end_requested_by = uid,
      end_requested_at = now(),
      end_request_role = role_txt,
      end_reason = nullif(trim(coalesce(p_reason, '')), ''),
      silence_deadline_at = now() + interval '7 days',
      contest_by = null,
      contest_at = null,
      contest_note = null,
      updated_at = now()
  where id = ep.id;

  other := case when role_txt = 'candidate' then ep.agency_id else ep.candidate_id end;
  perform public._employment_notify(
    other, 'employment_end_requested', uid,
    jsonb_build_object('episodeId', ep.id, 'role', role_txt, 'employerTitle', ep.employer_title, 'silenceDeadlineAt', (now() + interval '7 days'))
  );
  perform public._employment_notify(
    uid, 'employment_end_requested_ack', other,
    jsonb_build_object('episodeId', ep.id, 'role', role_txt, 'silenceDeadlineAt', (now() + interval '7 days'))
  );
  return ep.id;
end;
$$;

notify pgrst, 'reload schema';
