-- 0086_agency_notices.sql
-- Acente → kendi adaylarına tek yönlü operasyonel bilgilendirme (Turquz duyurusu değil).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.agency_notices (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references auth.users (id) on delete cascade,
  tone        text not null default 'info' check (tone in ('info', 'action', 'urgent')),
  title       text not null,
  body        text not null,
  source_lang text,
  i18n        jsonb not null default '{}'::jsonb,
  target_kind text not null default 'selected' check (target_kind in ('selected', 'focus')),
  created_at  timestamptz not null default now(),
  constraint agency_notices_title_len check (char_length(btrim(title)) between 1 and 120),
  constraint agency_notices_body_len check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists agency_notices_agency_created_idx
  on public.agency_notices (agency_id, created_at desc);

create table if not exists public.agency_notice_recipients (
  notice_id    uuid not null references public.agency_notices (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  read_at      timestamptz,
  primary key (notice_id, candidate_id)
);

create index if not exists agency_notice_recipients_cand_idx
  on public.agency_notice_recipients (candidate_id, read_at);

alter table public.agency_notices enable row level security;
alter table public.agency_notice_recipients enable row level security;

drop policy if exists agency_notices_select_own on public.agency_notices;
create policy agency_notices_select_own on public.agency_notices
  for select
  to authenticated
  using (agency_id = auth.uid() and public.is_staff());

drop policy if exists agency_notice_recipients_select on public.agency_notice_recipients;
create policy agency_notice_recipients_select on public.agency_notice_recipients
  for select
  to authenticated
  using (
    candidate_id = auth.uid()
    or exists (
      select 1 from public.agency_notices n
      where n.id = notice_id
        and n.agency_id = auth.uid()
        and public.is_staff()
    )
  );

grant select on public.agency_notices to authenticated;
grant select on public.agency_notice_recipients to authenticated;

-- Aday: kendi alıcı satırını + bildirimini okundu işaretler (makbuz).
create or replace function public.mark_agency_notice_read(p_notice uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_notice is null or auth.uid() is null then
    return;
  end if;
  update public.agency_notice_recipients
     set read_at = coalesce(read_at, now())
   where notice_id = p_notice
     and candidate_id = auth.uid();
  update public.notifications
     set read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and type = 'agency_notice'
     and read_at is null
     and coalesce(payload->>'notice_id', '') = p_notice::text;
end;
$$;

revoke all on function public.mark_agency_notice_read(uuid) from public;
grant execute on function public.mark_agency_notice_read(uuid) to authenticated;

notify pgrst, 'reload schema';
