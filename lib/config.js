// lib/config.js
// Uygulama geneli yapılandırma.
import { Linking } from 'react-native';

// KVKK Aydınlatma / Gizlilik metni web sayfası.
// TEK YER: web siten hazır olunca yalnızca bu URL'i güncelle; tüm linkler buraya gider.
export const PRIVACY_URL = 'https://turquz.com/kvkk';

// Sözleşme web portalı — kariyer sitesi /sozlesme (menüde yok; app token ile açar).
// Geçici Vercel: https://turquz-careers.vercel.app/sozlesme
// Canlı domain: https://kariyer.turquz.app/sozlesme
// EXPO_PUBLIC_CONTRACT_PORTAL_URL ile override edilir.
export const CONTRACT_PORTAL_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CONTRACT_PORTAL_URL)
  || 'https://turquz-careers.vercel.app/sozlesme';

// Aday destek hattı (WhatsApp). Ülke kodu + numara, boşluksuz. Örn: '905551112233'
// EXPO_PUBLIC_TURQUZ_SUPPORT_WA ile override edilir.
export const TURQUZ_SUPPORT_WA = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_TURQUZ_SUPPORT_WA) || '79190115566',
).replace(/\D/g, '');

export const TURQUZ_SUPPORT_EMAIL = 'info@turquz.app';

// Adayın uygulamayı paylaşırken gidecek link (mağaza linkleri gelince EXPO_PUBLIC ile değiştirilir).
export const APP_SHARE_URL = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_APP_SHARE_URL) || 'https://turquz.app',
).trim();

export const INSTAGRAM_URL = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_INSTAGRAM_URL) || 'https://www.instagram.com/turquzz',
).trim();

export const TIKTOK_URL = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_TIKTOK_URL) || 'https://www.tiktok.com/@turquzz',
).trim();

/** Kariyer / tanıtım web sitesi. */
export const CAREER_SITE_URL = String(
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CAREER_SITE_URL) || 'https://www.turquzcareer.com',
).trim();
export const CAREER_SITE_HOST = 'www.turquzcareer.com';
export function openExternal(url) {
  const href = String(url || '').trim();
  if (!href) return Promise.resolve();
  return Linking.openURL(href).catch(() => {});
}

export function openTurquzEmail({ subject = 'Turquz', body = '' } = {}) {
  const sub = encodeURIComponent(String(subject || 'Turquz'));
  const msg = encodeURIComponent(String(body || ''));
  return Linking.openURL(`mailto:${TURQUZ_SUPPORT_EMAIL}?subject=${sub}&body=${msg}`);
}

export function openTurquzWhatsApp(prefill = '') {
  if (!TURQUZ_SUPPORT_WA) return Promise.reject(new Error('no-wa'));
  const q = prefill ? `?text=${encodeURIComponent(String(prefill))}` : '';
  return Linking.openURL(`https://wa.me/${TURQUZ_SUPPORT_WA}${q}`);
}

/** Aynı destek numarası üzerinden Telegram sohbeti. */
export function openTurquzTelegram(prefill = '') {
  if (!TURQUZ_SUPPORT_WA) return Promise.reject(new Error('no-tg'));
  const phone = TURQUZ_SUPPORT_WA;
  const base = `https://t.me/+${phone}`;
  const q = prefill ? `?text=${encodeURIComponent(String(prefill))}` : '';
  return Linking.openURL(base + q);
}

/** Geriye uyumluluk: WhatsApp destek. */
export function openTurquzSupportChat(prefill = '') {
  const msg = String(prefill || '').trim();
  if (TURQUZ_SUPPORT_WA) return openTurquzWhatsApp(msg);
  return openTurquzEmail({ subject: 'Turquz', body: msg });
}

// Gizlilik metnini tarayıcıda aç.
export function openPrivacy() {
  Linking.openURL(PRIVACY_URL).catch(() => {});
}
