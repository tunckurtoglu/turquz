-- 0072_last_seen_touch_fix.sql
-- last_seen_at null kalan adaylar + touch_last_seen güvenilirliği.
-- Çalıştırma: Supabase > SQL Editor > Run.

-- CV kaydı / eski istemci yüzünden null kalanları güncelle
update public.profiles
set last_seen_at = coalesce(last_seen_at, updated_at, now())
where last_seen_at is null;

-- Dönüş tipi void → boolean değişiyor; önce düşür.
drop function if exists public.touch_last_seen();

create function public.touch_last_seen()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set last_seen_at = now()
  where user_id = auth.uid();

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

notify pgrst, 'reload schema';
