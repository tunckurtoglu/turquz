-- 0017_contracts.sql
-- İş sözleşmesi verisi (acentenin doldurduğu alanlar). Aday user_id'ye bağlı; PDF her
-- görüntülemede bu veriden + adayın CV'sinden üretilir.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.contracts (
  user_id uuid primary key references auth.users (id) on delete cascade, -- aday
  title text,            -- A) İşveren ünvanı
  address text,          -- A) İşyeri adresi
  phone text,            -- A) İşveren telefon
  email text,            -- A) İşveren e-posta
  contact_phone text,    -- B) tablodaki yazışma telefonu (acente)
  contact_email text,    -- B) tablodaki yazışma e-postası (acente)
  position text,         -- md.3 iş/görev
  salary text,           -- md.6 brüt ücret
  consulate text,        -- konsolosluk/büyükelçilik adı
  issue_date text,       -- tanzim tarihi (teklif günü, "dd/mm/yyyy")
  created_by uuid,       -- teklifi gönderen acente
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contracts enable row level security;

-- Aday kendi sözleşmesini görür.
drop policy if exists contracts_select_own on public.contracts;
create policy contracts_select_own on public.contracts
  for select using (auth.uid() = user_id);

-- Acente/admin tüm sözleşmeleri görür + yazar (oluştur/güncelle).
drop policy if exists contracts_all_staff on public.contracts;
create policy contracts_all_staff on public.contracts
  for all using (public.is_staff()) with check (public.is_staff());

notify pgrst, 'reload schema';
