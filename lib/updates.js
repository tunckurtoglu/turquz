// lib/updates.js
// EAS Update (OTA): release build açılışında güncelleme kontrolü.
// Dev client / Expo Go'da Updates devre dışıdır — atlanır.
import * as Updates from 'expo-updates';

export async function checkForOtaUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    // TestFlight gömülü bundle Temmuz'dan; indirilen güncellemeyi hemen uygula.
    await Updates.reloadAsync();
  } catch (e) {
    console.warn('[OTA] Güncelleme kontrolü:', e?.message || e);
  }
}
