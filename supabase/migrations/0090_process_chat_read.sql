-- 0090_process_chat_read.sql
-- Süreç sohbeti: karşı taraf mesajı gördü mü.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.process_chat_messages
  add column if not exists read_at timestamptz;

create index if not exists process_chat_messages_unread_idx
  on public.process_chat_messages (chat_id)
  where read_at is null;

grant select, insert, update on public.process_chat_messages to service_role;

notify pgrst, 'reload schema';
