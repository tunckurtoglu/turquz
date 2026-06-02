// screens/WelcomeScreen.js
// Karşılama: başlık el yazısı (Latin dillerde) + kelime kelime zarif beliriş animasyonu.
// Geri -> dil seçimine döner. İçerik dikey ortada. TURQUZ başlığı yok.
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

// El yazısı (Dancing Script) yalnızca Latin alfabeli dillerde şık durur.
// Kiril (ru, kk), Tayca (th), Farsça (fa) için serif'e düşülür.
const SCRIPT_LANGS = ['tr', 'en', 'de', 'uz'];

// Kelimeleri sırayla yumuşakça belirten bileşen
function FadeInWords({ text, style, startDelay = 0, stagger = 120, align = 'left' }) {
  const words = (text || '').split(' ');
  const anims = useRef(words.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const seq = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 480,
        delay: startDelay + i * stagger,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, seq).start();
    return () => anims.forEach((a) => a.stopAnimation());
  }, [text]);

  return (
    <View style={[styles.wordsWrap, { justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }]}>
      {words.map((w, i) => (
        <Animated.Text
          key={i}
          style={[
            style,
            {
              opacity: anims[i],
              transform: [{ translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          {w + (i < words.length - 1 ? ' ' : '')}
        </Animated.Text>
      ))}
    </View>
  );
}

export default function WelcomeScreen({ onStart, onBack, fontsReady }) {
  const { t, dir, lang } = useLanguage();
  const align = dir === 'rtl' ? 'right' : 'left';

  const title = t('intro_title');
  const body = t('intro_body');

  const useScript = fontsReady && SCRIPT_LANGS.includes(lang);
  const titleFont = useScript
    ? styles.titleScript
    : (fontsReady ? styles.titleSerif : null);
  const bodyFont = fontsReady ? styles.bodyFont : null;

  const bodyDelay = 300 + title.split(' ').length * 120 + 300;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      {/* Üst: belirgin geri butonu */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backText}>{t('back')}</Text>
      </TouchableOpacity>

      {/* Orta: animasyonlu metin */}
      <View style={styles.center}>
        <FadeInWords text={title} style={[styles.title, titleFont]} startDelay={300} stagger={120} align={align} />
        <View style={[styles.accent, align === 'right' && { alignSelf: 'flex-end' }]} />
        <FadeInWords text={body} style={[styles.body, bodyFont]} startDelay={bodyDelay} stagger={55} align={align} />
      </View>

      {/* Alt: devam */}
      <TouchableOpacity style={styles.cta} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{t('next')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1b2533', paddingHorizontal: 28 },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: '#202b3b', borderWidth: 1, borderColor: '#2c3a4e',
  },
  backChevron: { color: '#c2a25a', fontSize: 22, fontWeight: '800', marginRight: 4, marginTop: -2 },
  backText: { color: '#f3f3f3', fontSize: 16, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center' },
  wordsWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  title: { color: '#ffffff', fontSize: 40, fontWeight: '800', lineHeight: 52 },
  titleScript: { fontFamily: 'DancingScript_700Bold', fontWeight: '400', fontSize: 52, lineHeight: 64 },
  titleSerif: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  accent: { width: 64, height: 3, backgroundColor: '#c2a25a', borderRadius: 2, marginVertical: 22 },

  body: { color: '#aeb6c2', fontSize: 18, lineHeight: 28 },
  bodyFont: { fontFamily: 'Inter_400Regular' },

  cta: { backgroundColor: '#c2a25a', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#1b2533', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});
