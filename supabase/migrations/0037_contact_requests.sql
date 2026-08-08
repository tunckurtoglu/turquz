-- 0037_contact_requests.sql
-- Vitrin sitesinin (site/) iletişim formundan gelen mesajları toplar.
-- Herkes (anon) YALNIZCA ekleyebilir; okuma sadece personele (acente/admin) açıktır.
-- Böylece form girişleri bir "lead kutusu" olur; spam okunamaz, sadece yetkili görür.
-- Çalıştırma: Supabase > SQL Editor > Run.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org text,
  email text not null,
  kind text,                       -- acente / otel / aday / diğer
  message text not null,
  lang text,                       -- form gönderildiğindeki site dili
  source text default 'site',
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

-- Anonim ve giriş yapmış herkes form gönderebilir (yalnız INSERT).
drop policy if exists contact_insert_any on public.contact_requests;
create policy contact_insert_any
  on public.contact_requests for insert
  to anon, authenticated
  with check (true);

-- Okuma yalnız personele (is_staff() — 0007/0008 migrasyonlarında tanımlı).
drop policy if exists contact_select_staff on public.contact_requests;
create policy contact_select_staff
  on public.contact_requests for select
  to authenticated
  using (public.is_staff());

-- Personel "handled" işaretleyebilsin.
drop policy if exists contact_update_staff on public.contact_requests;
create policy contact_update_staff
  on public.contact_requests for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create index if not exists contact_requests_created_idx
  on public.contact_requests (created_at desc);

notify pgrst, 'reload schema';
