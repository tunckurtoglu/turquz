-- 0069_announcements.sql
-- Admin duyuruları: kayıt + bildirim yayını (aday / acente / ikisi).
-- Çalıştırma: Supabase > SQL Editor > Run.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  audience    text not null check (audience in ('all', 'candidates', 'agencies')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists announcements_created_idx
  on public.announcements (created_at desc);

alter table public.announcements enable row level security;

drop policy if exists announcements_admin_all on public.announcements;
create policy announcements_admin_all on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- Admin: son duyurular (liste)
create or replace function public.admin_list_announcements(p_limit int default 30)
returns setof public.announcements
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select * from public.announcements
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

grant execute on function public.admin_list_announcements(int) to authenticated;

notify pgrst, 'reload schema';
