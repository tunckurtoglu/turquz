-- 0018_document_submit.sql
-- Belge "gönder" akışı: yüklenen belge önce TASLAK'tır (submitted_at NULL), karşı taraf görmez.
-- Kullanıcı adımın tüm belgelerini yükleyip "Belgeleri Gönder" deyince submitted_at dolar
-- ve adım karşı tarafa geçer. Uygulama, gönderilmemiş (taslak) belgeyi karşı tarafa göstermez.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.user_documents add column if not exists submitted_at timestamptz;

-- Geriye dönük: bu sürümden önce yüklenmiş belgeler "gönderilmiş" sayılsın (eski davranış korunsun).
update public.user_documents set submitted_at = coalesce(submitted_at, updated_at) where submitted_at is null;

notify pgrst, 'reload schema';
