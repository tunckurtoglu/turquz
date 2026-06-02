// i18n/LanguageContext.js
// Uygulama genelinde seçili dili tutar. Onboarding'de setLang ile ayarlanır,
// tüm wizard adımları ve CV motoru bu dili buradan okur.
import React, { createContext, useContext, useState, useMemo } from 'react';
import { DEFAULT_LANG, dirOf } from './languages';
import { t as translate } from './ui';

const LanguageContext = createContext(null);

export function LanguageProvider({ children, initialLang = DEFAULT_LANG }) {
  const [lang, setLang] = useState(initialLang);

  const value = useMemo(() => ({
    lang,
    setLang,
    dir: dirOf(lang),
    // kısayol: t('next') -> seçili dilde arayüz metni; t('min_chars', {n:150})
    t: (key, vars) => translate(key, lang, vars),
  }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage, LanguageProvider içinde kullanılmalı');
  return ctx;
}
