-- 0127_certificate_awards_and_employer_archive.sql
-- Kalıcı başarı sertifikası (user_documents dışında) + işletme silme arşivi (1 yıl).

-- ---------------------------------------------------------------------------
-- Storage: certificate-awards (admin yükler, aday kendi klasörünü okur)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificate-awards', 'certificate-awards', false)
on conflict (id) do nothing;

drop policy if exists certificate_awards_read_own on storage.objects;
create policy certificate_awards_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificate-awards'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists certificate_awards_insert_admin on storage.objects;
create policy certificate_awards_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificate-awards' and public.is_admin());

drop policy if exists certificate_awards_update_admin on storage.objects;
create policy certificate_awards_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'certificate-awards' and public.is_admin())
  with check (bucket_id = 'certificate-awards' and public.is_admin());

drop policy if exists certificate_awards_delete_admin on storage.objects;
create policy certificate_awards_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'certificate-awards' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Kalıcı sertifika kaydı
-- ---------------------------------------------------------------------------
create table if not exists public.certificate_awards (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references auth.users (id) on delete cascade,
  episode_id      uuid not null references public.employment_episodes (id) on delete restrict,
  agency_id       uuid references auth.users (id) on delete set null,
  employer_id     uuid,
  snapshot        jsonb not null default '{}'::jsonb,
  storage_path    text not null,
  mime_type       text not null default 'application/pdf',
  issued_at       timestamptz not null default now(),
  issued_by       uuid not null references auth.users (id) on delete restrict,
  email_to        text,
  email_sent_at   timestamptz,
  created_at      timestamptz not null default now(),
  constraint certificate_awards_episode_unique unique (episode_id)
);

create index if not exists certificate_awards_candidate_idx
  on public.certificate_awards (candidate_id, issued_at desc);

alter table public.certificate_awards enable row level security;

drop policy if exists certificate_awards_admin_all on public.certificate_awards;
create policy certificate_awards_admin_all on public.certificate_awards
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists certificate_awards_select_own on public.certificate_awards;
create policy certificate_awards_select_own on public.certificate_awards
  for select to authenticated
  using (candidate_id = auth.uid());

revoke all on table public.certificate_awards from public;
grant select on table public.certificate_awards to authenticated;

-- ---------------------------------------------------------------------------
-- İşletme silme arşivi (1 yıl)
-- ---------------------------------------------------------------------------
create table if not exists public.employer_deletion_archives (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null,
  employer_id       uuid not null,
  employer_snapshot jsonb not null default '{}'::jsonb,
  process_snapshot  jsonb not null default '{}'::jsonb,
  deleted_by        uuid not null references auth.users (id) on delete restrict,
  deleted_at        timestamptz not null default now(),
  retention_until   timestamptz not null default (now() + interval '1 year')
);

create index if not exists employer_deletion_archives_agency_idx
  on public.employer_deletion_archives (agency_id, deleted_at desc);

alter table public.employer_deletion_archives enable row level security;

drop policy if exists employer_deletion_archives_admin on public.employer_deletion_archives;
create policy employer_deletion_archives_admin on public.employer_deletion_archives
  for select to authenticated
  using (public.is_admin());

revoke all on table public.employer_deletion_archives from public;
grant select on table public.employer_deletion_archives to authenticated;

