-- 0099: İşletme (otel) vergi levhası PDF + AI doldurma alanları.
-- Çalıştırma: 0098'den sonra SQL Editor > Run.

alter table public.agency_employers
  add column if not exists tax_plate_path text,
  add column if not exists tax_plate_mime text,
  add column if not exists tax_no text,
  add column if not exists tax_office text,
  add column if not exists tax_plate_parsed_at timestamptz;

-- Path: {agency_id}/employers/{employer_id}/vergi_levhasi.pdf  (mevcut agency-docs bucket)
-- RLS zaten agency_id = auth.uid() klasörünü kapsıyor.

notify pgrst, 'reload schema';
