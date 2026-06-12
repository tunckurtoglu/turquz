-- 0030_request_reupload.sql
-- 1) Acente/otel bir belgeyi BEĞENMEZSE "tekrar iste": belge silinir + adaya bildirim gider.
-- 2) Aday GÖNDERDİĞİ (submitted) belgeyi artık silemez (yalnız taslakları silebilir).
-- Çalıştırma: Supabase > SQL Editor > Run.

-- --- Aday yalnız TASLAK belgeleri silebilir (gönderilmiş olanı silemez) ---
drop policy if exists user_documents_delete_own on public.user_documents;
create policy user_documents_delete_own on public.user_documents
  for delete using (auth.uid() = user_id and submitted_at is null);

-- --- Acente: belgeyi tekrar iste (sil + bildirim). Yalnız staff çağırabilir. ---
create or replace function public.request_reupload(p_candidate uuid, p_kind text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_user_staff(auth.uid()) then return; end if;       -- yalnız acente/otel/admin
  delete from public.user_documents where user_id = p_candidate and kind = p_kind;
  insert into public.notifications(user_id, type, ref_user) values (p_candidate, 'reupload', auth.uid());
end $$;
grant execute on function public.request_reupload(uuid, text) to authenticated;

notify pgrst, 'reload schema';
