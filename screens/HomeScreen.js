// screens/HomeScreen.js
// Ana sayfa: aktif CV kartı + ileriki modüller için "Yakında" kartları.
// Modüller geldikçe (duyuru, asistan, mülakat, video) aynı kart deseniyle eklenecek.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { nameOf } from '../i18n/languages';

// Yer tutucu (Yakında) modül kartı
function SoonCard({ icon, title, soonLabel }) {
  return (
    <View style={[styles.card, styles.cardSoon]}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitleSoon}>{title}</Text>
        <View style={styles.soonBadge}><Text style={styles.soonText}>{soonLabel}</Text></View>
      </View>
    </View>
  );
}

export default function HomeScreen({ data, onEdit, onNew, fontsReady }) {
  const { t, dir, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const align = dir === 'rtl' ? 'right' : 'left';
  const name = (data && data.firstName) ? data.firstName : '';

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        {/* Selam */}
        <Text style={[styles.greeting, { textAlign: align }, fontsReady && styles.greetingFont]}>
          {t('home_greeting')}{name ? `, ${name}` : ''}
        </Text>
        <Text style={[styles.subtitle, { textAlign: align }]}>{t('home_cv_ready')}</Text>

        {/* Aktif CV kartı */}
        <TouchableOpacity style={[styles.card, styles.cardActive]} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.cardIcon}>📄</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{t('home_cv_card')}</Text>
            <View style={styles.langBadge}><Text style={styles.langText}>{nameOf(lang)}</Text></View>
          </View>
          <Text style={styles.chev}>{dir === 'rtl' ? '‹' : '›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.85}>
          <Text style={styles.editBtnText}>{t('home_edit')}</Text>
        </TouchableOpacity>

        {/* İleriki modüller — Yakında */}
        <SoonCard icon="📢" title={t('home_announcements')} soonLabel={t('soon')} />
        <SoonCard icon="💬" title={t('home_assistant')} soonLabel={t('soon')} />
        <SoonCard icon="🎥" title={t('home_interviews')} soonLabel={t('soon')} />

        {/* Yeni CV */}
        <TouchableOpacity style={styles.newBtn} onPress={onNew} activeOpacity={0.7}>
          <Text style={styles.newBtnText}>+ {t('home_new')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  content: { paddingHorizontal: 20 },

  greeting: { fontSize: 28, fontWeight: '800', color: '#1b2533' },
  greetingFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  subtitle: { fontSize: 15, color: '#737373', marginTop: 4, marginBottom: 22 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e6e8ec',
  },
  cardActive: { borderColor: '#c2a25a', borderWidth: 2 },
  cardSoon: { opacity: 0.75 },
  cardIcon: { fontSize: 26, marginRight: 14 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#1b2533' },
  cardTitleSoon: { fontSize: 17, fontWeight: '700', color: '#9aa1ac' },
  chev: { fontSize: 26, color: '#c2a25a', fontWeight: '800' },

  langBadge: { alignSelf: 'flex-start', backgroundColor: '#f7f4ec', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  langText: { fontSize: 12, fontWeight: '700', color: '#8a6d2f' },

  soonBadge: { alignSelf: 'flex-start', backgroundColor: '#eef0f2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  soonText: { fontSize: 12, fontWeight: '700', color: '#9aa1ac' },

  editBtn: { backgroundColor: '#1b2533', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 24 },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  newBtn: {
    borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
  },
  newBtnText: { color: '#c2a25a', fontSize: 15, fontWeight: '800' },
});
