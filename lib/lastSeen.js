// lib/lastSeen.js — aday last_seen_at güncelleme (React Native)
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { formatLastSeen } from './lastSeenFormat';

export { formatLastSeen };

let lastTouchMs = 0;
const TOUCH_MIN_GAP_MS = 10 * 60 * 1000; // aynı oturumda 10 dk'da bir yaz

/** Aday app açınca / ön plana gelince / CV kaydınca çağır. */
export async function touchLastSeen(force = false) {
  const now = Date.now();
  if (!force && now - lastTouchMs < TOUCH_MIN_GAP_MS) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;

    const { data, error } = await supabase.rpc('touch_last_seen');
    if (error) {
      // RPC yoksa / hata: doğrudan update dene
      const { error: uErr } = await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', uid);
      if (uErr) throw uErr;
    } else if (data === false) {
      // Profil satırı henüz yok — CV kaydı last_seen yazacak
      return;
    }
    lastTouchMs = now;
  } catch (e) {
    console.warn('last_seen:', e?.message || e);
  }
}

/** AppState dinleyicisi — foreground'a her dönüşte (throttle'lı) dokun. */
export function startLastSeenTracking() {
  touchLastSeen(true);
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') touchLastSeen(false);
  });
  return () => sub?.remove?.();
}
