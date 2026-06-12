-- 0014_staff_documents.sql
-- Faz 3: Acente/admin, adayların belgelerini görebilsin/indirebilsin ve acenta belgesi
-- (imzasız sözleşme, uçak bileti) yükleyebilsin.
-- NOT: Tek acenta varsayımıyla "staff hepsine erişir". Çok acentalı olunca accepted_by'a
-- göre kapsamlandırılmalı (ileride).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- user_documents: staff okuma + yazma (acenta belgesi için)
drop policy if exists user_documents_select_staff on public.user_documents;
create policy user_documents_select_staff on public.user_documents
  for select using (public.is_staff());

drop policy if exists user_documents_insert_staff on public.user_documents;
create policy user_documents_insert_staff on public.user_documents
  for insert with check (public.is_staff());

drop policy if exists user_documents_update_staff on public.user_documents;
create policy user_documents_update_staff on public.user_documents
  for update using (public.is_staff()) with check (public.is_staff());

-- storage.objects (documents bucket): staff okuma + yükleme + güncelleme
drop policy if exists documents_read_staff on storage.objects;
create policy documents_read_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());

drop policy if exists documents_insert_staff on storage.objects;
create policy documents_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_staff());

drop policy if exists documents_update_staff on storage.objects;
create policy documents_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_staff());

notify pgrst, 'reload schema';
