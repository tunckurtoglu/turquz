// screens/LanguageSelect.js
// Onboarding: kullanıcı kendi dilini seçer. Seçilen dilin bayrağı arka planda
// şeffaf olarak belirir ve hafifçe dalgalanır (Animated ile salınım/scale/skew).
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import { LANGUAGES_SUPPORTED } from '../i18n/languages';
import { useLanguage } from '../i18n/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Dil kodu -> bayrak görseli
const FLAGS = {
  tr: require('../assets/flags/tr.png'),
  en: require('../assets/flags/en.png'),
  ru: require('../assets/flags/ru.png'),
  kk: require('../assets/flags/kk.png'),
  ky: require('../assets/flags/ky.png'),
  uz: require('../assets/flags/uz.png'),
  tk: require('../assets/flags/tk.png'),
  de: require('../assets/flags/de.png'),
  th: require('../assets/flags/th.png'),
  fa: require('../assets/flags/fa.png'),
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Arka planda dalgalanan bayrak katmanı
function WavingFlag({ code }) {
  const wave = useRef(new Animated.Value(0)).current;   // sürekli salınım 0..1
  const fade = useRef(new Animated.Value(1)).current;   // dil değişince yumuşak geçiş (1=görünür)
  const [shown, setShown] = useState(code);
  const fadeAnim = useRef(null);                        // çalışan fade animasyonu referansı

  // Sürekli dalgalanma döngüsü
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [wave]);

  // Dil değişince: kısa fade-out -> bayrağı değiştir -> fade-in.
  // Önceki animasyon varsa durdurulur (kuyruk tıkanması/takılma önlenir).
  useEffect(() => {
    if (code === shown) return; // aynı bayraksa dokunma
    if (fadeAnim.current) fadeAnim.current.stop();

    const out = Animated.timing(fade, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true });
    fadeAnim.current = out;
    out.start(({ finished }) => {
      if (!finished) return;          // durdurulduysa (yeni geçiş geldi) bekle
      setShown(code);                 // bayrağı değiştir
      const inn = Animated.timing(fade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true });
      fadeAnim.current = inn;
      inn.start();
    });
  }, [code, shown, fade]);

  if (!shown || !FLAGS[shown]) return null;

  // Dalgalanma: bayrak 90° döndürülmüş (dikey). Döndürülmüş eksende kayma/salınım.
  const translateX = wave.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const translateY = wave.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });
  const scale = wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.08, 1.14, 1.08] });
  const opacity = fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.46] }); // 0.46 = en parlak

  return (
    <Animated.Image
      source={FLAGS[shown]}
      resizeMode="cover"
      style={[
        styles.flag,
        { opacity, transform: [{ rotate: '90deg' }, { translateX }, { translateY }, { scale }] },
      ]}
    />
  );
}

export default function LanguageSelect({ onDone }) {
  const { lang, setLang, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selected = LANGUAGES_SUPPORTED.find((l) => l.code === lang) || LANGUAGES_SUPPORTED[0];

  return (
    <View style={styles.root}>
      {/* Arka plan: dalgalanan bayrak */}
      <WavingFlag code={lang} />
      {/* Karartma katmanı (metin okunurluğu için) */}
      <View style={styles.scrim} pointerEvents="none" />

      <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>{t('choose_language')}</Text>

        {/* Açılır-kapanır dil menüsü */}
        <View style={styles.dropdownWrap}>
          <TouchableOpacity
            style={[styles.ddHeader, open && styles.ddHeaderOpen]}
            onPress={() => setOpen((o) => !o)}
            activeOpacity={0.8}
          >
            <Text style={styles.ddHeaderText}>{selected.name}</Text>
            <Text style={styles.ddChevron}>{open ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {open && (
            <View style={styles.ddList}>
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                {LANGUAGES_SUPPORTED.map((item, i) => {
                  const active = item.code === lang;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      style={[
                        styles.ddItem,
                        i > 0 && styles.ddItemBorder,
                        active && styles.ddItemActive,
                      ]}
                      onPress={() => { setLang(item.code); setOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ddItemText, active && styles.ddItemTextActive]}>{item.name}</Text>
                      {active ? <Text style={styles.check}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.cta} onPress={onDone}>
          <Text style={styles.ctaText}>{t('continue_btn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b2533' },
  flag: {
    position: 'absolute',
    // 90° döndürüleceği için boyutlar takas: genişlik=ekran yüksekliği, yükseklik=ekran genişliği.
    // 0.96 -> motifler tam görünür ama dalgalanırken kenar boşluğu açığa çıkmaz.
    width: SCREEN_H * 0.96,
    height: SCREEN_W * 0.96,
    // Döndürme merkez etrafında döner; görseli ekran ortasına yerleştir.
    top: SCREEN_H / 2 - (SCREEN_W * 0.96) / 2,
    left: SCREEN_W / 2 - (SCREEN_H * 0.96) / 2,
  },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,37,51,0.40)' },
  wrap: { flex: 1, paddingHorizontal: 24 },
  title: { color: '#fff', fontSize: 19, fontWeight: '700', textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 26 },
  // Dropdown
  dropdownWrap: { marginBottom: 8 },
  ddHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(32,43,59,0.92)', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 2, borderColor: '#c2a25a',
  },
  ddHeaderOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  ddHeaderText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ddChevron: { color: '#c2a25a', fontSize: 14, fontWeight: '900' },
  ddList: {
    backgroundColor: 'rgba(24,33,46,0.98)', borderWidth: 1, borderTopWidth: 0, borderColor: '#2c3a4d',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden',
  },
  ddItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 18,
  },
  ddItemBorder: { borderTopWidth: 0.5, borderTopColor: '#2c3a4d' },
  ddItemActive: { backgroundColor: 'rgba(194,162,90,0.14)' },
  ddItemText: { color: '#dfe3e9', fontSize: 16, fontWeight: '600' },
  ddItemTextActive: { color: '#fff', fontWeight: '800' },
  check: { color: '#c2a25a', fontSize: 18, fontWeight: '900' },
  cta: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaText: { color: '#1b2533', fontSize: 16, fontWeight: '800' },
});
