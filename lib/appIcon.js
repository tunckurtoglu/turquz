// lib/appIcon.js
// Yerel saate göre uygulama ikonu: 19:00–06:00 koyu (#16202e), gündüz beyaz.
// Release build; açılış, ön plan ve dakikalık kontrol ile güncellenir.
import { AppState } from 'react-native';
import { setAlternateAppIcon, getAppIconName, supportsAlternateIcons } from 'expo-alternate-app-icons';

const DARK_ICON = 'Dark';
const NIGHT_START = 19; // 19:00
const DAY_START = 6; // 06:00'dan itibaren gündüz

export function isNightLocal(date = new Date()) {
  const h = date.getHours();
  return h >= NIGHT_START || h < DAY_START;
}

export async function syncAppIconTheme() {
  if (!supportsAlternateIcons) return;
  try {
    const wantDark = isNightLocal();
    const want = wantDark ? DARK_ICON : null;
    const current = getAppIconName();
    if (current === want) return;
    await setAlternateAppIcon(want);
  } catch (e) {
    console.warn('[appIcon]', e?.message || e);
  }
}

/** Ön plana gelince ve her dakika ikonu kontrol et (19:00 geçişi için). */
export function watchAppIconTheme() {
  syncAppIconTheme();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') syncAppIconTheme();
  });
  const interval = setInterval(syncAppIconTheme, 60_000);
  return () => {
    sub.remove();
    clearInterval(interval);
  };
}
