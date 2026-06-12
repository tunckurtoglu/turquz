-- 0015_staff_delete_documents.sql
-- Teklifi geri çekince acente, adayın belgelerini silebilsin (sıfırlama + KVKK).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- user_documents: staff silme
drop policy if exists user_documents_delete_staff on public.user_documents;
create policy user_documents_delete_staff on public.user_documents
  for delete using (public.is_staff());

-- storage.objects (documents bucket): staff silme
drop policy if exists documents_delete_staff on storage.objects;
create policy documents_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_staff());

notify pgrst, 'reload schema';
