-- 0112_admin_candidate_dossier.sql
-- Admin aday dosyası: acente + otel yerleşimi + uçuş/tarihler + sezon geçmişi.
-- Supabase SQL Editor'da çalıştır.

-- ---------------------------------------------------------------------------
-- Liste: aramada otel / acente de görünsün
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_candidates();

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
  agency_email         text,
  agency_company       text,
  agency_contact       text,
  employer_title       text,
  employer_name        text,
  work_start_at        date,
  planned_end_on       date,
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
    au.email::text,
    ap.company_name,
    nullif(trim(both from concat_ws(' ', ap.contact_first_name, ap.contact_last_name)), ''),
    coalesce(nullif(ep.employer_title, ''), nullif(ae.title, ''), nullif(ae.name, '')),
    ae.name,
    coalesce(cs.work_start_at, ep.work_start_at),
    coalesce(cs.planned_end_on, (ep.planned_end_at::date)),
    p.source_lang,
    p.updated_at,
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.candidate_status cs on cs.user_id = p.user_id
  left join auth.users au
    on cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and au.id = cs.accepted_by::uuid
  left join public.agency_profiles ap on ap.user_id = au.id
  left join lateral (
    select e.*
    from public.employment_episodes e
    where e.candidate_id = p.user_id
    order by
      case when e.outcome in ('active', 'early_exit_pending', 'disputed') then 0 else 1 end,
      e.created_at desc
    limit 1
  ) ep on true
  left join public.agency_employers ae on ae.id = ep.employer_id
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.user_id and ur.role in ('agency', 'admin')
  )
  order by p.updated_at desc nulls last, u.created_at desc;
end;
$$;

grant execute on function public.admin_list_candidates() to authenticated;

-- ---------------------------------------------------------------------------
-- Detay: tam dosya
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
  left join auth.users au
    on cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and au.id = cs.accepted_by::uuid
  left join public.agency_profiles ap on ap.user_id = au.id
  where p.user_id = p_user;

  return result;
end;
$$;

grant execute on function public.admin_get_candidate(uuid) to authenticated;

notify pgrst, 'reload schema';
