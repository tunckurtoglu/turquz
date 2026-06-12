-- 0001_consents.sql
-- KVKK açık rıza kayıtları. Her onay AYRI bir satır olarak yazılır (değiştirilmez/silinmez):
-- böylece "kim, ne zaman, hangi sürüme, hangi izinleri verdi" denetlenebilir kalır.
-- Kullanıcı rızasını geri çekerse yeni bir satır eklenir (false değerlerle), eski satır durur.
--
-- Çalıştırma: Supabase > SQL Editor > bu dosyayı yapıştır > Run.

create table if not exists public.consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  consent_version int  not null,                 -- metin sürümü; metin değişince artar, kullanıcıya yeniden sorulur
  general         boolean not null default false, -- kişisel verilerin işlenmesi + otellerle paylaşım (fotoğraflar dâhil)
  sensitive       boolean not null default false, -- özel nitelikli veri (kan grubu, adli sicil belgesi)
  cross_border    boolean not null default false, -- yurt dışına aktarım (AB sunucu + AI doğrulama)
  locale          text,                           -- rızanın gösterildiği dil (kanıt için)
  accepted_at     timestamptz not null default now()
);

create index if not exists consents_user_idx
  on public.consents (user_id, accepted_at desc);

-- RLS: herkes yalnızca KENDİ rıza kayıtlarını görebilir ve ekleyebilir.
alter table public.consents enable row level security;

drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select using (auth.uid() = user_id);

drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert with check (auth.uid() = user_id);

-- Bilinçli olarak UPDATE/DELETE politikası YOK: rıza kayıtları denetim amacıyla
-- değiştirilemez. Geri çekme = yeni satır. Hesap silinince cascade ile temizlenir.
