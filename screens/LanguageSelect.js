// screens/LanguageSelect.js
// Onboarding: kullanıcı kendi dilini seçer. Seçim LanguageContext'e yazılır,
// böylece tüm wizard ve CV o dilde açılır. (Backend gelince kullanıcı profiline kaydedilir.)
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { LANGUAGES_SUPPORTED } from '../i18n/languages';
import { useLanguage } from '../i18n/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LanguageSelect({ onDone }) {
  const { lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.brand}>TURQUZ</Text>
      <Text style={styles.title}>Dilini seç · Choose your language</Text>

      <FlatList
        data={LANGUAGES_SUPPORTED}
        keyExtractor={(l) => l.code}
        style={styles.list}
        renderItem={({ item }) => {
          const active = item.code === lang;
          return (
            <TouchableOpacity
              style={[styles.row, active && styles.rowActive]}
              onPress={() => setLang(item.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.name}</Text>
              {active ? <Text style={styles.check}>✓</Text> : null}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.cta} onPress={onDone}>
        <Text style={styles.ctaText}>Devam · Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#1b2533', paddingHorizontal: 24 },
  brand: { color: '#c2a25a', fontSize: 26, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  title: { color: '#aeb6c2', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#202b3b', borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18,
    marginBottom: 10, borderWidth: 2, borderColor: 'transparent',
  },
  rowActive: { borderColor: '#c2a25a' },
  rowText: { color: '#f3f3f3', fontSize: 17, fontWeight: '600' },
  rowTextActive: { color: '#fff', fontWeight: '800' },
  check: { color: '#c2a25a', fontSize: 18, fontWeight: '900' },
  cta: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaText: { color: '#1b2533', fontSize: 16, fontWeight: '800' },
});
