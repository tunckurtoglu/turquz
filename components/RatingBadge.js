// components/RatingBadge.js — havuz kartında açık puan özeti
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RatingBadge({ avg, count, compact = false, onDark = false, float = false }) {
  if (!count) return null;
  const n = Number(avg);
  const shown = Number.isFinite(n) && n > 0 ? n.toFixed(1) : '—';
  const vivid = float || onDark;
  return (
    <View style={[
      styles.wrap,
      vivid ? styles.wrapVivid : null,
      !vivid && onDark ? styles.wrapDark : null,
      compact && styles.wrapCompact,
      float && styles.wrapFloat,
    ]}
    >
      <Text style={[styles.star, vivid && styles.starVivid]}>★</Text>
      <Text style={[styles.avg, vivid && styles.avgVivid]}>{shown}</Text>
      <Text style={[styles.count, vivid && styles.countVivid]}>({count})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f3ecdc', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, alignSelf: 'flex-start', marginTop: 4,
  },
  wrapDark: { backgroundColor: 'rgba(10,16,24,0.72)' },
  wrapVivid: {
    // Koyu cam: fotoğrafın üstünde okunur; şeffaf hissi kalır
    backgroundColor: 'rgba(10,16,24,0.62)',
    borderWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  wrapCompact: { marginTop: 3, paddingHorizontal: 6, paddingVertical: 2 },
  wrapFloat: {
    marginTop: 0, alignSelf: 'auto',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  star: { color: '#c2a25a', fontSize: 12, fontWeight: '900' },
  avg: { color: '#8a6a1f', fontSize: 12.5, fontWeight: '900' },
  count: { color: '#9a7b1f', fontSize: 10.5, fontWeight: '700' },
  starVivid: { color: '#f5c542', fontSize: 11.5 },
  avgVivid: { color: '#fff', fontSize: 12 },
  countVivid: { color: 'rgba(255,240,200,0.92)', fontSize: 10, fontWeight: '800' },
});
