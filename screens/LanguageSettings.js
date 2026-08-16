// screens/LanguageSettings.js
// Ayarlardan açılan STANDART dil seçimi. Onboarding'deki (dalgalanan bayrak + dropdown)
// gösterişli ekrandan farklı: sade, alt alta listelenen diller. Dokun = anında uygula.
import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGUAGES_ALPHA } from '../i18n/languages';
import { useLanguage } from '../i18n/LanguageContext';

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

export default function LanguageSettings({ onBack, fontsReady }) {
  const { lang, setLang, t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, fontsReady && styles.titleFont]}>{t('set_language')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {LANGUAGES_ALPHA.map((item, i) => {
          const active = item.code === lang;
          return (
            <TouchableOpacity
              key={item.code}
              style={[styles.row, i === 0 && styles.rowFirst, active && styles.rowActive]}
              onPress={() => setLang(item.code)}
              activeOpacity={0.7}
            >
              {FLAGS[item.code] ? <Image source={FLAGS[item.code]} style={styles.flag} resizeMode="cover" /> : null}
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{item.name}</Text>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec',
  },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: '#1b2533', fontWeight: '700', marginTop: -4 },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2533' },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  content: { padding: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  rowFirst: {},
  rowActive: { borderColor: '#c2a25a', borderWidth: 1.5, backgroundColor: '#faf6ec' },
  flag: { width: 30, height: 22, borderRadius: 4, marginRight: 14, backgroundColor: '#e9ebee' },
  rowLabel: { flex: 1, fontSize: 16, color: '#1b2533', fontWeight: '600' },
  rowLabelActive: { fontWeight: '800' },
  check: { fontSize: 18, color: '#c2a25a', fontWeight: '900', marginLeft: 8 },
});
