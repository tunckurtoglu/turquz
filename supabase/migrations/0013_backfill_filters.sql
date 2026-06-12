-- 0013_backfill_filters.sql
-- Filtre sütunlarını (gender/nationality/birth_year/positions/languages/skills) TÜM adaylarda
-- data (jsonb) içinden yeniden doldurur. Filtre boş dönüyorsa bunu çalıştır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

update public.profiles set
  gender      = data->>'gender',
  nationality = data->>'nationality',
  birth_year  = nullif(data->>'birthYear', '')::int,
  positions   = array(select jsonb_array_elements_text(coalesce(data->'positions', '[]'::jsonb))),
  skills      = array(select jsonb_array_elements_text(coalesce(data->'skills', '[]'::jsonb))),
  languages   = array(select x->>'name' from jsonb_array_elements(coalesce(data->'languages', '[]'::jsonb)) as x);

notify pgrst, 'reload schema';

-- Kontrol: dolu mu?
select reg_no, nationality, gender, birth_year, positions, languages, skills
from public.profiles order by reg_no;
