// lib/config.js
// Uygulama geneli yapılandırma.
import { Linking } from 'react-native';

// KVKK Aydınlatma / Gizlilik metni web sayfası.
// TEK YER: web siten hazır olunca yalnızca bu URL'i güncelle; tüm linkler buraya gider.
export const PRIVACY_URL = 'https://turquz.com/kvkk';

// Gizlilik metnini tarayıcıda aç.
export function openPrivacy() {
  Linking.openURL(PRIVACY_URL).catch(() => {});
}
