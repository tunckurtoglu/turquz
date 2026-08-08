// i18n/LanguageContext.js
// Uygulama genelinde seçili dili tutar. Onboarding'de setLang ile ayarlanır,
// tüm wizard adımları ve CV motoru bu dili buradan okur.
import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANG, dirOf } from './languages';
import { t as translate } from './ui';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'turquz.lang';

export function LanguageProvider({ children, initialLang = DEFAULT_LANG }) {
  const [lang, setLangState] = useState(initialLang);

  // Açılışta son seçilen dili geri yükle.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => { if (v) setLangState(v); }).catch(() => {});
  }, []);

  // Dili değiştir + kalıcı kaydet (reset/yeniden açılışta korunur).
  const setLang = useCallback((l) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    lang,
    setLang,
    dir: dirOf(lang),
    // kısayol: t('next') -> seçili dilde arayüz metni; t('min_chars', {n:150})
    t: (key, vars) => translate(key, lang, vars),
  }), [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage, LanguageProvider içinde kullanılmalı');
  return ctx;
}
