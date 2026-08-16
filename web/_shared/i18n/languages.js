// i18n/languages.js
// Desteklenen diller. 'dir' yalnızca Farsça'da 'rtl', gerisi 'ltr'.
// 'code' her yerde anahtar olarak kullanılır (sözlükler, buildCvHtml, kayıt).
export const LANGUAGES_SUPPORTED = [
  // En üstte İngilizce (uluslararası ortak dil)
  { code: 'en', name: 'English',   dir: 'ltr' },
  // Türkçe ve Türk devletleri (bir grup)
  { code: 'tr', name: 'Türkçe',    dir: 'ltr' },
  { code: 'kk', name: 'Қазақша',   dir: 'ltr' },
  { code: 'ky', name: 'Кыргызча',  dir: 'ltr' },
  { code: 'uz', name: 'Oʻzbekcha', dir: 'ltr' },
  { code: 'tk', name: 'Türkmençe', dir: 'ltr' },
  // Diğer diller
  { code: 'ru', name: 'Русский',   dir: 'ltr' },
  { code: 'de', name: 'Deutsch',   dir: 'ltr' },
  { code: 'th', name: 'ไทย',       dir: 'ltr' },
  { code: 'fa', name: 'فارسی',     dir: 'rtl' },
];

/** Ayarlar / dil menüsü: görünen ada göre A→Z. */
export const LANGUAGES_ALPHA = [...LANGUAGES_SUPPORTED].sort((a, b) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
);

export const DEFAULT_LANG = 'tr';

// Cihaz dili desteklenmiyorsa buna düşülür (en yaygın ortak dil).
export const FALLBACK_LANG = 'en';

export const LANG_CODES = LANGUAGES_SUPPORTED.map((l) => l.code);

// Cihazın dil kodunu (örn. 'ru-RU', 'tr', 'en-US') desteklenen 8 dilden birine eşle.
// Desteklenmiyorsa İngilizce'ye düş. Büyük/küçük harf ve bölge ekini yok sayar.
export function resolveDeviceLang(deviceCode) {
  if (!deviceCode) return FALLBACK_LANG;
  const base = String(deviceCode).toLowerCase().split(/[-_]/)[0]; // 'ru-RU' -> 'ru'
  // Bazı yaygın eşlemeler: Tacikçe/Dari Farsça'ya yakın sayılabilir ama güvenli davranıp
  // yalnızca birebir kodları kabul ediyoruz.
  return LANG_CODES.includes(base) ? base : FALLBACK_LANG;
}

export const dirOf = (code) =>
  (LANGUAGES_SUPPORTED.find((l) => l.code === code)?.dir) || 'ltr';

export const nameOf = (code) =>
  (LANGUAGES_SUPPORTED.find((l) => l.code === code)?.name) || code;

/** Dil-duyarlı büyük harf (TR: i→İ, ı→I). CSS textTransform bunu yapmaz. */
const UPPER_LOCALE = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', ru: 'ru-RU',
  kk: 'kk-KZ', ky: 'ky-KG', uz: 'uz-UZ', tk: 'tk-TM',
  th: 'th-TH', fa: 'fa-IR',
};
export function localeUpper(str, lang = 'tr') {
  const s = String(str ?? '');
  if (!s) return s;
  const loc = UPPER_LOCALE[lang] || lang || 'en-US';
  try { return s.toLocaleUpperCase(loc); }
  catch { return s.toUpperCase(); }
}
