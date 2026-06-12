-- 0011_pool_keep_name.sql
-- Havuz görünümünde ad/soyad KORUNUR (acentenin otele vereceği resmî PDF'te isim gerekir),
-- ama iletişim/adres/pasaport/aile bilgileri yine cihaza GİTMEZ.
-- Ekranda isim "aday no" olarak maskelenir; yalnızca PDF indirince gerçek isim görünür.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Sütun seti değiştiği için 'create or replace' çalışmaz; önce düşür.
drop view if exists public.candidate_pool;

create view public.candidate_pool with (security_invoker = on) as
  select
    user_id,
    title,
    (data
      - 'email' - 'phone' - 'phoneConfirm'
      - 'location' - 'passportNo'
      - 'family'
    ) as data,
    updated_at,
    gender, nationality, birth_year, positions, languages, skills
  from public.profiles
  where not public.is_user_staff(user_id);

grant select on public.candidate_pool to authenticated;
notify pgrst, 'reload schema';
