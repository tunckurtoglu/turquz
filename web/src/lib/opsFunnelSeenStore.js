// Web: süreç özeti “görüldü” sayaçları (localStorage).
const key = (agencyId) => `ops.funnel.seen.v1.${agencyId}`;

export function loadFunnelSeen(agencyId) {
  if (!agencyId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(agencyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFunnelSeen(agencyId, seen) {
  if (!agencyId || !seen || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(agencyId), JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}
