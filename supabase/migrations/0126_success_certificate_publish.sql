-- 0126_success_certificate_publish.sql
-- Başarı sertifikası: yükleme taslak kalır; admin onayıyla adaya gönderilir. Acenteye bildirim gitmez.

create or replace function public.tg_documents_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid;
  step1_kinds text[] := array['passport', 'diploma', 'criminal', 'health_report'];
  step1_done int;
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    -- Başarı sertifikası yalnız admin_publish_success_certificate ile yayınlanır.
    if new.kind = 'success_certificate' then
      return new;
    end if;

    if new.kind = any(step1_kinds) then
      select count(*)::int into step1_done
        from public.user_documents
        where user_id = new.user_id and kind = any(step1_kinds) and submitted_at is not null;
      if step1_done < array_length(step1_kinds, 1) then return new; end if;
      if new.kind <> 'health_report' then return new; end if;
    end if;

    if new.kind in ('contract_unsigned', 'flight_ticket') then
      insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'document', new.user_id);
    else
      select case when accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then accepted_by::uuid else null end
        into ag from public.candidate_status where user_id = new.user_id;
      if ag is not null then
        insert into public.notifications(user_id, type, ref_user) values (ag, 'document', new.user_id);
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.admin_publish_success_certificate(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  doc public.user_documents%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_candidate is null then
    raise exception 'missing_candidate';
  end if;

  select * into doc
  from public.user_documents
  where user_id = p_candidate
    and kind = 'success_certificate'
    and storage_path is not null
  for update;

  if not found then
    raise exception 'certificate_not_uploaded';
  end if;
  if doc.submitted_at is not null then
    raise exception 'certificate_already_published';
  end if;

  update public.user_documents
  set submitted_at = now(),
      updated_at = now()
  where user_id = p_candidate
    and kind = 'success_certificate';

  insert into public.notifications (user_id, type, ref_user, payload)
  values (
    p_candidate,
    'success_certificate',
    p_candidate,
    jsonb_build_object('publishedBy', auth.uid()::text)
  );
end;
$$;

revoke all on function public.admin_publish_success_certificate(uuid) from public;
grant execute on function public.admin_publish_success_certificate(uuid) to authenticated;

create or replace function public.admin_list_pending_certificates(p_limit integer default 200)
returns table (
  candidate_id       uuid,
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
    ep.candidate_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(concat_ws(' ', p.data->>'firstName', p.data->>'lastName')), ''),
      'İsimsiz aday'
    ),
    p.reg_no,
    case
      when d.storage_path is null then 'needs_upload'
      when d.submitted_at is null then 'needs_publish'
      else 'published'
    end,
    coalesce(nullif(ep.employer_title, ''), nullif(ep.employer_name, '')),
    ep.ended_at,
    d.storage_path,
    d.submitted_at
  from (
    select distinct on (e.candidate_id)
      e.candidate_id,
      e.employer_title,
      e.employer_name,
      e.ended_at
    from public.employment_episodes e
    where e.outcome = 'completed'
    order by e.candidate_id, e.ended_at desc nulls last
  ) ep
  join public.profiles p on p.user_id = ep.candidate_id
  left join public.user_documents d
    on d.user_id = ep.candidate_id and d.kind = 'success_certificate'
  where d.storage_path is null or d.submitted_at is null
  order by ep.ended_at desc nulls last
  limit greatest(coalesce(p_limit, 1), 1);
end;
$$;

revoke all on function public.admin_list_pending_certificates(int) from public;
grant execute on function public.admin_list_pending_certificates(int) to authenticated;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  n_interventions int;
  n_airport int;
  n_certs int;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select count(*)::int into n_interventions from public.admin_list_interventions();
  select count(*)::int into n_airport from public.admin_list_airport_checks(500);
  select count(*)::int into n_certs from public.admin_list_pending_certificates(500);

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
    'interventions', n_interventions,
    'airport_checks', n_airport,
    'pending_certificates', n_certs
  );
end;
$$;

notify pgrst, 'reload schema';
