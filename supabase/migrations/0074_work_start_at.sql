-- 0074_work_start_at.sql
-- İşe başlama tarihi: uçuş bileti ile zorunlu. Sertifika süresi = work_start_at + 1 yıl.
-- Aktif personelde acente tarihi güncelleyebilir (uçak kaçırma / geç varış).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.candidate_status
  add column if not exists work_start_at date;

alter table public.employment_episodes
  add column if not exists work_start_at date;

-- Acente: işe başlama tarihini kaydet / güncelle (active veya henüz hired değilken)
create or replace function public.agency_set_work_start(p_candidate uuid, p_start date)
returns void
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

  -- Yetki: kabul eden acente veya admin (process/hired)
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
      work_end_at = case
        when status = 'hired' then (p_start + interval '1 year')::timestamptz
        else work_end_at
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

revoke all on function public.agency_set_work_start(uuid, date) from public;
grant execute on function public.agency_set_work_start(uuid, date) to authenticated;

-- Hire: süre work_start_at + 1 yıl (zorunlu)
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wstart date;
  wend timestamptz;
  ag text;
  snap jsonb;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    select work_start_at into wstart
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
          updated_at = now()
      where user_id = new.user_id
      returning accepted_by into ag;

    if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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
          new.user_id,
          ag::uuid,
          snap->>'title',
          snap->>'position',
          now(),
          wstart,
          wend,
          'active',
          snap
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

-- Finalize: work_start_at temizliği (0073 deploy edildiyse burası günceller)
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
