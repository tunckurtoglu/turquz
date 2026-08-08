// lib/lastSeen.js — aday last_seen_at güncelleme (React Native)
import { AppState } from 'react-native';
import { supabase } from './supabase';
import { formatLastSeen } from './lastSeenFormat';

export { formatLastSeen };

let lastTouchMs = 0;
const TOUCH_MIN_GAP_MS = 10 * 60 * 1000; // aynı oturumda 10 dk'da bir yaz

/** Aday app açınca / ön plana gelince çağır. */
export async function touchLastSeen(force = false) {
  const now = Date.now();
  if (!force && now - lastTouchMs < TOUCH_MIN_GAP_MS) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { error } = await supabase.rpc('touch_last_seen');
    if (error) throw error;
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
