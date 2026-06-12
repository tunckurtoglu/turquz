-- 0006_profiles.sql
-- Aday CV/profil verisinin kalıcı saklandığı tablo. (Şimdiye kadar CV yalnızca telefondaydı.)
-- Acente paneli adayları buradan görecek; bu yüzden CV'ler veritabanında olmalı.
--
-- Bu adımda RLS yalnızca SAHİBİNE açık. Acente (agency) erişimi rol sistemiyle (sonraki
-- migration) eklenecek.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,                       -- listede hızlı gösterim için (data içinden türetilir)
  title       text,
  data        jsonb not null default '{}'::jsonb,  -- tüm CV verisi (fotoğraflar dâhil)
  source_lang text,
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
