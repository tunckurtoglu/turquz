// Web i18n — mobil uygulamayla AYNI sözlük (kök i18n/ui.js). t(key, lang, vars).
import { createContext, useContext, useState } from 'react';
import { t as translate } from '../../i18n/ui';
import { LANGUAGES_SUPPORTED } from '../../i18n/languages';

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem('turquz_lang') || 'tr');
  // Anahtar sözlükte yoksa translate, anahtarın kendisini döndürür; o durumda '' ver ki
  // ekranlardaki `t('x') || 'Türkçe yedek'` devreye girsin (panel henüz tüm anahtarları içermiyor).
  const t = (key, vars) => { const v = translate(key, lang, vars); return v === key ? '' : v; };
  const setLang = (l) => { localStorage.setItem('turquz_lang', l); setLangState(l); };
  return <LangCtx.Provider value={{ t, lang, setLang, languages: LANGUAGES_SUPPORTED }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);
