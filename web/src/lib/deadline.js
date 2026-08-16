/** Kalan süre: "X gün, Y saat…" (i18n: deadline_remain). */
export function formatDeadlineRemain(ms, t) {
  if (typeof t !== 'function') {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d} gün, ${h} saat, ${m} dakika, ${s} saniye kaldı`;
  }
  if (!(Number(ms) > 0)) return t('deadline_overdue_short');
  const total = Math.floor(Number(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return t('deadline_remain', { d: String(d), h: String(h), m: String(m), s: String(s) });
}
