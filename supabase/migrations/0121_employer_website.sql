-- 0121_employer_website.sql
-- Otel kartlarında web sayfası bilgisi.

alter table public.agency_employers
  add column if not exists web_url text;

notify pgrst, 'reload schema';
