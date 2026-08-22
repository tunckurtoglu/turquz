-- 0097: Süreç sohbeti kalıcı arşiv + admin erişim/silme.
-- Mesajlar hesap silinse bile kalır (FK SET NULL); yalnız admin silebilir.
-- Çalıştırma: 0096'dan sonra SQL Editor > Run.

-- Kullanıcı silinince sohbet/mesaj kaybolmasın
alter table public.process_chats
  alter column candidate_id drop not null,
  alter column agency_id drop not null;

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'process_chats'
      and con.contype = 'f'
  loop
    execute format('alter table public.process_chats drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.process_chats
  add constraint process_chats_candidate_id_fkey
    foreign key (candidate_id) references auth.users (id) on delete set null,
  add constraint process_chats_agency_id_fkey
    foreign key (agency_id) references auth.users (id) on delete set null;

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'process_chat_messages'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%sender_id%'
  loop
    execute format('alter table public.process_chat_messages drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.process_chat_messages
  alter column sender_id drop not null;

alter table public.process_chat_messages
  add constraint process_chat_messages_sender_id_fkey
    foreign key (sender_id) references auth.users (id) on delete set null;

-- İstemci silmesin (yalnız admin RPC)
revoke delete on public.process_chats from authenticated, anon;
revoke delete on public.process_chat_messages from authenticated, anon;

create or replace function public.admin_list_process_chats(p_limit int default 200)
returns table (
  chat_id uuid,
  candidate_id uuid,
  agency_id uuid,
  candidate_title text,
  candidate_reg_no int,
  agency_company text,
  unlocked_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz,
  message_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.candidate_id,
    c.agency_id,
    p.title,
    p.reg_no,
    coalesce(ap.company_name, ''),
    c.unlocked_at,
    c.closed_at,
    c.last_message_at,
    c.created_at,
    (select count(*) from public.process_chat_messages m where m.chat_id = c.id)
  from public.process_chats c
  left join public.profiles p on p.user_id = c.candidate_id
  left join public.agency_profiles ap on ap.user_id = c.agency_id
  where public.is_admin()
  order by coalesce(c.last_message_at, c.created_at) desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

revoke all on function public.admin_list_process_chats(int) from public;
grant execute on function public.admin_list_process_chats(int) to authenticated;

create or replace function public.admin_list_process_chat_messages(p_chat uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_role text,
  body text,
  source_lang text,
  translations jsonb,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.sender_id,
    case
      when m.sender_id is null then 'unknown'
      when m.sender_id = c.agency_id then 'agency'
      when m.sender_id = c.candidate_id then 'candidate'
      else 'other'
    end,
    m.body,
    m.source_lang,
    m.translations,
    m.created_at,
    m.read_at
  from public.process_chat_messages m
  join public.process_chats c on c.id = m.chat_id
  where public.is_admin()
    and m.chat_id = p_chat
  order by m.created_at asc;
$$;

revoke all on function public.admin_list_process_chat_messages(uuid) from public;
grant execute on function public.admin_list_process_chat_messages(uuid) to authenticated;

create or replace function public.admin_delete_process_chat(p_chat uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_chat is null then raise exception 'bad_request'; end if;
  delete from public.process_chat_messages where chat_id = p_chat;
  delete from public.process_chats where id = p_chat;
end;
$$;

revoke all on function public.admin_delete_process_chat(uuid) from public;
grant execute on function public.admin_delete_process_chat(uuid) to authenticated;

notify pgrst, 'reload schema';
