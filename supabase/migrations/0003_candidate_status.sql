-- 0003_candidate_status.sql
-- Aday durumu / belge yükleme kapısı.
-- Belge yükleme HERKESE açık değil: yalnızca bir otel/acenta adayı KABUL edince
-- (docs_unlocked = true) adayın profilinde belge yükleme aktifleşir. Böylece seçilmemiş
-- yüzlerce aday boşuna evrak yüklemez.
--
-- Aday yalnızca KENDİ durumunu OKUR; onayı yazma yetkisi yok — onayı otel/acenta paneli
-- (service role) ya da test için admin set eder.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.candidate_status (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  docs_unlocked boolean not null default false,        -- belge yükleme açık mı
  status        text not null default 'new',           -- new | accepted | ... (ileride genişler)
  accepted_by   text,                                  -- onaylayan otel/acenta (panel doldurur)
  accepted_at   timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.candidate_status enable row level security;

-- Aday yalnızca kendi durumunu görebilir.
drop policy if exists candidate_status_select_own on public.candidate_status;
create policy candidate_status_select_own on public.candidate_status
  for select using (auth.uid() = user_id);

-- Bilinçli olarak insert/update/delete politikası YOK:
-- aday kendini onaylayamaz. Yazma yalnızca service role (panel/admin) ile yapılır.
--
-- TEST İÇİN bir adayı elle açmak (SQL Editor service role ile çalışır):
--   insert into public.candidate_status (user_id, docs_unlocked, status, accepted_by, accepted_at)
--   values ('<aday-user-id>', true, 'accepted', 'test-otel', now())
--   on conflict (user_id) do update set docs_unlocked = true, status = 'accepted', updated_at = now();
