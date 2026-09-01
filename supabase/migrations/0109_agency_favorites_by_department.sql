-- 0109_agency_favorites_by_department.sql
-- Favori: işletme + departman (turizm pozisyon value). PK (agency, employer, department, candidate).
-- Eski otel-only satırlar silinir (departmansız shortlist kalmaz).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.agency_favorites drop constraint if exists agency_favorites_pkey;

alter table public.agency_favorites
  add column if not exists department text;

delete from public.agency_favorites
where department is null or btrim(department) = '';

alter table public.agency_favorites
  alter column department set not null;

alter table public.agency_favorites
  add constraint agency_favorites_pkey
  primary key (agency_id, employer_id, department, candidate_id);

create index if not exists agency_favorites_agency_emp_dept_idx
  on public.agency_favorites (agency_id, employer_id, department);

notify pgrst, 'reload schema';
