-- 0083_agency_reg_no.sql
-- Acente No: agency_profiles.reg_no (1,2,3,...) → gösterim "AG0001".
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create sequence if not exists public.agency_reg_seq;

alter table public.agency_profiles
  add column if not exists reg_no int;

-- Mevcut acentelere created_at sırasına göre numara ver.
with ordered as (
  select user_id, row_number() over (order by created_at nulls last, user_id) as rn
  from public.agency_profiles
  where reg_no is null
)
update public.agency_profiles p
set reg_no = o.rn
from ordered o
where p.user_id = o.user_id;

select setval(
  'public.agency_reg_seq',
  coalesce((select max(reg_no) from public.agency_profiles), 0)
);

alter table public.agency_profiles
  alter column reg_no set default nextval('public.agency_reg_seq');

create unique index if not exists agency_profiles_reg_no_idx
  on public.agency_profiles (reg_no);

notify pgrst, 'reload schema';
