// Acente hatırlatıcıları — Bugün acil grupları (footer).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { loadAgencyOps } from '../lib/ops';
import { PENDING_ACTIONS, urgentTotal } from '../lib/opsUi';
import { C } from '../lib/theme';

const NAVY = '#000b18';
const GOLD = '#c2a25a';
const HOT = '#b42318';

function StopwatchIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13.2" r="7.2" stroke={color} strokeWidth="1.8" />
      <Path d="M12 13.2V9.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 3.6h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 3.6v2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M17.6 7.2l1.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export default function AgencyRemindersSheet({ visible, onClose, agencyId, onPick, light = false }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [metrics, setMetrics] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      const d = await loadAgencyOps(agencyId);
      setMetrics(d?.metrics || {});
    } catch {
      setMetrics({});
    } finally {
      setBusy(false);
    }
  }, [agencyId]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const rows = PENDING_ACTIONS
    .map((a) => ({ ...a, count: Number(metrics[a.key]) || 0 }))
    .filter((a) => a.count > 0);
  const urgent = urgentTotal(metrics);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, light && lightStyles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle={light ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, light && lightStyles.header]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.back, light && lightStyles.back]}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headTitle, light && lightStyles.headTitle]}>{t('home_remind_short')}</Text>
            <Text style={[styles.headSub, light && lightStyles.headSub]}>
              {urgent > 0
                ? t('ops_pending_urgent', { n: String(urgent) })
                : t('ops_pending_none')}
            </Text>
          </View>
          <StopwatchIcon color={light ? C.goldText : GOLD} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, light && lightStyles.body, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {busy && !rows.length ? (
            <ActivityIndicator color={light ? C.goldText : GOLD} style={{ marginTop: 40 }} />
          ) : rows.length === 0 ? (
            <View style={[styles.empty, light && lightStyles.empty]}>
              <Text style={[styles.emptyTitle, light && lightStyles.emptyTitle]}>{t('ops_all_good')}</Text>
              <Text style={[styles.emptyHint, light && lightStyles.emptyHint]}>{t('ops_all_good_hint')}</Text>
            </View>
          ) : (
            rows.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={[styles.card, light && lightStyles.card, a.urgent && styles.cardUrgent]}
                onPress={() => {
                  onClose?.();
                  onPick?.(a);
                }}
                activeOpacity={0.88}
              >
                <Text style={[styles.count, light && lightStyles.count]}>{a.count}</Text>
                <Text style={[styles.title, light && lightStyles.title]}>{t(a.titleKey)}</Text>
                <Text style={[styles.hint, light && lightStyles.hint]}>{t(a.hintKey)}</Text>
                <View style={styles.cta}>
                  <Text style={[styles.ctaText, light && lightStyles.ctaText]}>{t('ops_focus_cta')}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(231,220,196,0.12)',
  },
  back: { fontSize: 32, color: GOLD, fontWeight: '300', lineHeight: 34, width: 28 },
  headTitle: { fontSize: 20, fontWeight: '800', color: '#f5ecda' },
  headSub: { marginTop: 2, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.55)' },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },
  card: {
    backgroundColor: 'rgba(245,236,218,0.06)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(231,220,196,0.12)',
  },
  cardUrgent: { borderColor: 'rgba(180,35,24,0.45)', backgroundColor: 'rgba(180,35,24,0.12)' },
  count: { fontSize: 28, fontWeight: '800', color: '#f5ecda' },
  title: { marginTop: 4, fontSize: 17, fontWeight: '800', color: '#f5ecda' },
  hint: { marginTop: 4, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.55)', lineHeight: 18 },
  cta: {
    alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: GOLD,
  },
  ctaText: { fontSize: 13, fontWeight: '800', color: NAVY },
  empty: {
    padding: 20, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(231,220,196,0.2)',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#f5ecda' },
  emptyHint: { marginTop: 6, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.5)', lineHeight: 19 },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { borderBottomColor: C.hair },
  back: { color: C.goldText },
  headTitle: { color: C.ink },
  headSub: { color: C.ink2 },
  body: { backgroundColor: C.bg },
  card: { backgroundColor: C.card, borderColor: C.hair },
  count: { color: C.ink },
  title: { color: C.ink },
  hint: { color: C.ink2 },
  ctaText: { color: '#f7f2e8' },
  empty: { borderColor: C.hair },
  emptyTitle: { color: C.ink },
  emptyHint: { color: C.ink2 },
});
