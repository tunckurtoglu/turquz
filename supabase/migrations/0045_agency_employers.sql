-- 0045_agency_employers.sql
-- Acentenin kayıtlı işletme (işveren) şablonları — sözleşme formunu tek seferde doldurmak için.
-- Resmi sözleşme şablonu (buildContractHtml) DEĞİŞMEZ; yalnızca acentenin girdiği alanlar otomatik dolar.

create table if not exists public.agency_employers (
  id             uuid primary key default gen_random_uuid(),
  agency_id      uuid not null references auth.users (id) on delete cascade,
  name           text not null,           -- listede görünen kısa ad (ör. "JuJu Palace", "ABC Tekstil")
  title          text,                    -- sözleşme A) işveren ünvanı
  address        text,
  phone          text,
  email          text,
  contact_phone  text,
  contact_email  text,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists agency_employers_agency_idx on public.agency_employers (agency_id);
create index if not exists agency_employers_last_used_idx on public.agency_employers (agency_id, last_used_at desc nulls last);

alter table public.agency_employers enable row level security;

drop policy if exists agency_employers_own on public.agency_employers;
create policy agency_employers_own on public.agency_employers
  for all
  using  (agency_id = auth.uid() and public.is_staff())
  with check (agency_id = auth.uid() and public.is_staff());

notify pgrst, 'reload schema';
