// Saf format yardımcısı (web + app). RN bağımlılığı yok.

/** fresh | recent | stale | never — kart stili için. */
export function lastSeenTier(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'fresh';
  if (ms < 60 * 60 * 1000) return 'fresh';       // < 1 sa
  if (ms < 24 * 60 * 60 * 1000) return 'recent';  // < 24 sa
  return 'stale';
}

/** Profil kartı / havuz için göreli "son çevrimiçi" metni (sadece süre kısmı). */
export function formatLastSeen(iso, t) {
  const tr = typeof t === 'function' ? t : (k) => k;
  if (!iso) return tr('online_never') || 'Henüz çevrimiçi olmadı';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return tr('online_just_now') || 'Az önce';
  const min = Math.floor(ms / 60000);
  if (min < 5) return tr('online_just_now') || 'Az önce';
  if (min < 60) return (tr('online_minutes') || '{n} dakika önce').replace('{n}', String(min));
  const hr = Math.floor(min / 60);
  if (hr < 24) return (tr('online_hours') || '{n} saat önce').replace('{n}', String(hr));
  const day = Math.floor(hr / 24);
  if (day < 7) return (tr('online_days') || '{n} gün önce').replace('{n}', String(day));
  const week = Math.floor(day / 7);
  if (day < 30) return (tr('online_weeks') || '{n} hafta önce').replace('{n}', String(Math.max(1, week)));
  const mo = Math.floor(day / 30);
  return (tr('online_months') || '{n} ay önce').replace('{n}', String(Math.max(1, mo)));
}

/** "Son görülme: Az önce" — prefix + süre. */
export function formatLastSeenLabeled(iso, t) {
  const tr = typeof t === 'function' ? t : (k) => k;
  const prefix = tr('online_seen_prefix') || 'Son görülme';
  const when = formatLastSeen(iso, tr);
  if (!iso) return when;
  return `${prefix}: ${when}`;
}
