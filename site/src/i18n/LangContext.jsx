import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGS, DEFAULT_LANG, dirOf, resolveBrowserLang } from './languages';
import { CONTENT } from './content';

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => resolveBrowserLang());

  // <html lang/dir> güncelle + tercihi sakla.
  useEffect(() => {
    const dir = dirOf(lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
    try { localStorage.setItem('turquz.site.lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const value = useMemo(() => {
    // t(key): seçili dil -> İngilizce -> Türkçe -> anahtarın kendisi (zarif fallback).
    const t = (key) => {
      const row = CONTENT[key];
      if (!row) return key;
      return row[lang] ?? row.en ?? row[DEFAULT_LANG] ?? key;
    };
    return { lang, setLang: setLangState, t, dir: dirOf(lang), langs: LANGS };
  }, [lang]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
