-- 0070_push_token_claim.sql
-- Aynı cihaz Expo token'ı birden fazla kullanıcıya bağlı kalmasın.
-- Girişte token "claim" edilir (eski hesaplardan silinir); çıkışta cihaz token'ı kaldırılır.
-- Çalıştırma: Supabase > SQL Editor > Run.

-- Mevcut kirli veri: her token için yalnızca en güncel satırı bırak.
delete from public.push_tokens pt
where exists (
  select 1
  from public.push_tokens newer
  where newer.token = pt.token
    and (
      newer.updated_at > pt.updated_at
      or (newer.updated_at = pt.updated_at and newer.user_id > pt.user_id)
    )
);

create or replace function public.claim_push_token(
  p_token text,
  p_platform text default null,
  p_locale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if p_token is null or length(trim(p_token)) < 8 then
    return;
  end if;

  -- Bu cihaz artık yalnızca aktif oturuma ait.
  delete from public.push_tokens where token = trim(p_token);

  insert into public.push_tokens (user_id, token, platform, locale, updated_at)
  values (auth.uid(), trim(p_token), p_platform, p_locale, now())
  on conflict (user_id, token) do update set
    platform = excluded.platform,
    locale = excluded.locale,
    updated_at = now();
end;
$$;

grant execute on function public.claim_push_token(text, text, text) to authenticated;

notify pgrst, 'reload schema';
