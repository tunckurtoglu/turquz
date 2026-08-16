-- 0073_employment_episodes.sql
-- İstihdam dönemi (episode): aktif / erken ayrılış pending / itiraz / tamamlandı / erken çıkış.
-- Sessizlik = kabul (7 gün). Sertifika = completed. Havuz = open episode yokken.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- ---------------------------------------------------------------------------
-- Tablo
-- ---------------------------------------------------------------------------
create table if not exists public.employment_episodes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users (id) on delete cascade,
  agency_id uuid not null references auth.users (id) on delete cascade,
  employer_id uuid references public.agency_employers (id) on delete set null,
  employer_title text,
  position text, -- iş pozisyonu (PG reserved değil CREATE TABLE'da; RETURNS TABLE'da job_position kullanılır)
  hired_at timestamptz not null default now(),
  planned_end_at timestamptz,
  ended_at timestamptz,
  outcome text not null default 'active'
    check (outcome in ('active', 'early_exit_pending', 'disputed', 'completed', 'early_exit')),
  end_requested_by uuid references auth.users (id) on delete set null,
  end_requested_at timestamptz,
  end_request_role text
    check (end_request_role is null or end_request_role in ('candidate', 'agency', 'employer', 'system', 'admin')),
  end_reason text,
  contest_by uuid references auth.users (id) on delete set null,
  contest_at timestamptz,
  contest_note text,
  silence_deadline_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  resolve_note text,
  contract_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employment_episodes_one_open_idx
  on public.employment_episodes (candidate_id)
  where outcome in ('active', 'early_exit_pending', 'disputed');

create index if not exists employment_episodes_agency_idx
  on public.employment_episodes (agency_id, outcome, ended_at desc nulls last);

create index if not exists employment_episodes_candidate_idx
  on public.employment_episodes (candidate_id, outcome);

create index if not exists employment_episodes_silence_idx
  on public.employment_episodes (silence_deadline_at)
  where outcome = 'early_exit_pending';

create index if not exists employment_episodes_planned_end_idx
  on public.employment_episodes (planned_end_at)
  where outcome = 'active';

create index if not exists employment_episodes_disputed_idx
  on public.employment_episodes (outcome)
  where outcome = 'disputed';

alter table public.employment_episodes enable row level security;

drop policy if exists employment_episodes_select on public.employment_episodes;
create policy employment_episodes_select
  on public.employment_episodes for select to authenticated
  using (
    public.is_admin()
    or candidate_id = auth.uid()
    or agency_id = auth.uid()
    or (outcome = 'completed') -- kamu iş geçmişi (otel ünvanı)
  );

-- Yazma yalnızca RPC (security definer)
revoke insert, update, delete on public.employment_episodes from authenticated, anon;

-- Sertifika bayrağı (havuz filtresi)
alter table public.profiles
  add column if not exists turquz_certified boolean not null default false;

create index if not exists profiles_turquz_certified_idx
  on public.profiles (turquz_certified)
  where turquz_certified = true;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function public._refresh_turquz_certified(p_candidate uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles p
  set turquz_certified = exists (
    select 1 from public.employment_episodes e
    where e.candidate_id = p_candidate and e.outcome = 'completed'
  )
  where p.user_id = p_candidate;
$$;

create or replace function public._contract_snapshot(p_candidate uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
      'title', c.title,
      'address', c.address,
      'phone', c.phone,
      'email', c.email,
      'position', c.position,
      'salary', c.salary,
      'consulate', c.consulate,
      'issue_date', c.issue_date,
      'created_by', c.created_by,
      'payment_status', c.payment_status
    ) from public.contracts c where c.user_id = p_candidate),
    '{}'::jsonb
  );
$$;

