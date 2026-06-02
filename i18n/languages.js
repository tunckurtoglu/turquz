// i18n/languages.js
// Desteklenen diller. 'dir' yalnızca Farsça'da 'rtl', gerisi 'ltr'.
// 'code' her yerde anahtar olarak kullanılır (sözlükler, buildCvHtml, kayıt).
export const LANGUAGES_SUPPORTED = [
  { code: 'tr', name: 'Türkçe',    dir: 'ltr' },
  { code: 'en', name: 'English',   dir: 'ltr' },
  { code: 'ru', name: 'Русский',   dir: 'ltr' },
  { code: 'kk', name: 'Қазақша',   dir: 'ltr' },
  { code: 'de', name: 'Deutsch',   dir: 'ltr' },
  { code: 'th', name: 'ไทย',       dir: 'ltr' },
  { code: 'uz', name: 'Oʻzbekcha', dir: 'ltr' },
  { code: 'fa', name: 'فارسی',     dir: 'rtl' },
];

export const DEFAULT_LANG = 'tr';

export const LANG_CODES = LANGUAGES_SUPPORTED.map((l) => l.code);

export const dirOf = (code) =>
  (LANGUAGES_SUPPORTED.find((l) => l.code === code)?.dir) || 'ltr';

export const nameOf = (code) =>
  (LANGUAGES_SUPPORTED.find((l) => l.code === code)?.name) || code;
