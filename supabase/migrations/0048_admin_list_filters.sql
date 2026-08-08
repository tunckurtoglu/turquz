-- 0048_admin_list_filters.sql
-- Filtre alanları: profiles sütunu + data jsonb (aday CV'sindeki gerçek değerler).
-- Supabase SQL Editor'da çalıştır.

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
    coalesce(
      p.birth_year,
      nullif(p.data->>'birthYear', '')::int
    ),
    -- pozisyonlar: sütun veya data.positions
    case
      when p.positions is not null and cardinality(p.positions) > 0 then p.positions
      when jsonb_typeof(p.data->'positions') = 'array' then
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(p.data->'positions') as t(x)),
          '{}'::text[]
        )
      else '{}'::text[]
    end,
    -- diller: sütun veya data.languages (string | {name})
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
    -- beceriler
    case
      when p.skills is not null and cardinality(p.skills) > 0 then p.skills
      when jsonb_typeof(p.data->'skills') = 'array' then
        coalesce(
          (select array_agg(x) from jsonb_array_elements_text(p.data->'skills') as t(x)),
          '{}'::text[]
        )
      else '{}'::text[]
    end,
    coalesce(p.employment_status, nullif(p.data->>'employmentStatus', '')),
    coalesce(
      p.work_availability,
      nullif(p.data->>'availableMonths', ''),
      nullif(p.data->>'workAvailability', '')
    ),
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

grant execute on function public.admin_list_candidates() to authenticated;
notify pgrst, 'reload schema';
