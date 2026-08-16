// Duyuru metnini kullanıcının uygulama diline göre seç.
export function announcementText(payload, lang) {
  const p = payload || {};
  const i18n = p.i18n && typeof p.i18n === 'object' ? p.i18n : {};
  const code = String(lang || 'en').toLowerCase().split(/[-_]/)[0];
  const pack = i18n[code] || i18n.en || i18n.tr || null;
  const title = String(pack?.title || p.title || '').trim();
  const body = String(pack?.body || p.body || '').trim();
  return { title, body };
}
