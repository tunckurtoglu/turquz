-- 0027_transcript_room.sql
-- Birleşik (paylaşımlı) odada transkript ODA bazlı tutulur. Oda: "iv-<acente>-<slotKey>".
-- Okuma, SECURITY DEFINER RPC ile: o adayın odasının tüm konuşması (aday + acente + diğer adaylar).
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.interview_transcripts add column if not exists room text;
create index if not exists transcripts_room_idx on public.interview_transcripts (room, created_at);

-- Bir adayın mülakat odasının tüm transkripti. Yetki: çağıran ya o aday ya da mülakatı kuran acente.
create or replace function public.session_transcript(p_candidate uuid)
  returns setof public.interview_transcripts
  language plpgsql security definer set search_path = public as $$
declare ag uuid; sel text; rm text;
begin
  select created_by, selected_slot into ag, sel from public.interviews where user_id = p_candidate;
  if ag is null or sel is null then return; end if;
  if auth.uid() <> p_candidate and auth.uid() <> ag then return; end if;
  rm := 'iv-' || ag::text || '-' || regexp_replace(sel, '[^a-z0-9]', '', 'gi');
  return query
    select * from public.interview_transcripts t where t.room = rm order by t.created_at asc;
end $$;
grant execute on function public.session_transcript(uuid) to authenticated;

notify pgrst, 'reload schema';
