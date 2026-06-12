-- 0019_flights.sql
-- Uçuş bilgisi (acentenin doldurduğu alanlar). Aday user_id'ye bağlı; PDF her görüntülemede
-- bu veriden üretilir. Uçak bileti GÖRSELİ ayrıca user_documents (kind='flight_ticket')'ta.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.flights (
  user_id      uuid primary key references auth.users (id) on delete cascade, -- aday
  from_city    text,   -- nereden (şehir/ülke)
  from_airport text,   -- kalkış havalimanı
  to_city      text,   -- nereye (şehir/ülke)
  to_airport   text,   -- varış havalimanı
  depart_at    text,   -- kalkış zamanı (serbest metin: "12/06/2026 14:30")
  arrive_at    text,   -- varış zamanı
  flight_no    text,   -- uçuş no
  terminal     text,   -- terminal no
  airline      text,   -- havayolu (opsiyonel)
  created_by   uuid,   -- gönderen acente
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Tablo daha önce oluşturulduysa terminal sütununu ekle (idempotent).
alter table public.flights add column if not exists terminal text;

alter table public.flights enable row level security;

-- Aday kendi uçuş bilgisini görür.
drop policy if exists flights_select_own on public.flights;
create policy flights_select_own on public.flights
  for select using (auth.uid() = user_id);

-- Acente/admin tüm uçuşları görür + yazar.
drop policy if exists flights_all_staff on public.flights;
create policy flights_all_staff on public.flights
  for all using (public.is_staff()) with check (public.is_staff());

notify pgrst, 'reload schema';
