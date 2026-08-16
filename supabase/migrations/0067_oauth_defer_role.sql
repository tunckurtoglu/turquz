-- 0067_oauth_defer_role.sql
-- Google/Apple OAuth metadata'da portal taşımaz. Rolü hemen candidate yazmak
-- acente portalından OAuth'u kırıyordu (register_as_agency → already_candidate).
-- portal yoksa rol yazma; app register_as_agency / register_as_candidate ile kilitler.
-- E-posta kaydı options.data.portal ile eskisi gibi çalışır.
-- Çalıştırma: Supabase > SQL Editor > Run.

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  portal text := lower(nullif(trim(coalesce(new.raw_user_meta_data->>'portal', '')), ''));
  r text;
begin
  -- OAuth vb.: portal gelmediyse rolü app tarafındaki register_as_* belirler.
  if portal is null then
    return new;
  end if;

  if portal = 'agency' then
    r := 'agency';
  else
    r := 'candidate';
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, r)
  on conflict (user_id) do nothing;

  if r = 'agency' then
    insert into public.agency_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
