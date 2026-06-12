-- 0004_add_diploma_kind.sql
-- user_documents.kind'e 'diploma' (Diploma / Öğrenci Belgesi) türünü ekle.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in ('passport', 'diploma', 'criminal'));
