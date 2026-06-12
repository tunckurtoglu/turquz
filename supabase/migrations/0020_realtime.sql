-- 0020_realtime.sql
-- Belge/sözleşme/uçuş/durum değişikliklerinin karşı tarafa ANLIK yansıması için realtime aç.
-- (Aday belge gönderince acente ekranı otomatik güncellensin; tersi de geçerli.)
-- RLS yine geçerli: herkes yalnızca yetkili olduğu satırların olaylarını alır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

do $$
declare
  t text;
begin
  foreach t in array array['user_documents','contracts','flights','candidate_status'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
