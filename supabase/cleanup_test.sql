-- cleanup_test.sql  —  TEST VERİSİ TEMİZLİĞİ
-- DİKKAT: Veriyi kalıcı siler. Sadece test aşamasında çalıştır.
-- Supabase > SQL Editor > yapıştır > Run.

-- ======================================================================
-- TAM SIFIRLAMA (teklif + sözleşme + belge geçmişi). Hepsini bir kerede çalıştır.
-- CV'ler (profiles) KORUNUR; sadece pasaport no + doğum yeri (akışta girilenler) temizlenir.
-- ======================================================================
delete from public.contracts;
delete from public.candidate_status;
delete from public.user_documents;
update public.profiles set data = data - 'passportNo' - 'birthPlace';

-- Sonuç: teklif/sözleşme/belge geçmişi sıfır. Acente sözleşme formu BOŞ gelir.
-- Sözleşmede adayın adı/uyruğu/doğum tarihi/baba-ana adı YİNE görünür -> bu CV verisidir, çöp değil.

-- NOT: Storage'daki yüklenmiş DOSYALAR SQL ile silinemez (Supabase engeller).
--   user_documents kayıtları silindiği için uygulama onları zaten GÖSTERMEZ (yetim dosya, zararsız).
--   Dosyaları da silmek istersen: Supabase Dashboard > Storage > 'documents' > klasörleri seç > Delete.

-- ======================================================================
-- (İSTEĞE BAĞLI) Tek bir adayı tamamen yok et — CV dâhil (aday no'daki rakam = reg_no):
-- delete from public.profiles where reg_no = 3;     -- ardından contracts/status/docs zaten cascade/temiz olur

-- (İSTEĞE BAĞLI) Tek adayın sadece teklif/sözleşmesini sıfırla:
-- delete from public.contracts      where user_id = (select user_id from public.profiles where reg_no = 3);
-- delete from public.candidate_status where user_id = (select user_id from public.profiles where reg_no = 3);
-- delete from public.user_documents  where user_id = (select user_id from public.profiles where reg_no = 3);
