-- 0007_roles_agency.sql
-- Roller (candidate/agency/admin) + acentenin aday havuzunu görüp KABUL edebilmesi için RLS.
-- Acente hesabı kendi kaydolamaz; rolü admin (sen) buradan atar.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null default 'candidate' check (role in ('candidate', 'agency', 'admin')),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Kullanıcı yalnızca KENDİ rolünü okur (yazma yok → rolleri admin SQL'den verir).
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select using (auth.uid() = user_id);

-- Yardımcı: mevcut kullanıcı acente/admin mi? (RLS özyinelemesini önlemek için SECURITY DEFINER)
create or replace function public.is_staff()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('agency', 'admin')
  );
$$;

-- profiles: acente/admin tüm adayları görebilir (havuz)
drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles
  for select using (public.is_staff());

-- candidate_status: acente/admin okuyabilir + kabul edebilir (insert/update)
drop policy if exists candidate_status_select_staff on public.candidate_status;
create policy candidate_status_select_staff on public.candidate_status
  for select using (public.is_staff());

drop policy if exists candidate_status_insert_staff on public.candidate_status;
create policy candidate_status_insert_staff on public.candidate_status
  for insert with check (public.is_staff());

drop policy if exists candidate_status_update_staff on public.candidate_status;
create policy candidate_status_update_staff on public.candidate_status
  for update using (public.is_staff()) with check (public.is_staff());

-- TEST: bir kullanıcıyı acente yapmak
--   insert into public.user_roles (user_id, role) values ('<acente-user-id>', 'agency')
--   on conflict (user_id) do update set role = 'agency', updated_at = now();