-- ---------------------------------------------------------------------------
-- Sertifika ver (admin) — user_documents kullanılmaz
-- ---------------------------------------------------------------------------
create or replace function public.admin_issue_certificate(
  p_episode uuid,
  p_storage_path text,
  p_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ep public.employment_episodes%rowtype;
  v_award uuid;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_episode is null or p_storage_path is null or trim(p_storage_path) = '' then
    raise exception 'missing';
  end if;

  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then
    raise exception 'episode_not_found';
  end if;
  if ep.outcome <> 'completed' then
    raise exception 'episode_not_completed';
  end if;
  if exists (select 1 from public.certificate_awards where episode_id = p_episode) then
    raise exception 'certificate_already_issued';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = ep.candidate_id;

  insert into public.certificate_awards (
    candidate_id, episode_id, agency_id, employer_id,
    snapshot, storage_path, issued_by, email_to
  )
  values (
    ep.candidate_id,
    ep.id,
    ep.agency_id,
    ep.employer_id,
    coalesce(p_snapshot, '{}'::jsonb),
    trim(p_storage_path),
    auth.uid(),
    v_email
  )
  returning id into v_award;

  perform public._refresh_turquz_certified(ep.candidate_id);

  insert into public.notifications (user_id, type, ref_user, payload)
  values (
    ep.candidate_id,
    'success_certificate',
    ep.candidate_id,
    jsonb_build_object(
      'awardId', v_award,
      'episodeId', ep.id,
      'emailTo', v_email,
      'delivery', 'email'
    )
  );

  return v_award;
end;
$$;

create or replace function public.admin_mark_certificate_emailed(
  p_award uuid,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.certificate_awards
  set email_sent_at = now(),
      email_to = coalesce(nullif(trim(p_email), ''), email_to)
  where id = p_award;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke all on function public.admin_issue_certificate(uuid, text, jsonb) from public;
grant execute on function public.admin_issue_certificate(uuid, text, jsonb) to authenticated;
revoke all on function public.admin_mark_certificate_emailed(uuid, text) from public;
grant execute on function public.admin_mark_certificate_emailed(uuid, text) to authenticated;

-- Admin: verilmiş sertifikayı iptal et (nadiren)
create or replace function public.admin_revoke_certificate(p_award uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select candidate_id into v_candidate
  from public.certificate_awards
  where id = p_award;
  if not found then
    raise exception 'not_found';
  end if;
  delete from public.certificate_awards where id = p_award;
  perform public._refresh_turquz_certified(v_candidate);
end;
$$;

revoke all on function public.admin_revoke_certificate(uuid) from public;
grant execute on function public.admin_revoke_certificate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bekleyen sertifikalar (tamamlanan sezon, henüz verilmemiş)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_pending_certificates(integer);

create or replace function public.admin_list_pending_certificates(p_limit integer default 200)
returns table (
  candidate_id       uuid,
  episode_id         uuid,
  candidate_name     text,
  candidate_reg_no   integer,
  cert_status        text,
  employer_title     text,
  season_ended_at    timestamptz,
  cert_storage_path  text,
  cert_submitted_at  timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    e.candidate_id,
    e.id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(concat_ws(' ', p.data->>'firstName', p.data->>'lastName')), ''),
      'İsimsiz aday'
    ),
    p.reg_no,
    'needs_issue'::text,
    coalesce(nullif(e.employer_title, ''), nullif(e.employer_name, '')),
    e.ended_at,
    ca.storage_path,
    ca.issued_at
  from public.employment_episodes e
  join public.profiles p on p.user_id = e.candidate_id
  left join public.certificate_awards ca on ca.episode_id = e.id
  where e.outcome = 'completed'
    and ca.id is null
  order by e.ended_at desc nulls last
  limit greatest(coalesce(p_limit, 1), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_candidate: certificate_awards ekle
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_candidate(p_user uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'user_id', p.user_id,
    'email', u.email,
    'full_name', p.full_name,
    'title', p.title,
    'reg_no', p.reg_no,
    'nationality', p.nationality,
    'gender', p.gender,
    'birth_year', p.birth_year,
    'source_lang', p.source_lang,
    'data', p.data,
    'updated_at', p.updated_at,
    'created_at', u.created_at,
    'status', cs.status,
    'stage', cs.stage,
    'docs_unlocked', cs.docs_unlocked,
    'accepted_by', cs.accepted_by,
    'accepted_at', cs.accepted_at,
    'offered_at', cs.offered_at,
    'hired_at', cs.hired_at,
    'work_start_at', cs.work_start_at,
    'work_end_at', cs.work_end_at,
    'planned_end_on', cs.planned_end_on,
    'flight_depart_on', cs.flight_depart_on,
    'boarding_status', cs.boarding_status,
    'boarding_asked_at', cs.boarding_asked_at,
    'agency_id', au.id,
    'agency_email', au.email,
    'agency_company', ap.company_name,
    'agency_contact', nullif(trim(both from concat_ws(' ', ap.contact_first_name, ap.contact_last_name)), ''),
    'agency_phone', ap.phone_authorized,
    'turquz_certified', p.turquz_certified,
    'flight', (
      select jsonb_build_object(
        'from_city', f.from_city,
        'from_airport', f.from_airport,
        'to_city', f.to_city,
        'to_airport', f.to_airport,
        'depart_at', f.depart_at,
        'arrive_at', f.arrive_at,
        'flight_no', f.flight_no,
        'terminal', f.terminal,
        'airline', f.airline,
        'pickup_name', f.pickup_name,
        'pickup_phone', f.pickup_phone,
        'pickup_sent_at', f.pickup_sent_at,
        'updated_at', f.updated_at
      )
      from public.flights f
      where f.user_id = p_user
    ),
    'episode', (
      select jsonb_build_object(
        'id', e.id,
        'outcome', e.outcome,
        'position', e.position,
        'employer_id', e.employer_id,
        'employer_title', coalesce(nullif(e.employer_title, ''), nullif(ae.title, ''), ae.name),
        'employer_name', ae.name,
        'employer_address', ae.address,
        'employer_phone', ae.phone,
        'employer_email', ae.email,
        'hired_at', e.hired_at,
        'work_start_at', e.work_start_at,
        'planned_end_at', e.planned_end_at,
        'ended_at', e.ended_at,
        'end_reason', e.end_reason,
        'end_request_role', e.end_request_role,
        'silence_deadline_at', e.silence_deadline_at,
        'agency_id', e.agency_id
      )
      from public.employment_episodes e
      left join public.agency_employers ae on ae.id = e.employer_id
      where e.candidate_id = p_user
      order by
        case when e.outcome in ('active', 'early_exit_pending', 'disputed') then 0 else 1 end,
        e.created_at desc
      limit 1
    ),
    'episodes', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.sort_at desc)
      from (
        select
          e.id,
          e.outcome,
          e.position,
          e.employer_id,
          coalesce(nullif(e.employer_title, ''), nullif(ae.title, ''), ae.name) as employer_title,
          ae.name as employer_name,
          e.hired_at,
          e.work_start_at,
          e.planned_end_at,
          e.ended_at,
          e.end_reason,
          e.end_request_role,
          e.agency_id,
          agp.company_name as agency_company,
          coalesce(e.ended_at, e.hired_at, e.created_at) as sort_at
        from public.employment_episodes e
        left join public.agency_employers ae on ae.id = e.employer_id
        left join public.agency_profiles agp on agp.user_id = e.agency_id
        where e.candidate_id = p_user
      ) x
    ), '[]'::jsonb),
    'certificate_awards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ca.id,
        'episode_id', ca.episode_id,
        'storage_path', ca.storage_path,
        'issued_at', ca.issued_at,
        'email_to', ca.email_to,
        'email_sent_at', ca.email_sent_at,
        'snapshot', ca.snapshot
      ) order by ca.issued_at desc)
      from public.certificate_awards ca
      where ca.candidate_id = p_user
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', d.kind,
        'storage_path', d.storage_path,
        'mime_type', d.mime_type,
        'status', d.status,
        'expiry_date', d.expiry_date,
        'submitted_at', d.submitted_at
      ) order by d.kind)
      from public.user_documents d
      where d.user_id = p_user
        and d.kind is distinct from 'success_certificate'
    ), '[]'::jsonb)
  )
  into result
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.candidate_status cs on cs.user_id = p.user_id
  left join auth.users au
    on cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and au.id = cs.accepted_by::uuid
  left join public.agency_profiles ap on ap.user_id = au.id
  where p.user_id = p_user;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- İşletme sil: tamamlanan sezon + sertifikalar korunur; arşiv yazılır
