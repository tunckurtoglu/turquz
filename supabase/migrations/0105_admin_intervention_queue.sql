-- 0105: Admin müdahale kuyruğu — sessiz taraflar, audit log, aday adına biniş cevabı.
-- Çalıştırma: SQL Editor > Run.

create table if not exists public.admin_intervention_log (
  id bigserial primary key,
  admin_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid,
  episode_id uuid references public.employment_episodes (id) on delete set null,
  kind text not null,
  action text not null,
  note text,
  ctx jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_intervention_log_created_idx
  on public.admin_intervention_log (created_at desc);

alter table public.admin_intervention_log enable row level security;

drop policy if exists admin_intervention_log_select on public.admin_intervention_log;
create policy admin_intervention_log_select on public.admin_intervention_log
  for select to authenticated
  using (public.is_admin());

revoke all on table public.admin_intervention_log from public;
grant select on table public.admin_intervention_log to authenticated;
grant insert on table public.admin_intervention_log to service_role;

-- Admin: aday adına uçuş teyidi
create or replace function public.admin_answer_boarding_for_candidate(
  p_candidate uuid,
  p_answer text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ag text;
  ans text := lower(trim(p_answer));
  cur_status text;
  cur_board text;
  gate date;
  today_tr date := (timezone('Europe/Istanbul', now()))::date;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_candidate is null then raise exception 'bad_request'; end if;
  if ans not in ('confirmed', 'missed') then raise exception 'bad_answer'; end if;

  select cs.status, cs.boarding_status, coalesce(cs.flight_depart_on, cs.work_start_at)
    into cur_status, cur_board, gate
  from public.candidate_status cs
  where cs.user_id = p_candidate;

  if cur_status is null
     or cur_status not in ('hired', 'in_transit')
     or cur_board is null
     or cur_board not in ('pending', 'no_response') then
    raise exception 'not_pending';
  end if;

  if gate is not null and gate > today_tr then
    raise exception 'boarding_too_early';
  end if;

  update public.candidate_status
  set boarding_status = ans,
      boarding_answered_at = now(),
      updated_at = now()
  where user_id = p_candidate
  returning accepted_by into ag;

  if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if ans = 'confirmed' then
      perform public._employment_notify(
        ag::uuid, 'boarding_confirmed', p_candidate,
        jsonb_build_object('candidateId', p_candidate, 'byAdmin', true)
      );
    else
      perform public._employment_notify(
        ag::uuid, 'boarding_missed', p_candidate,
        jsonb_build_object('candidateId', p_candidate, 'openWorkStart', true, 'byAdmin', true)
      );
    end if;
  end if;

  insert into public.admin_intervention_log (admin_id, candidate_id, kind, action, note, ctx)
  values (
    auth.uid(), p_candidate, 'boarding_candidate_silent', ans,
    nullif(trim(p_note), ''),
    jsonb_build_object('answer', ans)
  );
end;
$$;

revoke all on function public.admin_answer_boarding_for_candidate(uuid, text, text) from public;
grant execute on function public.admin_answer_boarding_for_candidate(uuid, text, text) to authenticated;

create or replace function public.admin_list_interventions()
returns table (
  queue_id text,
  kind text,
  priority int,
  candidate_id uuid,
  agency_id uuid,
  candidate_title text,
  agency_title text,
  silent_party text,
  detail text,
  since_at timestamptz,
  episode_id uuid,
  ctx jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select q.* from (
  -- Uçuş: aday 16s+ cevapsız
  select
    'boarding:' || cs.user_id::text,
    'boarding_candidate_silent',
    20,
    cs.user_id,
    nullif(cs.accepted_by, '')::uuid,
    coalesce(cp.title, cp.reg_no::text, left(cs.user_id::text, 8)),
    coalesce(ap.title, ap.reg_no::text, left(cs.accepted_by, 8)),
    'candidate',
    'Uçuş teyidi bekleniyor · kalkış ' || coalesce(cs.flight_depart_on::text, cs.work_start_at::text, '—'),
    cs.boarding_asked_at,
    null::uuid,
    jsonb_build_object(
      'boardingStatus', cs.boarding_status,
      'flightDepartOn', cs.flight_depart_on,
      'workStartAt', cs.work_start_at
    )
  from public.candidate_status cs
  join public.profiles cp on cp.user_id = cs.user_id
  left join public.profiles ap on ap.user_id = nullif(cs.accepted_by, '')::uuid
  where public.is_admin()
    and cs.status in ('hired', 'in_transit')
    and cs.boarding_status = 'pending'
    and cs.boarding_asked_at is not null
    and cs.boarding_asked_at <= now() - interval '16 hours'

  union all

  -- Uçuş: acente cevap bekliyor (aday cevapsız → no_response)
  select
    'boarding_agency:' || cs.user_id::text,
    'boarding_agency_silent',
    25,
    cs.user_id,
    nullif(cs.accepted_by, '')::uuid,
    coalesce(cp.title, cp.reg_no::text, left(cs.user_id::text, 8)),
    coalesce(ap.title, ap.reg_no::text, left(cs.accepted_by, 8)),
    'agency',
    'Aday uçağa binmedi teyidi · acente geldi/gelmedi seçmeli',
    cs.updated_at,
    null::uuid,
    jsonb_build_object(
      'boardingStatus', cs.boarding_status,
      'flightDepartOn', cs.flight_depart_on,
      'workStartAt', cs.work_start_at
    )
  from public.candidate_status cs
  join public.profiles cp on cp.user_id = cs.user_id
  left join public.profiles ap on ap.user_id = nullif(cs.accepted_by, '')::uuid
  where public.is_admin()
    and cs.status in ('hired', 'in_transit')
    and cs.boarding_status = 'no_response'

  union all

  -- İşe başlama: 14+ gün takılı (transit_stalled)
  select
    'transit_stalled:' || cs.user_id::text,
    'transit_stalled',
    5,
    cs.user_id,
    nullif(cs.accepted_by, '')::uuid,
    coalesce(cp.title, cp.reg_no::text, left(cs.user_id::text, 8)),
    coalesce(ap.title, ap.reg_no::text, left(cs.accepted_by, 8)),
    'both',
    '14+ gün yolda · işe başlama onayı yok · ' || cs.work_start_at::text,
    coalesce(cs.work_start_asked_at, cs.work_start_at::timestamptz),
    null::uuid,
    jsonb_build_object(
      'workStartAt', cs.work_start_at,
      'boardingStatus', cs.boarding_status,
      'remindCount', cs.work_start_remind_count
    )
  from public.candidate_status cs
  join public.profiles cp on cp.user_id = cs.user_id
  left join public.profiles ap on ap.user_id = nullif(cs.accepted_by, '')::uuid
  where public.is_admin()
    and cs.status = 'in_transit'
    and cs.work_start_asked_at is not null
    and cs.work_start_at is not null
    and cs.work_start_at <= current_date - 14

  union all

  -- İşe başlama: tarih geçti, acente onayı bekleniyor (<14 gün)
  select
    'work_start:' || cs.user_id::text,
    'work_start_pending',
    30,
    cs.user_id,
    nullif(cs.accepted_by, '')::uuid,
    coalesce(cp.title, cp.reg_no::text, left(cs.user_id::text, 8)),
    coalesce(ap.title, ap.reg_no::text, left(cs.accepted_by, 8)),
    'agency',
    'İşe başlama onayı · ' || cs.work_start_at::text,
    coalesce(cs.work_start_asked_at, cs.work_start_at::timestamptz),
    null::uuid,
    jsonb_build_object(
      'workStartAt', cs.work_start_at,
      'boardingStatus', cs.boarding_status,
      'remindCount', cs.work_start_remind_count
    )
  from public.candidate_status cs
  join public.profiles cp on cp.user_id = cs.user_id
  left join public.profiles ap on ap.user_id = nullif(cs.accepted_by, '')::uuid
  where public.is_admin()
    and cs.status = 'in_transit'
    and cs.work_start_asked_at is not null
    and cs.work_start_at is not null
    and cs.work_start_at <= current_date
    and cs.work_start_at > current_date - 14

  union all

  -- İstihdam: itiraz / dönem / ayrılış
  select
    'employment:' || e.id::text,
    case e.outcome
      when 'disputed' then 'employment_disputed'
      when 'completion_pending' then 'employment_term'
      else 'employment_exit'
    end,
    case e.outcome
      when 'disputed' then 1
      when 'completion_pending' then 40
      else 45
    end,
    e.candidate_id,
    e.agency_id,
    coalesce(cp.title, cp.reg_no::text, left(e.candidate_id::text, 8)),
    coalesce(ap.title, ap.reg_no::text, left(e.agency_id::text, 8)),
    case
      when e.outcome = 'disputed' then 'both'
      when e.outcome = 'completion_pending'
        and e.term_vote_candidate is null and e.term_vote_agency is not null then 'candidate'
      when e.outcome = 'completion_pending'
        and e.term_vote_agency is null and e.term_vote_candidate is not null then 'agency'
      when e.outcome = 'completion_pending' then 'both'
      else coalesce(e.end_request_role, 'both')
    end,
    case e.outcome
      when 'disputed' then coalesce(e.contest_note, 'İtiraz')
      when 'completion_pending' then
        'Dönem oyu · aday: ' || coalesce(e.term_vote_candidate, '—')
        || ' · acente: ' || coalesce(e.term_vote_agency, '—')
      else coalesce(e.end_reason, 'Erken ayrılış talebi')
    end,
    coalesce(e.contest_at, e.end_requested_at, e.silence_deadline_at, e.updated_at),
    e.id,
    jsonb_build_object(
      'outcome', e.outcome,
      'employerTitle', e.employer_title,
      'termVoteCandidate', e.term_vote_candidate,
      'termVoteAgency', e.term_vote_agency,
      'silenceDeadlineAt', e.silence_deadline_at,
      'endRequestRole', e.end_request_role
    )
  from public.employment_episodes e
  join public.profiles cp on cp.user_id = e.candidate_id
  left join public.profiles ap on ap.user_id = e.agency_id
  where public.is_admin()
    and e.outcome in ('disputed', 'completion_pending', 'early_exit_pending')
  ) q
  order by 3 asc, 10 asc nulls last;
$$;

revoke all on function public.admin_list_interventions() from public;
grant execute on function public.admin_list_interventions() to authenticated;

create or replace function public.admin_intervention_act(
  p_queue_id text,
  p_action text,
  p_note text default null,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kind_prefix text;
  ref_id uuid;
  act text := lower(trim(p_action));
  defer_date date;
  log_kind text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_queue_id is null or p_queue_id !~ '^[^:]+:[0-9a-f-]{36}$' then
    raise exception 'bad_queue_id';
  end if;

  kind_prefix := split_part(p_queue_id, ':', 1);
  ref_id := split_part(p_queue_id, ':', 2)::uuid;

  if kind_prefix = 'boarding' then
    if act not in ('confirmed', 'missed', 'candidate_confirmed', 'candidate_missed') then
      raise exception 'bad_action';
    end if;
    if act in ('candidate_confirmed', 'confirmed') then act := 'confirmed'; else act := 'missed'; end if;
    perform public.admin_answer_boarding_for_candidate(ref_id, act, p_note);
    return;
  end if;

  if kind_prefix = 'boarding_agency' then
    if act not in ('confirmed', 'missed', 'agency_confirmed', 'agency_missed') then
      raise exception 'bad_action';
    end if;
    if act in ('agency_confirmed', 'confirmed') then act := 'confirmed'; else act := 'missed'; end if;
    perform public.agency_answer_boarding(ref_id, act);
    insert into public.admin_intervention_log (admin_id, candidate_id, kind, action, note, ctx)
    values (
      auth.uid(), ref_id, 'boarding_agency_silent', act,
      nullif(trim(p_note), ''),
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('answer', act)
    );
    return;
  end if;

  if kind_prefix in ('work_start', 'transit_stalled') then
    log_kind := case kind_prefix when 'transit_stalled' then 'transit_stalled' else 'work_start_pending' end;
    if act = 'confirm_hire' then
      perform public.agency_confirm_hire(ref_id);
      insert into public.admin_intervention_log (admin_id, candidate_id, kind, action, note, ctx)
      values (auth.uid(), ref_id, log_kind, act, nullif(trim(p_note), ''), coalesce(p_payload, '{}'::jsonb));
      return;
    end if;
    if act = 'defer_start' then
      defer_date := nullif(trim(p_payload->>'deferDate'), '')::date;
      if defer_date is null then raise exception 'defer_date_required'; end if;
      perform public.agency_defer_work_start(ref_id, defer_date);
      insert into public.admin_intervention_log (admin_id, candidate_id, kind, action, note, ctx)
      values (
        auth.uid(), ref_id, log_kind, act, nullif(trim(p_note), ''),
        coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('deferDate', defer_date)
      );
      return;
    end if;
    raise exception 'bad_action';
  end if;

  if kind_prefix = 'employment' then
    if act not in ('continue', 'completed', 'early_exit', 'restore') then
      raise exception 'bad_action';
    end if;
    perform public.admin_resolve_employment(ref_id, act, p_note);
    insert into public.admin_intervention_log (admin_id, candidate_id, episode_id, kind, action, note, ctx)
    select
      auth.uid(), e.candidate_id, e.id,
      case e.outcome
        when 'disputed' then 'employment_disputed'
        when 'completion_pending' then 'employment_term'
        else 'employment_exit'
      end,
      act, nullif(trim(p_note), ''), coalesce(p_payload, '{}'::jsonb)
    from public.employment_episodes e
    where e.id = ref_id;
    return;
  end if;

  raise exception 'unknown_kind';
end;
$$;

revoke all on function public.admin_intervention_act(text, text, text, jsonb) from public;
grant execute on function public.admin_intervention_act(text, text, text, jsonb) to authenticated;

create or replace function public.admin_list_intervention_log(p_limit int default 50)
returns setof public.admin_intervention_log
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from public.admin_intervention_log l
  where public.is_admin()
  order by l.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

revoke all on function public.admin_list_intervention_log(int) from public;
grant execute on function public.admin_list_intervention_log(int) to authenticated;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  n_interventions int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select count(*)::int into n_interventions from public.admin_list_interventions();

  return jsonb_build_object(
    'agencies', (select count(*)::int from public.user_roles where role = 'agency'),
    'candidates', (
      select count(*)::int from public.profiles p
      where not exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.user_id and ur.role in ('agency', 'admin')
      )
    ),
    'admins', (select count(*)::int from public.user_roles where role = 'admin'),
    'hotels', 0,
    'interventions', n_interventions
  );
end;
$$;

notify pgrst, 'reload schema';
