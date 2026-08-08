-- 0065_role_lock.sql
-- Bir hesap YA aday YA acente: rol satırı zorunlu; portal geçişi yasak.
-- Çalıştırma: Supabase > SQL Editor > Run.

-- ---- Yeni auth kullanıcısı → user_roles (metadata.portal) ----
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  portal text := lower(coalesce(new.raw_user_meta_data->>'portal', 'candidate'));
  r text;
begin
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

drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- ---- Mevcut kullanıcılar: eksik rolü doldur ----
-- agency_profiles.completed_at varsa agency; aksi halde candidate
insert into public.user_roles (user_id, role)
select u.id,
  case
    when ap.completed_at is not null then 'agency'
    when ap.user_id is not null
         and not exists (select 1 from public.profiles p where p.user_id = u.id and p.reg_no is not null)
      then 'agency'
    else 'candidate'
  end
from auth.users u
left join public.agency_profiles ap on ap.user_id = u.id
left join public.user_roles ur on ur.user_id = u.id
where ur.user_id is null
on conflict (user_id) do nothing;

-- ---- Acente kaydı: aday izi varsa asla agency yapma ----
create or replace function public.register_as_agency()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing text;
  has_candidate boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select role into existing from public.user_roles where user_id = uid;

  if existing = 'admin' then
    return 'admin';
  end if;

  if existing = 'agency' then
    insert into public.agency_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
    return 'agency';
  end if;

  -- Açık candidate rolü
  if existing = 'candidate' then
    raise exception 'already_candidate';
  end if;

  -- Rol yoksa bile aday izi (eski boşluk / race) → agency yasak
  select exists (
    select 1 from public.profiles p
    where p.user_id = uid and p.reg_no is not null
  ) or exists (
    select 1 from public.candidate_status cs where cs.user_id = uid
  ) into has_candidate;

  if has_candidate then
    insert into public.user_roles (user_id, role)
    values (uid, 'candidate')
    on conflict (user_id) do update
      set role = 'candidate', updated_at = now()
      where public.user_roles.role is distinct from 'admin';
    raise exception 'already_candidate';
  end if;

  insert into public.user_roles (user_id, role)
  values (uid, 'agency')
  on conflict (user_id) do update
    set role = excluded.role, updated_at = now()
    where public.user_roles.role is distinct from 'admin';

  insert into public.agency_profiles (user_id)
  values (uid)
  on conflict (user_id) do nothing;

  return 'agency';
end;
$$;

revoke all on function public.register_as_agency() from public;
grant execute on function public.register_as_agency() to authenticated;

-- ---- Aday kaydı: agency hesabı candidate'e düşmesin ----
create or replace function public.register_as_candidate()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select role into existing from public.user_roles where user_id = uid;

  if existing = 'admin' then
    return 'admin';
  end if;
  if existing = 'agency' then
    raise exception 'already_agency';
  end if;
  if existing = 'candidate' then
    return 'candidate';
  end if;

  insert into public.user_roles (user_id, role)
  values (uid, 'candidate')
  on conflict (user_id) do nothing;

  return 'candidate';
end;
$$;

revoke all on function public.register_as_candidate() from public;
grant execute on function public.register_as_candidate() to authenticated;

-- ---- Loophole kurbanı: do_al@hotmail.com → tekrar aday ----
update public.user_roles
set role = 'candidate', updated_at = now()
where user_id = '39a25152-23a7-4283-9f58-f88971020241'
  and role = 'agency';

-- Tamamlanmamış acente kurulum satırını temizle (aday CV'si kalsın)
delete from public.agency_profiles
where user_id = '39a25152-23a7-4283-9f58-f88971020241'
  and completed_at is null;

notify pgrst, 'reload schema';
