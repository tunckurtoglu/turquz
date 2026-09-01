// screens/PortalScreen.js
// Açılış portalı: kullanıcı önce hangi tarafa gireceğini seçer (Aday / Acente / Otel).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { HOTEL_PORTAL_ENABLED } from '../lib/features';
import TurquzLogo from '../components/TurquzLogo';

const GOLD_D = '#9a7b1f';
const TEAL = '#2a9db8';
const NAVY = '#1b2533';

function PersonIcon({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth="1.8" />
      <Path d="M5 20v-1a7 7 0 0 1 14 0v1" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
function BuildingIcon({ color, size = 24 }) {
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
function BedIcon({ color, size = 24 }) {
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
      style={[styles.card, disabled && styles.cardSoon]}
      onPress={onPress}
      activeOpacity={0.88}
      disabled={disabled}
    >
      <View style={[styles.badge, { backgroundColor: accent + '18' }]}>
        <Icon color={accent} />
      </View>
      <View style={styles.cardMid}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      {disabled ? (
        <View style={styles.soonBadge}><Text style={styles.soonText}>{soonLabel}</Text></View>
      ) : (
        <ChevIcon color="#9aa1ac" />
      )}
    </TouchableOpacity>
  );
}

const LATIN_LANGS = new Set(['tr', 'en', 'de', 'uz', 'tk']);

export default function PortalScreen({ onSelect, fontsReady }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const sloganFontStyle = fontsReady ? (LATIN_LANGS.has(lang) ? styles.sloganFont : styles.sloganFontAlt) : null;

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={['#101820', '#1b2533', '#2a3545']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <TurquzLogo width={200} height={168} style={styles.logo} fontFamily="Cinzel_600SemiBold" fontsReady />
        <Text style={[styles.slogan, sloganFontStyle]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
          {t('portal_slogan')}
        </Text>

        <View style={styles.sheet}>
          <PortalButton
            Icon={PersonIcon}
            accent={GOLD_D}
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
          {HOTEL_PORTAL_ENABLED ? (
            <PortalButton
              Icon={BedIcon}
              accent="#8a93a0"
              label={t('portal_hotel')}
              desc={t('portal_hotel_desc')}
              disabled
              soonLabel={t('soon')}
              onPress={() => {}}
            />
          ) : null}
        </View>

        <Text style={styles.trust}>{t('auth_trust')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NAVY },
  glowA: {
    position: 'absolute', top: -80, left: -60, width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(194,162,90,0.16)',
  },
  glowB: {
    position: 'absolute', bottom: 60, right: -90, width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(42,157,184,0.12)',
  },
  scroll: { paddingHorizontal: 22, flexGrow: 1 },
  logo: { width: 200, height: 168, alignSelf: 'center', marginBottom: 4 },
  slogan: {
    color: '#d4b978', fontSize: 11, fontWeight: '700', textAlign: 'center',
    letterSpacing: 1.4, marginBottom: 12, textTransform: 'uppercase',
  },
  sloganFont: { fontFamily: 'Cinzel_700Bold', fontWeight: '400' },
  sloganFontAlt: { fontFamily: 'Inter_700Bold', fontWeight: '400' },

  sheet: {
    marginTop: 18,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12,
    marginBottom: 6,
  },
  cardSoon: { opacity: 0.5 },
  badge: {
    width: 46, height: 46, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 13,
  },
  cardMid: { flex: 1 },
  cardLabel: { color: NAVY, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardDesc: { color: '#6b7280', fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  soonBadge: { backgroundColor: '#f0f2f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  soonText: { color: '#6b7280', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  trust: { color: 'rgba(231,220,196,0.72)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 20 },
});