-- ---------------------------------------------------------------------------
create or replace function public.agency_delete_employer(p_employer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid := auth.uid();
  v_count integer := 0;
  v_doc_paths text[];
  v_employer jsonb;
begin
  if v_agency is null or not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if p_employer is null then
    raise exception 'bad_request';
  end if;
  if not exists (
    select 1 from public.agency_employers
    where id = p_employer and agency_id = v_agency
  ) then
    raise exception 'not_found';
  end if;

  select to_jsonb(e.*) into v_employer
  from public.agency_employers e
  where e.id = p_employer;

  drop table if exists pg_temp.agency_employer_delete_candidates;
  create temporary table agency_employer_delete_candidates (
    user_id uuid primary key
  ) on commit drop;

  -- Yalnızca AKTİF süreçteki adaylar (tamamlanmış sezon kayıtlarına dokunma)
  insert into pg_temp.agency_employer_delete_candidates (user_id)
  select cs.user_id
  from public.candidate_status cs
  where cs.accepted_by = v_agency::text
    and cs.offer_employer_id = p_employer
    and cs.status not in ('new')
  union
  select i.user_id
  from public.interviews i
  where i.employer_id = p_employer
    and i.created_by = v_agency
  union
  select c.user_id
  from public.contracts c
  where c.employer_id = p_employer
    and c.created_by = v_agency
  union
  select e.candidate_id
  from public.employment_episodes e
  where e.agency_id = v_agency
    and e.employer_id = p_employer
    and e.outcome in ('active', 'early_exit_pending', 'disputed')
  union
  select cs.user_id
  from public.candidate_status cs
  join public.agency_favorites f
    on f.agency_id = v_agency
   and f.employer_id = p_employer
   and f.candidate_id = cs.user_id
  where cs.accepted_by = v_agency::text
    and cs.status not in ('new');

  select count(*) into v_count from pg_temp.agency_employer_delete_candidates;

  select coalesce(array_agg(ud.storage_path), array[]::text[])
    into v_doc_paths
  from public.user_documents ud
  join pg_temp.agency_employer_delete_candidates x on x.user_id = ud.user_id
  where ud.kind is distinct from 'success_certificate';

  insert into public.employer_deletion_archives (
    agency_id, employer_id, employer_snapshot, process_snapshot, deleted_by
  )
  values (
    v_agency,
    p_employer,
    coalesce(v_employer, '{}'::jsonb),
    jsonb_build_object(
      'reset_candidates', coalesce((
        select jsonb_agg(user_id) from pg_temp.agency_employer_delete_candidates
      ), '[]'::jsonb),
      'document_paths', to_jsonb(coalesce(v_doc_paths, array[]::text[])),
      'completed_episodes_preserved', coalesce((
        select jsonb_agg(jsonb_build_object(
          'candidate_id', e.candidate_id,
          'episode_id', e.id,
          'outcome', e.outcome,
          'ended_at', e.ended_at
        ))
        from public.employment_episodes e
        where e.agency_id = v_agency
          and e.employer_id = p_employer
          and e.outcome in ('completed', 'early_exit')
      ), '[]'::jsonb)
    ),
    v_agency
  );

  delete from public.process_chats pc
  using pg_temp.agency_employer_delete_candidates x
  where pc.agency_id = v_agency and pc.candidate_id = x.user_id;

  delete from public.interviews i
  using pg_temp.agency_employer_delete_candidates x
  where i.user_id = x.user_id
    and (i.created_by = v_agency or i.employer_id = p_employer);

  delete from public.contracts c
  using pg_temp.agency_employer_delete_candidates x
  where c.user_id = x.user_id
    and (c.created_by = v_agency or c.employer_id = p_employer);

  delete from public.flights f
  using pg_temp.agency_employer_delete_candidates x
  where f.user_id = x.user_id;

  delete from public.user_documents ud
  using pg_temp.agency_employer_delete_candidates x
  where ud.user_id = x.user_id
    and ud.kind is distinct from 'success_certificate';

  delete from public.agency_cv_overrides o
  using pg_temp.agency_employer_delete_candidates x
  where o.agency_id = v_agency and o.candidate_id = x.user_id;

  -- Tamamlanmış / erken çıkış sezon kayıtları ve sertifikalar kalır
  delete from public.employment_episodes e
  where e.agency_id = v_agency
    and e.employer_id = p_employer
    and e.outcome in ('active', 'early_exit_pending', 'disputed');

  update public.candidate_status cs
  set status = 'new',
      docs_unlocked = false,
      stage = 0,
      accepted_by = null,
      accepted_at = null,
      offered_at = null,
      hired_at = null,
      work_end_at = null,
      work_start_at = null,
      planned_end_on = null,
      flight_depart_on = null,
      boarding_status = null,
      work_start_asked_at = null,
      work_start_remind_count = 0,
      docs_deadline_at = null,
      docs_extra_requested_at = null,
      docs_agency_extra_at = null,
      docs_deadline_notified_at = null,
      consulate_deadline_at = null,
      consulate_agency_extra_at = null,
      consulate_deadline_notified_at = null,
      airport_check_status = null,
      airport_check_asked_at = null,
      airport_check_answered_at = null,
      airport_check_remind_count = 0,
      airport_check_last_answer = null,
      airport_check_negative_notified_at = null,
      offer_employer_id = null,
      updated_at = now()
  from pg_temp.agency_employer_delete_candidates x
  where cs.user_id = x.user_id;

  delete from public.agency_employer_notes
  where agency_id = v_agency and employer_id = p_employer;

  delete from public.agency_favorites
  where agency_id = v_agency and employer_id = p_employer;

  delete from public.notifications n
  where (n.user_id = v_agency and n.ref_user in (
           select user_id from pg_temp.agency_employer_delete_candidates
        ))
     or (n.user_id in (
           select user_id from pg_temp.agency_employer_delete_candidates
         ) and n.ref_user = v_agency);

  delete from public.agency_employers
  where id = p_employer and agency_id = v_agency;

  return jsonb_build_object(
    'employer_id', p_employer,
    'reset_candidates', v_count,
    'document_paths', to_jsonb(coalesce(v_doc_paths, array[]::text[]))
  );
end;
$$;

-- Eski publish RPC kaldır (user_documents tabanlı)
drop function if exists public.admin_publish_success_certificate(uuid);

-- Realtime: aday sertifika alınca Belgeler ekranı güncellensin
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'certificate_awards'
  ) then
    alter publication supabase_realtime add table public.certificate_awards;
  end if;
end $$;

notify pgrst, 'reload schema';
