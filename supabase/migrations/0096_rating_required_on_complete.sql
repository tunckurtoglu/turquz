-- 0096: Puanlama yalnız başarılı tamamlanan episode; zorunlu + hatırlatma.
-- Çalıştırma: 0095'ten sonra SQL Editor > Run.

-- Yalnız bu acentenin "completed" episode'u varsa puan verilebilir (aktif personel / erken ayrılış / test açık kapalı).
create or replace function public.agency_can_rate_candidate(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    and p_candidate is not null
    and exists (
      select 1 from public.employment_episodes e
      where e.agency_id = auth.uid()
        and e.candidate_id = p_candidate
        and e.outcome = 'completed'
    );
$$;

-- Finalize: completed → acenteye puan zorunluluğu bildirimi
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
      work_start_asked_at = null,
      work_start_remind_count = 0,
      planned_end_on = null,
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
    jsonb_build_object(
      'episodeId', p_episode,
      'outcome', p_outcome,
      'employerTitle', coalesce(snap->>'title', ep.employer_title),
      'candidateId', ep.candidate_id,
      'openRate', p_outcome = 'completed'
    )
  );

  if p_outcome = 'completed' then
    perform public._employment_notify(
      ep.agency_id,
      'rating_required',
      ep.candidate_id,
      jsonb_build_object(
        'episodeId', p_episode,
        'candidateId', ep.candidate_id,
        'employerTitle', coalesce(snap->>'title', ep.employer_title),
        'openRate', true
      )
    );
  end if;
end;
$$;

-- Puan bekleyen başarılı tamamlamalar: 24s aralık hatırlatma (puan verilene kadar)
create or replace function public.scan_pending_ratings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_remind int := 0;
  r record;
begin
  for r in
    select e.id, e.agency_id, e.candidate_id, e.employer_title, e.ended_at
    from public.employment_episodes e
    where e.outcome = 'completed'
      and e.ended_at is not null
      and e.ended_at > now() - interval '180 days'
      and not exists (
        select 1 from public.candidate_ratings cr
        where cr.agency_id = e.agency_id
          and cr.candidate_id = e.candidate_id
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id = e.agency_id
          and n.type in ('rating_required', 'rating_remind')
          and n.ref_user = e.candidate_id
          and n.created_at > now() - interval '24 hours'
      )
  loop
    perform public._employment_notify(
      r.agency_id,
      'rating_remind',
      r.candidate_id,
      jsonb_build_object(
        'episodeId', r.id,
        'candidateId', r.candidate_id,
        'employerTitle', r.employer_title,
        'openRate', true
      )
    );
    n_remind := n_remind + 1;
  end loop;

  return jsonb_build_object('ratingReminded', n_remind);
end;
$$;

revoke all on function public.scan_pending_ratings() from public;
grant execute on function public.scan_pending_ratings() to authenticated;

-- Eski personel listesine needs_rating (OUT tipi değişti → önce DROP)
drop function if exists public.list_former_staff(uuid);

create or replace function public.list_former_staff(p_agency uuid default null)
returns table (
  episode_id uuid,
  candidate_id uuid,
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
  order by e.ended_at desc nulls last;
$$;

revoke all on function public.list_former_staff(uuid) from public;
grant execute on function public.list_former_staff(uuid) to authenticated;

notify pgrst, 'reload schema';
