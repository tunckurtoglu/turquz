-- 0058_process_chat.sql
-- Sözleşme ödemesi (paid/waived) sonrası acente ↔ aday metin sohbeti.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Acente bildirim tercihleri (aday satırı olmaz → varsayılan açık)
create table if not exists public.agency_notif_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  general_push boolean not null default true,
  chat_push boolean not null default true,
  preferred_lang text,
  updated_at timestamptz not null default now()
);

alter table public.agency_notif_prefs enable row level security;

drop policy if exists agency_notif_prefs_own on public.agency_notif_prefs;
create policy agency_notif_prefs_own on public.agency_notif_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sohbet thread: bir aday + bir acente
create table if not exists public.process_chats (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users (id) on delete cascade,
  agency_id uuid not null references auth.users (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  closed_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_id, agency_id)
);

create index if not exists process_chats_agency_idx
  on public.process_chats (agency_id, last_message_at desc nulls last);
create index if not exists process_chats_candidate_idx
  on public.process_chats (candidate_id);

alter table public.process_chats enable row level security;

drop policy if exists process_chats_select_party on public.process_chats;
create policy process_chats_select_party on public.process_chats
  for select using (
    auth.uid() = candidate_id
    or auth.uid() = agency_id
    or public.is_admin()
  );

-- Mesajlar (yalnızca metin)
create table if not exists public.process_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.process_chats (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  source_lang text,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint process_chat_messages_body_len check (char_length(body) between 1 and 2000)
);

create index if not exists process_chat_messages_chat_idx
  on public.process_chat_messages (chat_id, created_at);

alter table public.process_chat_messages enable row level security;

drop policy if exists process_chat_messages_select_party on public.process_chat_messages;
create policy process_chat_messages_select_party on public.process_chat_messages
  for select using (
    exists (
      select 1 from public.process_chats c
      where c.id = chat_id
        and (c.candidate_id = auth.uid() or c.agency_id = auth.uid() or public.is_admin())
    )
  );

-- Insert/update mesajlar service role (edge) üzerinden; istemci doğrudan yazmaz.
-- Thread oluşturma da edge/RPC.

-- Ödeme sonrası sohbet açılabilir mi?
create or replace function public.contract_chat_unlocked(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contracts c
    where c.user_id = p_candidate
      and public.contract_is_paid(c.payment_status)
      and c.created_by is not null
  );
$$;

revoke all on function public.contract_chat_unlocked(uuid) from public;
grant execute on function public.contract_chat_unlocked(uuid) to authenticated;

-- Thread getir / oluştur (yalnızca paid + taraf)
create or replace function public.ensure_process_chat(p_candidate uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_uid uuid := auth.uid();
  v_chat uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select c.created_by into v_agency
  from public.contracts c
  where c.user_id = p_candidate
    and public.contract_is_paid(c.payment_status)
  limit 1;

  if v_agency is null then
    raise exception 'chat_locked';
  end if;

  if v_uid <> p_candidate and v_uid <> v_agency and not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  insert into public.process_chats (candidate_id, agency_id)
  values (p_candidate, v_agency)
  on conflict (candidate_id, agency_id) do update
    set closed_at = null
  returning id into v_chat;

  if v_chat is null then
    select id into v_chat from public.process_chats
    where candidate_id = p_candidate and agency_id = v_agency;
  end if;

  return v_chat;
end;
$$;

revoke all on function public.ensure_process_chat(uuid) from public;
grant execute on function public.ensure_process_chat(uuid) to authenticated;

-- Realtime
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'process_chat_messages'
  ) then
    alter publication supabase_realtime add table public.process_chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
