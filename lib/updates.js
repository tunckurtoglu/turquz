// lib/updates.js
// OTA açık ama açılışta otomatik kontrol YOK (checkAutomatically: NEVER).
// reloadAsync yok — bozuk paket + zorla reload döngüsünü önlemek için.
// İndirilen güncelleme bir sonraki soğuk açılışta uygulanır.
import * as Updates from 'expo-updates';

export async function checkForOtaUpdate() {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    return true;
  } catch (e) {
    console.warn('[OTA]', e?.message || e);
    return false;
  }
}
