// components/CountdownBanner.js — mülakat/boarding tarzı geri sayım kutusu
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { formatCountdown } from '../lib/interviews';

export default function CountdownBanner({ titleKey, subKey, leftMs, variant = 'note' }) {
  const { t } = useLanguage();
  if (!(leftMs > 0)) return null;
  const isMuted = variant === 'muted';
  return (
    <View style={isMuted ? styles.muted : styles.note}>
      <Text style={[styles.title, isMuted && styles.titleMuted]}>⏱ {t(titleKey)}: {formatCountdown(leftMs)}</Text>
      {subKey ? <Text style={[styles.sub, isMuted && styles.subMuted]}>{t(subKey)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(194,162,90,0.35)',
  },
  muted: {
    backgroundColor: '#f7f4ee',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#eadfc2',
  },
  title: { color: '#f0e6d0', fontSize: 14, fontWeight: '700' },
  titleMuted: { color: '#1b2533' },
  sub: { color: 'rgba(240,230,208,0.75)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  subMuted: { color: '#6b7280' },
});
