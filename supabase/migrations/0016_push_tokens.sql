-- 0016_push_tokens.sql
-- Cihaz push token'ları (Expo). Belge yüklemede karşı tarafa bildirim göndermek için.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  locale text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

-- Kullanıcı yalnızca kendi token'larını yönetir. (Bildirim gönderimi Edge Function'da
-- service_role ile yapılır; o RLS'i bypass eder, ekstra okuma politikası gerekmez.)
drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
