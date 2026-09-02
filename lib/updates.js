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
    // reloadAsync kaldırıldı — zorla yükleme eski tasarıma geri döndürebiliyordu.
    // İndirilen güncelleme bir sonraki soğuk açılışta devreye girer.
  } catch (e) {
    console.warn('[OTA] Güncelleme kontrolü:', e?.message || e);
  }
}
