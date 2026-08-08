-- 0032_esign.sql
-- Acente/otel "gelişmiş elektronik imza" (A planı): işveren tarafının sözleşmeyi
-- uygulama içi imza/kaşe görseli + denetim izi (kim, ne zaman, belge hash'i) ile imzalaması.
-- NOT: Aday e-imza ATMAZ; aday PDF'i elle imzalayıp tarayıp yükler (mevcut akış).
-- İleride nitelikli e-imza (NES/mobil/bulut) eklenebilecek şekilde tasarlandı.

-- 1) İşletmenin (acente/otel kullanıcısı) kayıtlı imza+kaşesi. Kullanıcı başına tek.
create table if not exists public.business_signatures (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  image_data   text not null,         -- PNG data URI ("data:image/png;base64,....")
  signer_name  text not null,         -- firma / yetkili adı (PDF'te görünür)
  signer_title text,                  -- unvan (ör. "Yetkili", "İK Müdürü")
  updated_at   timestamptz not null default now()
);

alter table public.business_signatures enable row level security;

-- Sadece sahibi kendi imzasını okur/yazar/siler.
drop policy if exists bs_select_own on public.business_signatures;
create policy bs_select_own on public.business_signatures
  for select using (auth.uid() = user_id);

drop policy if exists bs_upsert_own on public.business_signatures;
create policy bs_upsert_own on public.business_signatures
  for insert with check (auth.uid() = user_id);

drop policy if exists bs_update_own on public.business_signatures;
create policy bs_update_own on public.business_signatures
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bs_delete_own on public.business_signatures;
create policy bs_delete_own on public.business_signatures
  for delete using (auth.uid() = user_id);

-- 2) Her imzalama olayının değiştirilemez denetim kaydı (tamper-evidence).
create table if not exists public.contract_signature_log (
  id                 uuid primary key default gen_random_uuid(),
  candidate_user_id  uuid not null references auth.users(id) on delete cascade, -- sözleşmenin ait olduğu aday
  signer_user_id     uuid not null default auth.uid() references auth.users(id),  -- imzalayan işletme kullanıcısı
  signer_name        text not null,
  signer_title       text,
  doc_no             text,            -- aday kodu / belge referansı
  doc_hash           text not null,   -- imzasız sözleşme HTML'inin SHA-256'sı (16 hex)
  platform           text,            -- ios / android
  signed_at          timestamptz not null default now()
);

alter table public.contract_signature_log enable row level security;

-- İmzalayan kendi adına kayıt ekler.
drop policy if exists csl_insert_signer on public.contract_signature_log;
create policy csl_insert_signer on public.contract_signature_log
  for insert with check (auth.uid() = signer_user_id);

-- İmzalayan kendi kayıtlarını; aday kendi sözleşmesinin kaydını görebilir.
drop policy if exists csl_select on public.contract_signature_log;
create policy csl_select on public.contract_signature_log
  for select using (auth.uid() = signer_user_id or auth.uid() = candidate_user_id);

create index if not exists csl_candidate_idx on public.contract_signature_log(candidate_user_id);
create index if not exists csl_signer_idx on public.contract_signature_log(signer_user_id);
