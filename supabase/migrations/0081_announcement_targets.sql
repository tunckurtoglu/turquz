-- 0081_announcement_targets.sql
-- Duyuru hedefi: aday grubu (havuz / teklif / süreç / personel) veya seçili kullanıcılar.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.announcements
  drop constraint if exists announcements_audience_check;

alter table public.announcements
  add constraint announcements_audience_check
  check (audience in (
    'all', 'candidates', 'agencies',
    'pool', 'offered', 'process', 'hired',
    'selected'
  ));

alter table public.announcements
  add column if not exists target_ids uuid[] not null default '{}';

-- Liste RPC tabloyu setof döndürür; yeni sütunun PostgREST’te görünmesi için yeniden yükle.
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
