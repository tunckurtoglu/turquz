// lib/updates.js
// EAS Update (OTA): release build açılışında güncelleme kontrolü.
// Dev client / Expo Go'da Updates devre dışıdır — atlanır.
import * as Updates from 'expo-updates';

export function getOtaInfo() {
  if (__DEV__ || !Updates.isEnabled) return { enabled: false };
  const id = Updates.updateId || '';
  return {
    enabled: true,
    updateId: id,
    shortId: id ? id.slice(0, 8) : '—',
    channel: Updates.channel || null,
    runtimeVersion: Updates.runtimeVersion || null,
  };
}

/** Arka planda indir; otomatik reload yok (sürpriz gerileme riski). */
export async function checkForOtaUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
  } catch (e) {
    console.warn('[OTA] Güncelleme kontrolü:', e?.message || e);
  }
}

/** Ayarlar: kullanıcı isteyince en son OTA'yı indirip yükle. */
export async function applyOtaUpdateNow() {
  if (__DEV__ || !Updates.isEnabled) {
    return { ok: false, error: 'dev' };
  }
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}
