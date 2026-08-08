-- 0038_cv_translations.sql
-- Adayın serbest yazdığı CV metinlerinin (özet, ünvan, iş deneyimi pozisyonları,
-- eğitim açıklamaları, sertifikalar) acentenin diline yapay zekâ (Gemini) çevirisi —
-- ÖNBELLEK tablosu. Bir aday bir dilde ilk kez görüntülenince çevrilir ve burada saklanır;
-- sonraki tüm görüntülemeler (her acente) anında ve bedava olur.
-- Aday CV'sini düzenlerse source_hash değişir → otomatik yeniden çevrilir.
-- Yazma yalnızca edge function (service role) tarafından yapılır.
-- Çalıştırma: Supabase > SQL Editor > Run.

create table if not exists public.cv_translations (
  user_id uuid not null references auth.users (id) on delete cascade,
  lang text not null,                 -- hedef dil (acentenin dili): 'tr','en','ru',...
  source_hash text not null,          -- kaynak serbest metinlerin SHA-256'sı (değişince yeniden çevir)
  data jsonb not null,                -- çevrilmiş alanlar { title, profile, experience[], education[], certificates[] }
  updated_at timestamptz not null default now(),
  primary key (user_id, lang)
);

alter table public.cv_translations enable row level security;

-- Okuma yalnız personele (acente/admin). Yazma service role ile (RLS'i atlar).
drop policy if exists cv_tr_select_staff on public.cv_translations;
create policy cv_tr_select_staff
  on public.cv_translations for select
  to authenticated
  using (public.is_staff());

notify pgrst, 'reload schema';
