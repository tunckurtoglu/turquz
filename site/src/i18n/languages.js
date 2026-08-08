// Desteklenen 10 dil — ana uygulamayla (i18n/languages.js) birebir aynı.
export const LANGS = [
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ru', name: 'Русский', dir: 'ltr' },
  { code: 'kk', name: 'Қазақша', dir: 'ltr' },
  { code: 'ky', name: 'Кыргызча', dir: 'ltr' },
  { code: 'uz', name: 'Oʻzbekcha', dir: 'ltr' },
  { code: 'tk', name: 'Türkmençe', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'th', name: 'ไทย', dir: 'ltr' },
  { code: 'fa', name: 'فارسی', dir: 'rtl' },
];

export const DEFAULT_LANG = 'tr';

export function dirOf(code) {
  return LANGS.find((l) => l.code === code)?.dir || 'ltr';
}

export function nameOf(code) {
  return LANGS.find((l) => l.code === code)?.name || code;
}

// Tarayıcı dilini desteklenen dile eşle (yoksa İngilizce).
export function resolveBrowserLang() {
  try {
    const stored = localStorage.getItem('turquz.site.lang');
    if (stored && LANGS.some((l) => l.code === stored)) return stored;
    const nav = (navigator.languages || [navigator.language || 'en'])
      .map((l) => String(l).slice(0, 2).toLowerCase());
    for (const code of nav) {
      if (LANGS.some((l) => l.code === code)) return code;
    }
  } catch {
    /* ignore */
  }
  return 'en';
}
