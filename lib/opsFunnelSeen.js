// Süreç özeti (funnel) kutuları: yeni artış → kırmızı uyarı; görüntülenince temizlenir.
import { FUNNEL_TILES } from './opsUi';

export function funnelCountsFromMetrics(metrics = {}) {
  const out = {};
  FUNNEL_TILES.forEach((tile) => {
    out[tile.metricKey] = Math.max(0, Number(metrics[tile.metricKey]) || 0);
  });
  return out;
}

/** İlk kayıt yoksa mevcut sayıları “görüldü” say — açılışta tüm kutular kırmızı olmasın. */
export function seedFunnelSeen(metrics = {}) {
  return funnelCountsFromMetrics(metrics);
}

/**
 * seen yoksa null → henüz hydrate olmadı.
 * delta > 0 olan kutular “yeni güncelleme”.
 */
export function funnelNewDeltas(metrics = {}, seen) {
  if (!seen || typeof seen !== 'object') return {};
  const cur = funnelCountsFromMetrics(metrics);
  const deltas = {};
  Object.keys(cur).forEach((key) => {
    const prev = Math.max(0, Number(seen[key]) || 0);
    const n = cur[key];
    if (n > prev) deltas[key] = n - prev;
  });
  return deltas;
}

/** Sayı düştüyse seen’i aşağı çek (eski yüksek değer takılı kalmasın). */
export function clampFunnelSeen(seen, metrics = {}) {
  const cur = funnelCountsFromMetrics(metrics);
  const base = seen && typeof seen === 'object' ? { ...seen } : {};
  Object.keys(cur).forEach((key) => {
    const s = Math.max(0, Number(base[key]) || 0);
    base[key] = Math.min(s, cur[key]);
  });
  return base;
}

export function markFunnelTileSeen(seen, metrics = {}, metricKey) {
  const cur = funnelCountsFromMetrics(metrics);
  const next = clampFunnelSeen(seen, metrics);
  if (metricKey) next[metricKey] = cur[metricKey] ?? 0;
  return next;
}
