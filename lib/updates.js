// lib/updates.js
// EAS Update (OTA): yalnızca manuel çağrı. Açılışta ASLA çağırma / reloadAsync yok.
import * as Updates from 'expo-updates';

export async function checkForOtaUpdate() {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    // reloadAsync yok — sonraki soğuk açılışta uygulanır (açılış çökme döngüsü önlenir).
    return true;
  } catch (e) {
    console.warn('[OTA] Güncelleme kontrolü:', e?.message || e);
    return false;
  }
}
