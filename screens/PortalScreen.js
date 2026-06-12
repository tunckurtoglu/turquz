// screens/PortalScreen.js
// Açılış portalı: kullanıcı önce hangi tarafa gireceğini seçer (Aday / Acente / Otel).
// Seçince ilgili AuthScreen akışı açılır. Otel henüz yok -> "yakında".
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#c2a25a';
const TEAL = '#2a9db8';
const NAVY = '#1b2533';
const CARD = '#212d3e';

// --- Çizgi stilinde marka ikonları (logoyla uyumlu) ---
function PersonIcon({ color, size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth="1.8" />
      <Path d="M5 20v-1a7 7 0 0 1 14 0v1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
function BuildingIcon({ color, size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="3" width="16" height="18" rx="1.5" stroke={color} strokeWidth="1.8" />
      <Line x1="8" y1="7" x2="8" y2="7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="7" x2="12" y2="7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="7" x2="16" y2="7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="8" y1="11" x2="8" y2="11.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="11" x2="12" y2="11.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="11" x2="16" y2="11.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 21v-4h4v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function BedIcon({ color, size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 18v-5h18v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 13V7m18 6v6M3 18h18M3 19v1m18-1v1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 13v-2.5A1.5 1.5 0 0 1 7.5 9h9A1.5 1.5 0 0 1 18 10.5V13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevIcon({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PortalButton({ Icon, accent, label, desc, onPress, disabled, soonLabel }) {
  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: accent + '4d' }, disabled && styles.cardSoon]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <View style={[styles.badge, { backgroundColor: accent + '1f', borderColor: accent + '59' }]}>
        <Icon color={accent} />
      </View>
      <View style={styles.cardMid}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      {disabled ? (
        <View style={styles.soonBadge}><Text style={styles.soonText}>{soonLabel}</Text></View>
      ) : (
        <ChevIcon color={accent} />
      )}
    </TouchableOpacity>
  );
}

// Cinzel (logo fontu) sadece Latin alfabesini destekler. Latin dışı dillerde
// (Kiril/Tay/Fars) modern bold Inter'e düş; aksi halde karakterler kaybolur.
const LATIN_LANGS = new Set(['tr', 'en', 'de', 'uz', 'tk']);

export default function PortalScreen({ onSelect, fontsReady }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const sloganFontStyle = fontsReady ? (LATIN_LANGS.has(lang) ? styles.sloganFont : styles.sloganFontAlt) : null;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Image source={require('../assets/turquz-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.slogan, sloganFontStyle]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>– {t('portal_slogan')} –</Text>

        <View style={styles.divider} />

        <PortalButton
          Icon={PersonIcon}
          accent={GOLD}
          label={t('portal_candidate')}
          desc={t('portal_candidate_desc')}
          onPress={() => onSelect('candidate')}
        />
        <PortalButton
          Icon={BuildingIcon}
          accent={TEAL}
          label={t('auth_agency_login')}
          desc={t('portal_agency_desc')}
          onPress={() => onSelect('agency')}
        />
        <PortalButton
          Icon={BedIcon}
          accent="#8a93a0"
          label={t('portal_hotel')}
          desc={t('portal_hotel_desc')}
          disabled
          soonLabel={t('soon')}
          onPress={() => {}}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NAVY },
  scroll: { paddingHorizontal: 24, minHeight: '100%' },
  logo: { width: 240, height: 201, alignSelf: 'center', marginBottom: -10 },
  slogan: {
    color: '#b8923f', fontSize: 11.5, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5, marginBottom: 22, lineHeight: 17,
    textShadowColor: 'rgba(184,146,63,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  sloganFont: { fontFamily: 'Cinzel_700Bold', fontWeight: '400' },
  sloganFontAlt: { fontFamily: 'Inter_700Bold', fontWeight: '400' },

  divider: { height: 1, backgroundColor: '#ffffff14', marginBottom: 22, marginHorizontal: 8 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 14, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  cardSoon: { opacity: 0.55, shadowOpacity: 0 },
  badge: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: 15,
  },
  cardMid: { flex: 1 },
  cardLabel: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2 },
  cardDesc: { color: '#97a2b0', fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  soonBadge: { backgroundColor: '#ffffff14', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  soonText: { color: '#cbd2db', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
