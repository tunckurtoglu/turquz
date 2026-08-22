// components/EmployerStampListSheet.js
// Ayarlar: işletme listesi → her birine kaşe kaydet.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers } from '../lib/employers';
import StampSetupSheet from './StampSetupSheet';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function EmployerStampListSheet({ visible, agencyId, onClose }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stampEmp, setStampEmp] = useState(null);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try { setRows(await listEmployers(agencyId)); }
    finally { setLoading(false); }
  }, [agencyId]);

  useEffect(() => {
    if (visible) refresh();
    else setStampEmp(null);
  }, [visible, refresh]);

  return (
    <>
      <Modal visible={visible && !stampEmp} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.back}>{backChevron}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('stamp_menu')}</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.accent} />
          <Text style={styles.sub}>{t('stamp_list_hint')}</Text>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}>
              {rows.map((e) => (
                <TouchableOpacity key={e.id} style={styles.card} onPress={() => setStampEmp(e)} activeOpacity={0.85}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{e.name}</Text>
                    {e.title ? <Text style={styles.sub2} numberOfLines={1}>{e.title}</Text> : null}
                  </View>
                  <Text style={[styles.badge, e.hasStamp ? styles.badgeOn : styles.badgeOff]}>
                    {e.hasStamp ? t('stamp_ready') : t('stamp_missing')}
                  </Text>
                </TouchableOpacity>
              ))}
              {rows.length === 0 ? <Text style={styles.empty}>{t('employer_pick_empty')}</Text> : null}
            </ScrollView>
          )}
        </View>
      </Modal>

      <StampSetupSheet
        visible={!!stampEmp}
        agencyId={agencyId}
        employer={stampEmp}
        onClose={() => setStampEmp(null)}
        onSaved={() => { setStampEmp(null); refresh(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#fff' },
  back: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  sub: { fontSize: 13.5, color: '#737373', lineHeight: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e6e8ec', padding: 14,
  },
  name: { fontSize: 15, fontWeight: '800', color: INK },
  sub2: { fontSize: 12, color: '#737373', marginTop: 3 },
  badge: { fontSize: 11.5, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  badgeOn: { backgroundColor: 'rgba(31,138,76,0.12)', color: '#1a5c2a' },
  badgeOff: { backgroundColor: '#f3ecdc', color: '#9a7b1f' },
  empty: { textAlign: 'center', color: '#9aa1ac', marginTop: 24 },
});
