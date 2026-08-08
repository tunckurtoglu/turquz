-- 0047_admin_panel.sql
-- Admin web paneli: tüm acente/aday listeleme + güvenli silme.
-- Yalnız is_admin() çağırabilir. auth.users silinince CASCADE çoğu satırı temizler.

create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---- Acente listesi (e-posta auth.users'tan) ----
create or replace function public.admin_list_agencies()
returns table (
  user_id              uuid,
  email                text,
  company_name         text,
  contact_first_name   text,
  contact_last_name    text,
  phone_authorized     text,
  phone_rep            text,
  tax_plate_path       text,
  completed_at         timestamptz,
  created_at           timestamptz,
  updated_at           timestamptz
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
    ur.user_id,
    u.email::text,
    ap.company_name,
    ap.contact_first_name,
    ap.contact_last_name,
    ap.phone_authorized,
    ap.phone_rep,
    ap.tax_plate_path,
    ap.completed_at,
    coalesce(ap.created_at, u.created_at) as created_at,
    coalesce(ap.updated_at, u.created_at) as updated_at
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  left join public.agency_profiles ap on ap.user_id = ur.user_id
  where ur.role = 'agency'
  order by coalesce(ap.created_at, u.created_at) desc;
end;
$$;

revoke all on function public.admin_list_agencies() from public;
grant execute on function public.admin_list_agencies() to authenticated;

-- ---- Aday listesi ----
create or replace function public.admin_list_candidates()
returns table (
  user_id              uuid,
  email                text,
  full_name            text,
  title                text,
  reg_no               int,
  nationality          text,
  gender               text,
  birth_year           int,
  positions            text[],
  languages            text[],
  skills               text[],
  employment_status    text,
  work_availability    text,
  status               text,
  stage                int,
  docs_unlocked        boolean,
  accepted_by          text,
  source_lang          text,
  updated_at           timestamptz,
  created_at           timestamptz
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
    p.user_id,
    u.email::text,
    p.full_name,
    p.title,
    p.reg_no,
    coalesce(p.nationality, nullif(p.data->>'nationality', '')),
    coalesce(p.gender, nullif(p.data->>'gender', '')),
    coalesce(p.birth_year, nullif(p.data->>'birthYear', '')::int),
    case
      when p.positions is not null and cardinality(p.positions) > 0 then p.positions
      when jsonb_typeof(p.data->'positions') = 'array' then
        coalesce((select array_agg(x) from jsonb_array_elements_text(p.data->'positions') as t(x)), '{}'::text[])
      else '{}'::text[]
    end,
    case
      when p.languages is not null and cardinality(p.languages) > 0 then p.languages
      when jsonb_typeof(p.data->'languages') = 'array' then
        coalesce(
          (
            select array_agg(distinct v)
            from (
              select case
                when jsonb_typeof(el) = 'string' then trim(both '"' from el::text)
                else nullif(el->>'name', '')
              end as v
              from jsonb_array_elements(p.data->'languages') el
            ) s
            where v is not null and v <> ''
          ),
          '{}'::text[]
        )
      else '{}'::text[]
    end,
    case
      when p.skills is not null and cardinality(p.skills) > 0 then p.skills
      when jsonb_typeof(p.data->'skills') = 'array' then
        coalesce((select array_agg(x) from jsonb_array_elements_text(p.data->'skills') as t(x)), '{}'::text[])
      else '{}'::text[]
    end,
    coalesce(p.employment_status, nullif(p.data->>'employmentStatus', '')),
    coalesce(p.work_availability, nullif(p.data->>'availableMonths', ''), nullif(p.data->>'workAvailability', '')),
    cs.status,
    cs.stage,
    coalesce(cs.docs_unlocked, false),
    cs.accepted_by,
    p.source_lang,
    p.updated_at,
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.user_id and ur.role in ('agency', 'admin')
  )
  order by p.updated_at desc nulls last, u.created_at desc;
end;
$$;

revoke all on function public.admin_list_candidates() from public;
grant execute on function public.admin_list_candidates() to authenticated;

-- ---- Tek aday detay (tam CV jsonb) ----
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
    'work_end_at', cs.work_end_at,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', d.kind,
        'storage_path', d.storage_path,
        'mime_type', d.mime_type,
        'status', d.status,
        'expiry_date', d.expiry_date,
        'submitted_at', d.submitted_at
      ) order by d.kind)
      from public.user_documents d where d.user_id = p_user
    ), '[]'::jsonb)
  )
  into result
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.candidate_status cs on cs.user_id = p.user_id
  where p.user_id = p_user;

  return result;
end;
$$;

revoke all on function public.admin_get_candidate(uuid) from public;
grant execute on function public.admin_get_candidate(uuid) to authenticated;

-- ---- Tek acente detay ----
create or replace function public.admin_get_agency(p_user uuid)
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
    'user_id', ur.user_id,
    'email', u.email,
    'role', ur.role,
    'company_name', ap.company_name,
    'contact_first_name', ap.contact_first_name,
    'contact_last_name', ap.contact_last_name,
    'phone_authorized', ap.phone_authorized,
    'phone_rep', ap.phone_rep,
    'tax_plate_path', ap.tax_plate_path,
    'tax_plate_mime', ap.tax_plate_mime,
    'completed_at', ap.completed_at,
    'created_at', coalesce(ap.created_at, u.created_at),
    'updated_at', ap.updated_at,
    'auth_created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at
  )
  into result
  from public.user_roles ur
  join auth.users u on u.id = ur.user_id
  left join public.agency_profiles ap on ap.user_id = ur.user_id
  where ur.user_id = p_user and ur.role = 'agency';

  return result;
end;
$$;

revoke all on function public.admin_get_agency(uuid) from public;
grant execute on function public.admin_get_agency(uuid) to authenticated;

-- ---- Kullanıcı sil (aday veya acente). Admin kendini / başka admini silemez. ----
create or replace function public.admin_delete_user(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_user is null then
    raise exception 'missing_user';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  select role into target_role from public.user_roles where user_id = p_user;
  if target_role = 'admin' then
    raise exception 'cannot_delete_admin';
  end if;

  -- Soft FK / CASCADE engeli temizliği
  delete from public.contract_signature_log
  where signer_user_id = p_user or candidate_user_id = p_user;

  update public.candidate_status
  set accepted_by = null
  where accepted_by = p_user::text;

  update public.interviews set created_by = null where created_by = p_user;
  update public.contracts set created_by = null where created_by = p_user;
  update public.flights set created_by = null where created_by = p_user;

  -- Auth sil → public tablolar CASCADE
  delete from auth.users where id = p_user;

  if not found then
    raise exception 'user_not_found';
  end if;

  return 'deleted';
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Özet sayaçlar
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

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
    'hotels', 0
  );
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

-- Storage: admin agency-docs silebilir
drop policy if exists agency_docs_admin_delete on storage.objects;
create policy agency_docs_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'agency-docs' and public.is_admin());

drop policy if exists agency_docs_admin_select on storage.objects;
create policy agency_docs_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'agency-docs' and public.is_admin());

notify pgrst, 'reload schema';
