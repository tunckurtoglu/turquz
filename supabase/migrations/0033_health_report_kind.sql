-- 0033_health_report_kind.sql
-- Yeni aday belgesi: 'health_report' (hastane sağlık raporu) — ilk belge paketine eklendi.
-- user_documents.kind CHECK kısıtına bu türü de izin ver (yoksa yükleme "belge yüklenemedi" verir).
alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in (
    'passport', 'diploma', 'criminal', 'health_report',
    'contract_signed', 'consulate_ref', 'work_permit',
    'contract_unsigned', 'flight_ticket'
  ));
