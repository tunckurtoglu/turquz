// lib/updates.js
// checkAutomatically: NEVER. Boot’ta manuel check OK.
// reloadAsync yalnız CrashGate “Güncellemeyi uygula” ile — bilinçli kurtarma.
import { InteractionManager } from 'react-native';

export async function checkForOtaUpdate({ autoReload = false } = {}) {
  if (__DEV__) return false;
  try {
    const Updates = await import('expo-updates');
    if (!Updates.isEnabled) return false;
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    if (autoReload) {
      // Kısa gecikme — ilk frame çizilsin
      await new Promise((r) => setTimeout(r, 300));
      await Updates.reloadAsync();
    }
    return true;
  } catch (e) {
    console.warn('[OTA]', e?.message || e);
    return false;
  }
}

/** CrashGate / kurtarma: yeni OTA varsa indir, sonra reload. */
export async function applyOtaAndReload() {
  if (__DEV__) return { ok: false, reason: 'dev' };
  try {
    const Updates = await import('expo-updates');
    if (!Updates.isEnabled) return { ok: false, reason: 'updates kapalı' };
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
    }
    // İlk frame çizilsin, sonra reload (beyaz splash’ta takılma riski azalır).
    await new Promise((resolve) => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => setTimeout(resolve, 120));
      });
    });
    await Updates.reloadAsync();
    return { ok: true };
  } catch (e) {
    console.warn('[OTA apply]', e?.message || e);
    return { ok: false, reason: String(e?.message || e) };
  }
}
