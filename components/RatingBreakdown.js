// components/RatingBreakdown.js — CV/detayda 3 kırılım ortalaması (diğer işverenlere açık)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import RatingBadge from './RatingBadge';

function Stars({ value }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <Text style={styles.stars}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </Text>
  );
}

export default function RatingBreakdown({ stats }) {
  const { t } = useLanguage();
  if (!stats?.count || !(stats.avg > 0)) return null;
  const rows = [
    { key: 'd', label: t('rate_discipline'), value: stats.discipline },
    { key: 'c', label: t('rate_communication'), value: stats.communication },
    { key: 'r', label: t('rate_rehire'), value: stats.rehire },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>{t('rate_breakdown_title')}</Text>
        <RatingBadge avg={stats.avg} count={stats.count} compact />
      </View>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{row.label}</Text>
          <Stars value={row.value} />
          <Text style={styles.num}>{Number(row.value || 0).toFixed(1)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#faf7f0',
    borderWidth: 1,
    borderColor: '#ebe4d5',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  headTitle: { fontSize: 13, fontWeight: '800', color: '#1b2533', flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ebe4d5',
  },
  label: { flex: 1, fontSize: 13, fontWeight: '700', color: '#3a4554' },
  stars: { color: '#c2a25a', fontSize: 13, letterSpacing: 1, fontWeight: '700' },
  num: { minWidth: 28, textAlign: 'right', fontSize: 13, fontWeight: '900', color: '#8a6a1f' },
});
