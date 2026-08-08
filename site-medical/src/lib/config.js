// Turquz Sağlık — yapılandırma. Partner klinik adı/logosu HİÇ burada olmamalı.

export const SITE = {
  brand: 'TURQUZ',
  vertical: 'Sağlık',

  mainSiteUrl: 'https://turquz.app',

  // Bilgi / iletişim talebi
  email: 'saglik@turquz.app',

  // Sağlık sitesi WhatsApp numarası (ana siteden AYRI).
  // Doldurunca Bilgi al / Bilgi talebi + float buton wa.me sohbetine gider.
  // Örn: '+905xxxxxxxxx'
  // Ön mesaj metni dil bazlı: i18n `wa.message`
  whatsapp: '',

  appStore: '',
  playStore: '',

  social: { instagram: '', linkedin: '' },
  copyrightYear: 2026,
};

/**
 * @param {string} [message] dil bazlı ön mesaj (i18n `wa.message`)
 * @returns {string|null}
 */
export function whatsappHref(message = '') {
  const raw = String(SITE.whatsapp || '').trim();
  if (!raw) return null;
  const n = raw.replace(/\D/g, '');
  if (!n) return null;
  const msg = String(message || '').trim();
  const q = msg ? `?text=${encodeURIComponent(msg)}` : '';
  return `https://wa.me/${n}${q}`;
}

/** Bilgi CTA'ları — yalnızca WhatsApp (mailto yok). */
export function consultHref(message = '') {
  return whatsappHref(message) || '#';
}
