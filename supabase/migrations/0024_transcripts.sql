-- 0024_transcripts.sql
-- Mülakat konuşma transkripti (kalıcı yazılı kayıt). Çevirmen ajan (service role) yazar;
-- mülakatın iki tarafı (aday + ilgili acente) okur.
-- room formatı: "iv-<candidateUserId>". Çalıştırma: Supabase > SQL Editor > Run.

create table if not exists public.interview_transcripts (
  id                 uuid primary key default gen_random_uuid(),
  candidate_user_id  uuid not null references auth.users (id) on delete cascade,
  speaker_role       text not null,                 -- 'candidate' | 'agency'
  src_lang           text,                          -- konuşulan dil (algılanan)
  text_original      text not null,                 -- konuşulanın orijinali
  translations       jsonb not null default '{}',   -- { "tr": "...", "ru": "..." }
  created_at         timestamptz not null default now()
);
create index if not exists transcripts_candidate_idx
  on public.interview_transcripts (candidate_user_id, created_at);

alter table public.interview_transcripts enable row level security;

-- Okuma: aday kendi mülakatını; acente ise kurduğu mülakatı okur.
drop policy if exists transcripts_select on public.interview_transcripts;
create policy transcripts_select on public.interview_transcripts
  for select using (
    auth.uid() = candidate_user_id
    or exists (
      select 1 from public.interviews iv
      where iv.user_id = interview_transcripts.candidate_user_id
        and iv.created_by = auth.uid()
    )
  );

-- Yazma politikası YOK bilinçli olarak: yalnızca çevirmen ajan SERVICE ROLE ile yazar (RLS bypass).

notify pgrst, 'reload schema';
