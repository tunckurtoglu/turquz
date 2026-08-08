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
    // reloadAsync açılışta kullanılmaz — spinner/takılma veya yeniden yükleme döngüsü yapabilir.
    // İndirilen güncelleme bir sonraki açılışta devreye girer.
  } catch (e) {
    console.warn('[OTA] Güncelleme kontrolü:', e?.message || e);
  }
}
