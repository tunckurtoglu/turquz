// Turquz Kariyer — site geneli yapılandırma. Tüm linkler/iletişim TEK yerde.

export const SITE = {
  brand: 'TURQUZ',
  vertical: 'Kariyer', // sayfa kimliği (logo yanında küçük etiket)

  // Ana siteye dönüş (üst menüdeki "Turquz.com" linki)
  mainSiteUrl: 'https://turquz.app',

  // Web paneller (aynı Supabase hesabı → app + web senkron)
  // Domain bağlanınca burayı güncelle (örn. https://panel.turquz.app).
  agencyPanelUrl: 'https://turquz-agency-panel.vercel.app',
  hotelPanelUrl: '', // otel web paneli hazır olunca doldur; boşsa "Yakında"

  // Uygulama mağaza linkleri (yayınlanınca doldur)
  appStore: '',   // https://apps.apple.com/...
  playStore: '',  // https://play.google.com/store/apps/...

  // İletişim / başvuru
  email: 'kariyer@turquz.app',
  whatsapp: '',   // örn '+905000000000' (boşsa gizlenir)

  social: { instagram: '', linkedin: '' },
  copyrightYear: 2026,
};
