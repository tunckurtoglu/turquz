// screens/ThankYouScreen.js
// Form bittikten sonra gösterilen kapanış. "Gönder" backend gelince CV'yi kaydeder.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

export default function ThankYouScreen({ onSubmit, onBack, fontsReady }) {
  const { t, dir, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const align = dir === 'rtl' ? 'right' : 'left';
  const SCRIPT_LANGS = ['tr', 'en', 'de', 'uz'];
  const useScript = fontsReady && SCRIPT_LANGS.includes(lang);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        <Text style={styles.mark}>✓</Text>
        <Text style={[styles.title, { textAlign: align }, useScript ? styles.titleScript : (fontsReady && styles.titleFont)]}>
          {t('outro_title')}
        </Text>
        <View style={styles.accent} />
        <Text style={[styles.body, { textAlign: align }, fontsReady && styles.bodyFont]}>
          {t('outro_body')}
        </Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={onSubmit} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{t('done')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.ghost} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.ghostText}>{t('back')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1b2533', paddingHorizontal: 28 },
  center: { flex: 1, justifyContent: 'center' },
  mark: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#c2a25a', color: '#1b2533',
    fontSize: 34, fontWeight: '900', textAlign: 'center', lineHeight: 64, marginBottom: 26, overflow: 'hidden',
  },
  title: { color: '#ffffff', fontSize: 36, fontWeight: '800', lineHeight: 44 },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  titleScript: { fontFamily: 'DancingScript_700Bold', fontWeight: '400', fontSize: 48, lineHeight: 60 },
  accent: { width: 64, height: 3, backgroundColor: '#c2a25a', borderRadius: 2, marginVertical: 22 },
  body: { color: '#aeb6c2', fontSize: 18, lineHeight: 28 },
  bodyFont: { fontFamily: 'Inter_400Regular' },
  cta: { backgroundColor: '#c2a25a', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  ctaText: { color: '#1b2533', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  ghost: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ghostText: { color: '#aeb6c2', fontSize: 15, fontWeight: '600' },
});
