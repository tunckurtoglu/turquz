// lib/supabase.js
// Supabase bağlantısı. Anahtarlar .env'den okunur (git'e gitmez).
// Oturum AsyncStorage'da saklanır, böylece uygulama kapanıp açılınca giriş korunur.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Yapılandırma kontrolü — "Invalid path specified" gibi hataların kaynağı genelde
// burada yanlış bir URL olur. Beklenen: https://<proje-ref>.supabase.co (sonda / yok, path yok).
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Anahtarlar bulunamadı. .env dosyasını ve `expo start -c` ile yeniden başlatmayı kontrol et.');
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl)) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL beklenen biçimde değil:',
    JSON.stringify(supabaseUrl),
    '\n  → Olması gereken: https://<proje-ref>.supabase.co (sonda "/" yok, "/rest" veya dashboard linki değil).',
  );
} else {
  console.log('[supabase] Bağlanılan proje:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // React Native'de URL tabanlı oturum yok
  },
});
