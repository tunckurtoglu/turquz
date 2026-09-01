-- Son mesaj önizlemesi (mesajlar gelen kutusu)
create or replace function public.agency_chat_inbox_previews(p_chat_ids uuid[])
returns table (
  chat_id uuid,
  body text,
  sender_id uuid,
  source_lang text,
  translations jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.chat_id)
    m.chat_id,
    m.body,
    m.sender_id,
    m.source_lang,
    m.translations,
    m.created_at
  from public.process_chat_messages m
  where m.chat_id = any(p_chat_ids)
  order by m.chat_id, m.created_at desc;
$$;

grant execute on function public.agency_chat_inbox_previews(uuid[]) to authenticated;
