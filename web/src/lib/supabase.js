// Web Supabase istemcisi — mobil uygulamayla AYNI proje/veritabanı.
// Anahtarlar web/.env'den (VITE_*). Oturum tarayıcıda saklanır.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY yok. web/.env oluştur.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
