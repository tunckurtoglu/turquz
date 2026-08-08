-- 0061_ratings_test_open.sql
-- GEÇİCİ DENEME: acente tüm adaylara puan verebilir.
-- Test bitince 0062 (veya eski 0059 fonksiyonunu) geri koy.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create or replace function public.agency_can_rate_candidate(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff() and p_candidate is not null;
$$;

notify pgrst, 'reload schema';
