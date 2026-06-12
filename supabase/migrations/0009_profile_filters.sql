-- 0009_profile_filters.sql
-- Filtreleme için profiles'a ayrı sütunlar (kayıtta doldurulur, indekslenir) + havuz görünümü.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.profiles
  add column if not exists gender      text,
  add column if not exists nationality text,
  add column if not exists birth_year  int,
  add column if not exists positions   text[],
  add column if not exists languages   text[],
  add column if not exists skills       text[];

-- Mevcut kayıtları data (jsonb) içinden doldur (tek seferlik backfill).
update public.profiles set
  gender      = data->>'gender',
  nationality = data->>'nationality',
  birth_year  = nullif(data->>'birthYear', '')::int,
  positions   = array(select jsonb_array_elements_text(coalesce(data->'positions', '[]'::jsonb))),
  skills      = array(select jsonb_array_elements_text(coalesce(data->'skills', '[]'::jsonb))),
  languages   = array(select x->>'name' from jsonb_array_elements(coalesce(data->'languages', '[]'::jsonb)) as x);

-- İndeksler
create index if not exists profiles_nationality_idx on public.profiles (nationality);
create index if not exists profiles_gender_idx on public.profiles (gender);
create index if not exists profiles_birth_year_idx on public.profiles (birth_year);
create index if not exists profiles_positions_idx on public.profiles using gin (positions);
create index if not exists profiles_languages_idx on public.profiles using gin (languages);
create index if not exists profiles_skills_idx on public.profiles using gin (skills);

-- Havuz görünümünü yeni sütunlarla yeniden oluştur (acente/admin gizli)
create or replace view public.candidate_pool with (security_invoker = on) as
  select user_id, full_name, title, data, updated_at,
         gender, nationality, birth_year, positions, languages, skills
  from public.profiles
  where not public.is_user_staff(user_id);
grant select on public.candidate_pool to authenticated;

notify pgrst, 'reload schema';
