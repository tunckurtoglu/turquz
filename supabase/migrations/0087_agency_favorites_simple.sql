-- 0087_agency_favorites_simple.sql
-- Favori: işletme shortlist'i değil, acentenin tek aday listesi (yıldız aç/kapa).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Aynı aday birden fazla işletmede varsa bir satır kalsın (en eski).
delete from public.agency_favorites a
where a.ctid in (
  select ctid
  from (
    select ctid,
           row_number() over (
             partition by agency_id, candidate_id
             order by created_at asc, ctid asc
           ) as rn
    from public.agency_favorites
  ) d
  where d.rn > 1
);

alter table public.agency_favorites drop constraint if exists agency_favorites_pkey;
alter table public.agency_favorites drop constraint if exists agency_favorites_employer_id_fkey;
drop index if exists agency_favorites_agency_emp_idx;
alter table public.agency_favorites drop column if exists employer_id;

alter table public.agency_favorites
  add constraint agency_favorites_pkey primary key (agency_id, candidate_id);

notify pgrst, 'reload schema';
