-- 0012_reg_no.sql
-- Aday No için kayıt sırası: profiles.reg_no (1,2,3,...). Ülke kodu + 4 hane -> "TR0001".
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create sequence if not exists public.profile_reg_seq;
alter table public.profiles add column if not exists reg_no int;

-- Mevcut kayıtlara updated_at sırasına göre numara ver.
with ordered as (
  select user_id, row_number() over (order by updated_at) as rn
  from public.profiles where reg_no is null
)
update public.profiles p set reg_no = o.rn from ordered o where p.user_id = o.user_id;

-- Sequence'i mevcut en büyük numaraya çek, yeni kayıtlar buradan devam etsin.
select setval('public.profile_reg_seq', coalesce((select max(reg_no) from public.profiles), 0));
alter table public.profiles alter column reg_no set default nextval('public.profile_reg_seq');
create unique index if not exists profiles_reg_no_idx on public.profiles (reg_no);

-- Havuz görünümüne reg_no ekle (sütun seti değişti -> drop+create)
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select
    user_id, title, reg_no,
    (data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    updated_at, gender, nationality, birth_year, positions, languages, skills
  from public.profiles
  where not public.is_user_staff(user_id);
grant select on public.candidate_pool to authenticated;

notify pgrst, 'reload schema';
