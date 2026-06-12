-- 0010_pool_mask.sql
-- GÜVENLİK: Acente havuzuna giden veriden kimlik/iletişim/aile bilgilerini SUNUCUDA çıkar.
-- Böylece gerçek ad, e-posta, telefon, adres, pasaport no ve aile bilgisi acentenin
-- cihazına HİÇ gitmez (sadece görsel maskeleme değil).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create or replace view public.candidate_pool with (security_invoker = on) as
  select
    user_id,
    title,
    -- data'dan PII üst-anahtarlarını çıkar
    (data
      - 'firstName' - 'lastName'
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
