-- 0115_agency_favorites_one_per_candidate.sql
-- Her aday bir acente için yalnızca bir favori işletme/departman slotunda tutulur.
-- 0109 ile işletme + departman bazlı favori yapısına geçildiği için,
-- önce aynı adayın eski mükerrer slotlarını en son eklenen kaydı koruyarak temizle.

with ranked as (
  select
    ctid,
    row_number() over (
      partition by agency_id, candidate_id
      order by created_at desc, employer_id, department
    ) as rn
  from public.agency_favorites
)
delete from public.agency_favorites f
where f.ctid in (
  select ctid
  from ranked
  where rn > 1
);

create unique index if not exists agency_favorites_agency_candidate_uidx
  on public.agency_favorites (agency_id, candidate_id);

notify pgrst, 'reload schema';