create or replace function public._employment_notify(
  p_user uuid,
  p_type text,
  p_ref uuid,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, ref_user, payload)
  values (p_user, p_type, p_ref, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- Havuzu temizle + log kapat (pending DEĞİL; kesin sonuç)
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
    return; -- idempotent
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

  -- Canlı sözleşme/belge temizliği (geçmiş episode.snapshot'ta)
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

-- ---------------------------------------------------------------------------
-- Backfill: mevcut hired + employment_log
-- ---------------------------------------------------------------------------
insert into public.employment_episodes (
  candidate_id, agency_id, employer_title, position,
  hired_at, planned_end_at, ended_at, outcome, contract_snapshot
)
select
  cs.user_id,
  cs.accepted_by::uuid,
  c.title,
  c.position,
  coalesce(cs.hired_at, cs.accepted_at, now()),
  cs.work_end_at,
  null,
  'active',
  case when c.user_id is not null then public._contract_snapshot(cs.user_id) else '{}'::jsonb end
from public.candidate_status cs
left join public.contracts c on c.user_id = cs.user_id
where cs.status = 'hired'
  and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and not exists (
    select 1 from public.employment_episodes e
    where e.candidate_id = cs.user_id
      and e.outcome in ('active', 'early_exit_pending', 'disputed')
  );

-- Eski log (ended) → early_exit (sertifikasız geçmiş; kesin completed bilmiyoruz)
insert into public.employment_episodes (
  candidate_id, agency_id, hired_at, ended_at, outcome
)
select el.candidate_id, el.agency_id, el.hired_at, el.ended_at, 'early_exit'
from public.agency_employment_log el
where el.ended_at is not null
  and not exists (
    select 1 from public.employment_episodes e
    where e.agency_id = el.agency_id
      and e.candidate_id = el.candidate_id
      and e.outcome in ('completed', 'early_exit')
  );

-- ---------------------------------------------------------------------------
-- İşe alınca episode aç
-- ---------------------------------------------------------------------------
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wend timestamptz;
  ag text;
  snap jsonb;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    begin
      select (to_date(issue_date, 'DD/MM/YYYY') + interval '1 year')::timestamptz
        into wend from public.contracts where user_id = new.user_id;
    exception when others then wend := null; end;

    snap := public._contract_snapshot(new.user_id);

    update public.candidate_status
      set status = 'hired', hired_at = now(),
          work_end_at = coalesce(wend, now() + interval '1 year'), updated_at = now()
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
          hired_at, planned_end_at, outcome, contract_snapshot
        )
        values (
          new.user_id,
          ag::uuid,
          snap->>'title',
          snap->>'position',
          now(),
          coalesce(wend, now() + interval '1 year'),
          'active',
          snap
        );
      end if;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Erken bitiş talebi (aday veya acente)
-- ---------------------------------------------------------------------------
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
    and outcome in ('active', 'early_exit_pending', 'disputed')
  order by created_at desc
  limit 1
  for update;

  if not found then
    -- hired ama episode yoksa (eski veri) oluştur
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

  if ep.outcome = 'disputed' then
    raise exception 'disputed';
  end if;
  if ep.outcome = 'early_exit_pending' then
    return ep.id; -- zaten açık
  end if;

  -- Yetki: aday kendisi veya acente/admin
  if uid = ep.candidate_id then
    role_txt := 'candidate';
  elsif uid = ep.agency_id or public.is_admin() then
    if not public.is_staff() and not public.is_admin() then
      raise exception 'forbidden';
    end if;
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
    other,
    'employment_end_requested',
    uid,
    jsonb_build_object(
      'episodeId', ep.id,
      'role', role_txt,
      'employerTitle', ep.employer_title,
      'silenceDeadlineAt', (now() + interval '7 days')
    )
  );
  -- Başlatana da bilgi
  perform public._employment_notify(
    uid,
    'employment_end_requested_ack',
    other,
    jsonb_build_object('episodeId', ep.id, 'role', role_txt, 'silenceDeadlineAt', (now() + interval '7 days'))
  );

  return ep.id;
end;
$$;

revoke all on function public.request_employment_end(uuid, text) from public;
grant execute on function public.request_employment_end(uuid, text) to authenticated;

