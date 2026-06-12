-- 0002_documents_storage.sql
-- Hassas belgeler (pasaport, adli sicil): private Storage bucket + her kullanıcı yalnızca
-- KENDİ klasörüne erişir. Ayrıca belge üst-verisi (durum, son kullanma, doğrulama) için tablo.
--
-- Dosya yolu deseni:  {user_id}/{kind}.{ext}   ör. "a1b2.../passport.jpg"
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- 1) Private bucket (public = false → imzasız erişilemez)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 2) storage.objects RLS: yol'un ilk klasörü kullanıcının id'si olmalı
drop policy if exists documents_read_own on storage.objects;
create policy documents_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_insert_own on storage.objects;
create policy documents_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_update_own on storage.objects;
create policy documents_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documents_delete_own on storage.objects;
create policy documents_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Belge üst-verisi (dosyanın kendisi bucket'ta; burada durum/son kullanma tutulur)
create table if not exists public.user_documents (
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('passport', 'criminal')),
  storage_path text not null,
  mime_type    text,
  status       text not null default 'uploaded'
                 check (status in ('uploaded', 'valid', 'invalid', 'unreadable', 'review')),
  expiry_date  date,            -- pasaport son kullanma (Adım 4'te doğrulama doldurur)
  note         text,            -- ret/uyarı nedeni
  updated_at   timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.user_documents enable row level security;

drop policy if exists user_documents_select_own on public.user_documents;
create policy user_documents_select_own on public.user_documents
  for select using (auth.uid() = user_id);

drop policy if exists user_documents_insert_own on public.user_documents;
create policy user_documents_insert_own on public.user_documents
  for insert with check (auth.uid() = user_id);

drop policy if exists user_documents_update_own on public.user_documents;
create policy user_documents_update_own on public.user_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_documents_delete_own on public.user_documents;
create policy user_documents_delete_own on public.user_documents
  for delete using (auth.uid() = user_id);
