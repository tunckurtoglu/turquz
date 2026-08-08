-- 0036_transcript_speaker.sql
-- Transkriptte konuşan kişiyi NET adlandır. Eskiden `candidate_user_id` aslında "konuşan kişi"yi
-- tutuyordu (acente konuşunca acentenin id'si). Paylaşımlı oda birden çok adayı barındırdığı için
-- doğru ad `speaker_user_id`. Geriye dönük uyumluluk: `candidate_user_id` aynı değerle yazılmaya
-- devam eder; okuma zaten ODA bazlı RPC (session_transcript) ile yapıldığından bir şey kırılmaz.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.interview_transcripts
  add column if not exists speaker_user_id uuid references auth.users (id) on delete cascade;

-- Geçmiş satırlar için doldur (eski kayıtlarda speaker = candidate_user_id idi).
update public.interview_transcripts
  set speaker_user_id = candidate_user_id
  where speaker_user_id is null;

create index if not exists transcripts_speaker_idx
  on public.interview_transcripts (speaker_user_id, created_at);

notify pgrst, 'reload schema';
