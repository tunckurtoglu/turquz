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

// Gizlilik metnini tarayıcıda aç.
export function openPrivacy() {
  Linking.openURL(PRIVACY_URL).catch(() => {});
}
