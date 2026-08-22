-- 0098: İşletme (otel) başına imza/kaşe.
-- Çalıştırma: 0097'den sonra SQL Editor > Run.

alter table public.agency_employers
  add column if not exists stamp_image text,
  add column if not exists stamp_signer_name text,
  add column if not exists stamp_signer_title text;

alter table public.contracts
  add column if not exists employer_id uuid references public.agency_employers (id) on delete set null;

create index if not exists contracts_employer_idx on public.contracts (employer_id);

notify pgrst, 'reload schema';
