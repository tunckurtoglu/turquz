// Mobil: süreç özeti “görüldü” sayaçları (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (agencyId) => `ops.funnel.seen.v1.${agencyId}`;

export async function loadFunnelSeen(agencyId) {
  if (!agencyId) return null;
  try {
    const raw = await AsyncStorage.getItem(key(agencyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveFunnelSeen(agencyId, seen) {
  if (!agencyId || !seen) return;
  try {
    await AsyncStorage.setItem(key(agencyId), JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}
