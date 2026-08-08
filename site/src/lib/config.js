// =========================================================================
// Site geneli yapılandırma — TÜM iletişim bilgileri ve linkler TEK yerde.
// Değerleri burada değiştirmen yeterli; site her yerde günceller.
// =========================================================================

export const SITE = {
  brand: 'TURQUZ',

  // İletişim — kendi bilgilerinle değiştir
  email: 'info@turquz.app',
  emailAgency: 'partners@turquz.app', // acente/otel başvuruları (boşsa 'email' kullanılır)
  phone: '+90 000 000 00 00',
  // Ana site WhatsApp numarası (sağlık sitesinden AYRI).
  // Doldurunca sağ alt float buton wa.me'ye gider. Örn: '+905xxxxxxxxx'
  // Ön mesaj dil bazlı: i18n `wa.message`
  whatsapp: '',

  // Uygulama mağaza linkleri (yayınlanınca doldur)
  appStore: '',          // https://apps.apple.com/...
  playStore: '',         // https://play.google.com/store/apps/...
  appFallback: '#contact', // mağaza linki yoksa nereye gitsin

  // Acente paneli (mevcut web paneli) adresi
  panelUrl: '#contact',  // örn https://panel.turquz.app

  // Hizmet dikeyleri için ayrı landing sayfaları (kendi domainleri).
  // Doldurursan ilgili kartın "Detaylı Bilgi" linki oraya gider; boşsa iletişime kaydırır.
  serviceUrls: {
    careers: 'https://turquz-careers.vercel.app',
    medical: 'https://turquz-medical.vercel.app',
    software: '',  // yazılım landing hazır olunca
    academy: '',
    tour: '',
    trade: '',
  },

  // Yasal sayfa linkleri (varsa)
  kvkkUrl: '',           // boşsa footer'da gizlenir
  privacyUrl: '',

  // Sosyal (boş olanlar gizlenir)
  social: {
    instagram: '',
    linkedin: '',
  },

  copyrightYear: 2026,
};

// E-posta gönderim hedefi (form fallback mailto için)
export const contactEmail = SITE.emailAgency || SITE.email;

/** @param {string} [message] dil bazlı ön mesaj (i18n `wa.message`) @returns {string|null} */
export function whatsappHref(message = '') {
  const raw = String(SITE.whatsapp || '').trim();
  if (!raw) return null;
  const n = raw.replace(/\D/g, '');
  if (!n) return null;
  const msg = String(message || '').trim();
  const q = msg ? `?text=${encodeURIComponent(msg)}` : '';
  return `https://wa.me/${n}${q}`;
}