-- Geriye uyumluluk: eski isim → pending başlat (wipe yok)
create or replace function public.agency_end_employment(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform public.request_employment_end(p_candidate, null);
end $$;

revoke all on function public.agency_end_employment(uuid) from public;
grant execute on function public.agency_end_employment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Undo (pending iken)
-- ---------------------------------------------------------------------------
create or replace function public.undo_employment_end(p_episode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
  other uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'early_exit_pending' then raise exception 'not_pending'; end if;
  if uid <> ep.end_requested_by and uid <> ep.candidate_id and uid <> ep.agency_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.employment_episodes
  set outcome = 'active',
      end_requested_by = null,
      end_requested_at = null,
      end_request_role = null,
      end_reason = null,
      silence_deadline_at = null,
      updated_at = now()
  where id = p_episode;

  other := case when uid = ep.candidate_id then ep.agency_id else ep.candidate_id end;
  perform public._employment_notify(
    other,
    'employment_end_undone',
    uid,
    jsonb_build_object('episodeId', p_episode, 'employerTitle', ep.employer_title)
  );
end;
$$;

revoke all on function public.undo_employment_end(uuid) from public;
grant execute on function public.undo_employment_end(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- İtiraz → admin
-- ---------------------------------------------------------------------------
create or replace function public.contest_employment_end(p_episode uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'early_exit_pending' then raise exception 'not_pending'; end if;

  -- İtiraz: talebi başlatmayan taraf (veya admin)
  if uid = ep.end_requested_by and not public.is_admin() then
    raise exception 'cannot_contest_own';
  end if;
  if uid <> ep.candidate_id and uid <> ep.agency_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.employment_episodes
  set outcome = 'disputed',
      contest_by = uid,
      contest_at = now(),
      contest_note = nullif(trim(coalesce(p_note, '')), ''),
      silence_deadline_at = null,
      updated_at = now()
  where id = p_episode;

  perform public._employment_notify(
    ep.candidate_id,
    'employment_disputed',
    uid,
    jsonb_build_object('episodeId', p_episode)
  );
  perform public._employment_notify(
    ep.agency_id,
    'employment_disputed',
    uid,
    jsonb_build_object('episodeId', p_episode)
  );
end;
$$;

revoke all on function public.contest_employment_end(uuid, text) from public;
grant execute on function public.contest_employment_end(uuid, text) to authenticated;

-- Admin karar
create or replace function public.admin_resolve_employment(
  p_episode uuid,
  p_decision text, -- 'early_exit' | 'continue'
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'disputed' and ep.outcome <> 'early_exit_pending' then
    raise exception 'bad_state';
  end if;

  if p_decision = 'continue' then
    update public.employment_episodes
    set outcome = 'active',
        end_requested_by = null,
        end_requested_at = null,
        end_request_role = null,
        end_reason = null,
        contest_by = null,
        contest_at = null,
        contest_note = null,
        silence_deadline_at = null,
        resolved_by = uid,
        resolved_at = now(),
        resolve_note = nullif(trim(coalesce(p_note, '')), ''),
        updated_at = now()
    where id = p_episode;
    perform public._employment_notify(ep.candidate_id, 'employment_continued', uid, jsonb_build_object('episodeId', p_episode, 'note', p_note));
    perform public._employment_notify(ep.agency_id, 'employment_continued', uid, jsonb_build_object('episodeId', p_episode, 'note', p_note));
  elsif p_decision = 'early_exit' then
    perform public._finalize_employment_episode(p_episode, 'early_exit', uid, p_note);
  else
    raise exception 'bad_decision';
  end if;
end;
$$;

revoke all on function public.admin_resolve_employment(uuid, text, text) from public;
grant execute on function public.admin_resolve_employment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Tarama: sessizlik + süre dolumu
-- ---------------------------------------------------------------------------
create or replace function public.scan_employment_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_silence int := 0;
  n_complete int := 0;
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

  -- Pending bitmek üzere hatırlatma (son 48s, günde bir)
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

  return jsonb_build_object('silence', n_silence, 'completed', n_complete);
end;
$$;

revoke all on function public.scan_employment_lifecycle() from public;
grant execute on function public.scan_employment_lifecycle() to authenticated;

-- ---------------------------------------------------------------------------
-- Aday reaktive: hired ise erken ayrılış; değilse eski wipe
-- ---------------------------------------------------------------------------
create or replace function public.reactivate_candidate() returns void
  language plpgsql security definer set search_path = public as $$
declare
  st text;
begin
  select status into st from public.candidate_status where user_id = auth.uid();
  if st = 'hired' then
    perform public.request_employment_end(auth.uid(), 'candidate_reactivate');
    return;
  end if;

  update public.agency_employment_log
    set ended_at = coalesce(ended_at, now()), updated_at = now()
    where candidate_id = auth.uid() and ended_at is null;

  delete from public.contracts      where user_id = auth.uid();
  delete from public.flights        where user_id = auth.uid();
  delete from public.interviews     where user_id = auth.uid();
  delete from public.user_documents where user_id = auth.uid();
  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, hired_at = null, work_end_at = null, updated_at = now()
    where user_id = auth.uid();
end $$;

revoke all on function public.reactivate_candidate() from public;
grant execute on function public.reactivate_candidate() to authenticated;

-- ---------------------------------------------------------------------------
-- Açık episode oku
-- ---------------------------------------------------------------------------
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
    and e.outcome in ('active', 'early_exit_pending', 'disputed')
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_employment_episode() from public;
grant execute on function public.get_my_employment_episode() to authenticated;

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
    and e.outcome in ('active', 'early_exit_pending', 'disputed')
    and (public.is_staff() or public.is_admin() or e.agency_id = auth.uid() or e.candidate_id = auth.uid())
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.get_candidate_employment_episode(uuid) from public;
grant execute on function public.get_candidate_employment_episode(uuid) to authenticated;

-- Eski personel (acente)
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
  data jsonb
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
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data
  from public.employment_episodes e
  join public.profiles p on p.user_id = e.candidate_id
  where e.agency_id = coalesce(p_agency, auth.uid())
    and (e.agency_id = auth.uid() or public.is_admin())
    and e.outcome in ('completed', 'early_exit')
  order by e.ended_at desc nulls last;
$$;

revoke all on function public.list_former_staff(uuid) from public;
grant execute on function public.list_former_staff(uuid) to authenticated;

-- Adayın tamamladığı iş geçmişi (kamu)
create or replace function public.list_candidate_work_history(p_candidate uuid)
returns table (
  episode_id uuid,
  employer_title text,
  job_position text,
  hired_at timestamptz,
  ended_at timestamptz,
  outcome text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.employer_title, e.position, e.hired_at, e.ended_at, e.outcome
  from public.employment_episodes e
  where e.candidate_id = p_candidate
    and (
      e.outcome = 'completed'
      or e.candidate_id = auth.uid()
      or e.agency_id = auth.uid()
      or public.is_admin()
    )
  order by coalesce(e.ended_at, e.hired_at) desc;
$$;

revoke all on function public.list_candidate_work_history(uuid) from public;
grant execute on function public.list_candidate_work_history(uuid) to authenticated;

-- Admin: itiraz kuyruğu
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
    and e.outcome = 'disputed'
  order by e.contest_at desc nulls last;
$$;

revoke all on function public.admin_list_employment_disputes() from public;
grant execute on function public.admin_list_employment_disputes() to authenticated;

-- Puan hakkı: episode üzerinden de
create or replace function public.agency_can_rate_candidate(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    and p_candidate is not null
    and (
      exists (
        select 1 from public.candidate_status cs
        where cs.user_id = p_candidate
          and cs.status = 'hired'
          and cs.accepted_by = auth.uid()::text
      )
      or exists (
        select 1 from public.agency_employment_log el
        where el.agency_id = auth.uid()
          and el.candidate_id = p_candidate
      )
      or exists (
        select 1 from public.employment_episodes e
        where e.agency_id = auth.uid()
          and e.candidate_id = p_candidate
      )
    );
$$;

-- candidate_pool: turquz_certified ekle
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
    and coalesce(cs.status, '') <> 'hired'
    and (p.pool_passive_until is null or p.pool_passive_until <= now());
grant select on public.candidate_pool to authenticated;

drop view if exists public.candidate_hired;
create view public.candidate_hired with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    p.turquz_certified,
    cs.work_end_at, cs.accepted_by
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

notify pgrst, 'reload schema';
