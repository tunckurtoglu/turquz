// lib/updates.js
// OTA kapalı (app.json updates.enabled=false). Açılışta expo-updates
// errorRecoveryQueue abort etmesin diye native import yok.
export async function checkForOtaUpdate() {
  return false;
}
