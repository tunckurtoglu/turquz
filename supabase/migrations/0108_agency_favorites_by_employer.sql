-- 0108_agency_favorites_by_employer.sql
-- Favoriler yeniden işletme (otel) bazlı: PK (agency_id, employer_id, candidate_id).
-- 0087 sonrası genel satırlar: tek oteli olan acentelere atanır; kalanlar silinir.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.agency_favorites drop constraint if exists agency_favorites_pkey;

alter table public.agency_favorites
  add column if not exists employer_id uuid references public.agency_employers (id) on delete cascade;

-- Acentenin tek işletmesi varsa mevcut favorileri ona bağla
with single as (
  select
    agency_id,
    (array_agg(id order by last_used_at desc nulls last, created_at desc))[1] as eid
  from public.agency_employers
  group by agency_id
  having count(*) = 1
)
update public.agency_favorites f
set employer_id = s.eid
from single s
where f.agency_id = s.agency_id
  and f.employer_id is null;

-- İşletmeye bağlanamayan eski genel satırlar (ürün: genel favori yok)
delete from public.agency_favorites where employer_id is null;

alter table public.agency_favorites
  alter column employer_id set not null;

alter table public.agency_favorites
  add constraint agency_favorites_pkey primary key (agency_id, employer_id, candidate_id);

create index if not exists agency_favorites_agency_emp_idx
  on public.agency_favorites (agency_id, employer_id);

create index if not exists agency_favorites_agency_cand_idx
  on public.agency_favorites (agency_id, candidate_id);

notify pgrst, 'reload schema';
