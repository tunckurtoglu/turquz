-- setup_all.sql — TEK DOSYALIK KURULUM (tekrar çalıştırılabilir / idempotent)
-- Tüm tabloları, güvenlik politikalarını ve ACENTE rolünü garanti kurar.
-- Daha önce parça parça migration çalıştırdıysan da sorun değil; bu dosya eksikleri tamamlar.
--
-- KULLANIM:
--   1) Aşağıdaki son satırda 'SENIN_ACENTE_EPOSTAN' yerine acente hesabının e-postasını yaz.
--   2) Supabase > SQL Editor > bu dosyanın TAMAMINI yapıştır > Run.
--   3) Uygulamada acente girişi yap → doğrudan Aday Havuzu açılır.

----------------------------------------------------------------------
-- 1) PROFILLER (aday CV'leri)
----------------------------------------------------------------------
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  title       text,
  data        jsonb not null default '{}'::jsonb,
  source_lang text,
  updated_at  timestamptz not null default now()
);
alter table public.profiles
  add column if not exists gender text,
  add column if not exists nationality text,
  add column if not exists birth_year int,
  add column if not exists positions text[],
  add column if not exists languages text[],
  add column if not exists skills text[];
create index if not exists profiles_nationality_idx on public.profiles (nationality);
create index if not exists profiles_gender_idx on public.profiles (gender);
create index if not exists profiles_birth_year_idx on public.profiles (birth_year);
create index if not exists profiles_positions_idx on public.profiles using gin (positions);
create index if not exists profiles_languages_idx on public.profiles using gin (languages);
create index if not exists profiles_skills_idx on public.profiles using gin (skills);
-- Aday No (kayıt sırası)
create sequence if not exists public.profile_reg_seq;
alter table public.profiles add column if not exists reg_no int;
with ordered as (select user_id, row_number() over (order by updated_at) as rn from public.profiles where reg_no is null)
update public.profiles p set reg_no = o.rn from ordered o where p.user_id = o.user_id;
select setval('public.profile_reg_seq', coalesce((select max(reg_no) from public.profiles), 0));
alter table public.profiles alter column reg_no set default nextval('public.profile_reg_seq');
create unique index if not exists profiles_reg_no_idx on public.profiles (reg_no);
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = user_id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

----------------------------------------------------------------------
-- 2) RIZA KAYITLARI
----------------------------------------------------------------------
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_version int not null,
  general boolean not null default false,
  sensitive boolean not null default false,
  cross_border boolean not null default false,
  locale text,
  accepted_at timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id, accepted_at desc);
alter table public.consents enable row level security;
drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents for select using (auth.uid() = user_id);
drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents for insert with check (auth.uid() = user_id);

----------------------------------------------------------------------
-- 3) ADAY DURUMU (belge yükleme kapısı + aşama)
----------------------------------------------------------------------
create table if not exists public.candidate_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  docs_unlocked boolean not null default false,
  status text not null default 'new',
  accepted_by text,
  accepted_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.candidate_status add column if not exists stage int not null default 0;
alter table public.candidate_status enable row level security;
drop policy if exists candidate_status_select_own on public.candidate_status;
create policy candidate_status_select_own on public.candidate_status for select using (auth.uid() = user_id);

----------------------------------------------------------------------
-- 4) BELGELER (private bucket + üst-veri)
----------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_read_own on storage.objects;
create policy documents_read_own on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists documents_insert_own on storage.objects;
create policy documents_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists documents_update_own on storage.objects;
create policy documents_update_own on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists documents_delete_own on storage.objects;
create policy documents_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.user_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  storage_path text not null,
  mime_type text,
  status text not null default 'uploaded',
  expiry_date date,
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents add constraint user_documents_kind_check
  check (kind in ('passport','diploma','criminal','contract_signed','consulate_ref','work_permit','contract_unsigned','flight_ticket'));
alter table public.user_documents enable row level security;
drop policy if exists user_documents_select_own on public.user_documents;
create policy user_documents_select_own on public.user_documents for select using (auth.uid() = user_id);
drop policy if exists user_documents_insert_own on public.user_documents;
create policy user_documents_insert_own on public.user_documents for insert with check (auth.uid() = user_id);
drop policy if exists user_documents_update_own on public.user_documents;
create policy user_documents_update_own on public.user_documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_documents_delete_own on public.user_documents;
create policy user_documents_delete_own on public.user_documents for delete using (auth.uid() = user_id);

----------------------------------------------------------------------
-- 5) ROLLER + ACENTE ERİŞİMİ
----------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'candidate' check (role in ('candidate','agency','admin')),
  updated_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.is_staff()
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('agency','admin'));
$$;

-- acente/admin: tüm adayları görür
drop policy if exists profiles_select_staff on public.profiles;
create policy profiles_select_staff on public.profiles for select using (public.is_staff());
-- acente/admin: durumları okur + kabul eder
drop policy if exists candidate_status_select_staff on public.candidate_status;
create policy candidate_status_select_staff on public.candidate_status for select using (public.is_staff());
drop policy if exists candidate_status_insert_staff on public.candidate_status;
create policy candidate_status_insert_staff on public.candidate_status for insert with check (public.is_staff());
drop policy if exists candidate_status_update_staff on public.candidate_status;
create policy candidate_status_update_staff on public.candidate_status for update using (public.is_staff()) with check (public.is_staff());

----------------------------------------------------------------------
-- 5b) ADAY HAVUZU GÖRÜNÜMÜ (acente/admin profilleri gizli)
----------------------------------------------------------------------
create or replace function public.is_user_staff(uid uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('agency', 'admin'));
$$;
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select user_id, title, reg_no,
         (data - 'email' - 'phone' - 'phoneConfirm'
               - 'location' - 'passportNo' - 'family') as data,
         updated_at, gender, nationality, birth_year, positions, languages, skills
  from public.profiles
  where not public.is_user_staff(user_id);
grant select on public.candidate_pool to authenticated;

----------------------------------------------------------------------
-- 6) ACENTE HESABINI ROL OLARAK ATA  ⬇⬇ E-POSTAYI DEĞİŞTİR ⬇⬇
----------------------------------------------------------------------
insert into public.user_roles (user_id, role)
select id, 'agency' from auth.users where email = 'SENIN_ACENTE_EPOSTAN'
on conflict (user_id) do update set role = 'agency', updated_at = now();

-- Şema önbelleğini yenile
notify pgrst, 'reload schema';

-- Kontrol: acente e-postanın karşısında 'agency' görmelisin
select u.email, r.role from auth.users u left join public.user_roles r on r.user_id = u.id order by u.email;
