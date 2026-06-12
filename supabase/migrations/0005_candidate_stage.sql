-- 0005_candidate_stage.sql
-- Göç hattı aşaması (stage) + yeni belge türleri.
-- stage: 0 kilitli/kabul edilmedi · 1 ilk belgeler · 2 imzalı sözleşme · 3 konsolosluk ref · 4 çalışma izni
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.candidate_status add column if not exists stage int not null default 0;

-- Daha önce kabul edilmiş adayları 1. aşamaya taşı.
update public.candidate_status set stage = 1 where docs_unlocked = true and stage = 0;

-- Yeni belge türlerine izin ver (aday + ileride acenta tarafı).
alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in (
    'passport', 'diploma', 'criminal',
    'contract_signed', 'consulate_ref', 'work_permit',
    'contract_unsigned', 'flight_ticket'
  ));

-- TEST: bir adayı kabul edip 1. aşamaya almak
--   update public.candidate_status set docs_unlocked = true, stage = 1, updated_at = now()
--   where user_id = '<aday-user-id>';
-- Sonraki aşamaları açmak için stage = 2 / 3 / 4 yap.
