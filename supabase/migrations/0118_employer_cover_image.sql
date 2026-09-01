-- 0118_employer_cover_image.sql
-- İşletme kapak görseli (Otellerim listesi / detay hero).

alter table public.agency_employers
  add column if not exists cover_image_path text,
  add column if not exists cover_image_mime text;

notify pgrst, 'reload schema';
