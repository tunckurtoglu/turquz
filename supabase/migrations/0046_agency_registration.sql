-- 0046_agency_registration.sql
-- Acente self-kayıt + zorunlu kurulum (vergi levhası PDF, yetkili ad/soyad, 2 telefon).
-- Admin paneli: is_admin() ile tüm acente profilleri + agency-docs.

-- ---- helpers ----
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---- agency_profiles ----
create table if not exists public.agency_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  company_name         text,
  contact_first_name   text,
  contact_last_name    text,
  phone_authorized     text,          -- yetkili telefon
  phone_rep            text,          -- temsilci telefon
  tax_plate_path       text,          -- storage: agency-docs/{uid}/vergi_levhasi.pdf
  tax_plate_mime       text,
  completed_at         timestamptz,   -- doluysa CV havuzuna girebilir
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists agency_profiles_completed_idx
  on public.agency_profiles (completed_at);

alter table public.agency_profiles enable row level security;

-- Acente kendi satırını okur/yazar
drop policy if exists agency_profiles_own on public.agency_profiles;
create policy agency_profiles_own on public.agency_profiles
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Yalnızca admin tüm acente profillerini okur (admin paneli)
drop policy if exists agency_profiles_staff_select on public.agency_profiles;
drop policy if exists agency_profiles_admin_select on public.agency_profiles;
create policy agency_profiles_admin_select on public.agency_profiles
  for select using (public.is_admin());

-- Mevcut acenteleri kilitleme: grandfather (kurulum tamam say)
insert into public.agency_profiles (user_id, completed_at)
select ur.user_id, now()
from public.user_roles ur
where ur.role = 'agency'
on conflict (user_id) do nothing;

-- ---- Self-kayıt: acente rolü ----
-- Client user_roles yazamaz; bu RPC auth.uid() için agency satırı açar.
-- Zaten candidate ise reddeder (yanlış portalda kayıtlı aday hesabı).
create or replace function public.register_as_agency()
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
    insert into public.agency_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
    return 'agency';
  end if;
  if existing = 'candidate' then
    raise exception 'already_candidate';
  end if;

  insert into public.user_roles (user_id, role)
  values (uid, 'agency');

  insert into public.agency_profiles (user_id)
  values (uid)
  on conflict (user_id) do nothing;

  return 'agency';
end;
$$;

revoke all on function public.register_as_agency() from public;
grant execute on function public.register_as_agency() to authenticated;

-- Kurulum tamam mı? (client gate)
create or replace function public.is_agency_setup_complete(p_user uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- completed_at set ise kurulum kapısı geçildi (mevcut acenteler grandfather).
  select exists (
    select 1 from public.agency_profiles
    where user_id = p_user and completed_at is not null
  );
$$;

revoke all on function public.is_agency_setup_complete(uuid) from public;
grant execute on function public.is_agency_setup_complete(uuid) to authenticated;

-- ---- Storage: agency-docs ----
insert into storage.buckets (id, name, public)
values ('agency-docs', 'agency-docs', false)
on conflict (id) do nothing;

-- Path: {auth.uid()}/vergi_levhasi.pdf
drop policy if exists agency_docs_own_select on storage.objects;
create policy agency_docs_own_select on storage.objects
  for select to authenticated
  using (bucket_id = 'agency-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists agency_docs_own_insert on storage.objects;
create policy agency_docs_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agency-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists agency_docs_own_update on storage.objects;
create policy agency_docs_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'agency-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists agency_docs_own_delete on storage.objects;
create policy agency_docs_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'agency-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Yalnızca admin tüm agency-docs okuyabilir (admin paneli)
drop policy if exists agency_docs_staff_select on storage.objects;
drop policy if exists agency_docs_admin_select on storage.objects;
create policy agency_docs_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'agency-docs' and public.is_admin());

notify pgrst, 'reload schema';
