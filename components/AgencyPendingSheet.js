// Bekleyen işlemler — kariyer yolculuğu gibi dikkat çekici özet panel.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PENDING_ACTIONS, urgentTotal, pickFocusFilter } from '../lib/opsUi';
import { useLanguage } from '../i18n/LanguageContext';
import { C } from '../lib/theme';

const NAVY = '#0e141c';
const GOLD = '#c2a25a';
const HOT = '#b42318';

function PulseDot({ active, light = false }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      anim.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);
  if (!active) return <View style={[styles.dotIdle, light && lightStyles.dotIdle]} />;
  return <Animated.View style={[styles.dotHot, { opacity: anim }]} />;
}

export default function AgencyPendingSheet({
  visible, onClose, metrics = {}, onPick, light = false,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const urgent = urgentTotal(metrics);
  const topFilter = pickFocusFilter(metrics);
  const rows = PENDING_ACTIONS.map((a) => ({
    ...a,
    count: Number(metrics[a.key]) || 0,
  }));
  const active = rows.filter((r) => r.count > 0);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, light && lightStyles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle={light ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, light && lightStyles.header]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.back, light && lightStyles.back]}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headTitle, light && lightStyles.headTitle]}>{t('ops_pending_title')}</Text>
            <Text style={[styles.headSub, light && lightStyles.headSub]}>
              {urgent > 0
                ? t('ops_pending_urgent', { n: String(urgent) })
                : active.length
                  ? t('ops_pending_some', { n: String(active.length) })
                  : t('ops_pending_none')}
            </Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {active.length === 0 ? (
            <View style={[styles.emptyCard, light && lightStyles.emptyCard]}>
              <Text style={[styles.emptyTitle, light && lightStyles.emptyTitle]}>{t('ops_all_good')}</Text>
              <Text style={[styles.emptyHint, light && lightStyles.emptyHint]}>{t('ops_all_good_hint')}</Text>
            </View>
          ) : null}

          {active.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[
                styles.card,
                light && lightStyles.card,
                a.urgent && (light ? lightStyles.cardUrgent : styles.cardUrgent),
                a.filter === topFilter && (light ? lightStyles.cardFocus : styles.cardFocus),
              ]}
              onPress={() => onPick?.(a)}
              activeOpacity={0.88}
            >
              <View style={styles.cardTop}>
                <PulseDot active={a.filter === topFilter} light={light} />
                <Text style={[styles.count, light && lightStyles.count]}>{a.count}</Text>
                {a.filter === topFilter ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{t('ops_first_this')}</Text></View>
                ) : null}
              </View>
              <Text style={[styles.title, light && lightStyles.title]}>{t(a.titleKey)}</Text>
              <Text style={[styles.hint, light && lightStyles.hint]}>{t(a.hintKey)}</Text>
              <View style={[styles.cta, light && lightStyles.cta]}>
                <Text style={[styles.ctaText, light && lightStyles.ctaText]}>{t('ops_focus_cta')}</Text>
              </View>
            </TouchableOpacity>
          ))}

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
  headTitle: { fontSize: 20, fontWeight: '800', color: '#f5ecda', letterSpacing: -0.2 },
  headSub: { marginTop: 2, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.55)' },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },
  card: {
    backgroundColor: 'rgba(245,236,218,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(231,220,196,0.12)',
  },
  cardUrgent: {
    borderColor: 'rgba(180,35,24,0.45)',
    backgroundColor: 'rgba(180,35,24,0.12)',
  },
  cardFocus: {
    borderColor: 'rgba(194,162,90,0.55)',
  },
  cardIdle: { opacity: 0.45 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  badge: { marginLeft: 4, backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', color: NAVY, letterSpacing: 0.3, textTransform: 'uppercase' },
  dotHot: { width: 10, height: 10, borderRadius: 5, backgroundColor: HOT },
  dotIdle: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(231,220,196,0.35)' },
  count: { fontSize: 28, fontWeight: '800', color: '#f5ecda', letterSpacing: -0.5 },
  countIdle: { fontSize: 22, fontWeight: '800', color: 'rgba(231,220,196,0.4)' },
  title: { fontSize: 17, fontWeight: '800', color: '#f5ecda' },
  titleIdle: { fontSize: 15, fontWeight: '700', color: 'rgba(231,220,196,0.55)' },
  hint: { marginTop: 4, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.55)', lineHeight: 18 },
  hintIdle: { marginTop: 4, fontSize: 12, fontWeight: '600', color: 'rgba(231,220,196,0.35)', lineHeight: 17 },
  cta: {
    alignSelf: 'flex-start', marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: GOLD,
  },
  ctaText: { fontSize: 13, fontWeight: '800', color: NAVY },
  section: {
    marginTop: 10, marginBottom: 2, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(231,220,196,0.4)',
  },
  emptyCard: {
    padding: 20, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(231,220,196,0.2)', marginBottom: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#f5ecda', textAlign: 'center' },
  emptyHint: { marginTop: 6, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.5)', lineHeight: 19, textAlign: 'center' },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { backgroundColor: C.card, borderBottomColor: C.hair },
  back: { color: C.goldText },
  headTitle: { color: C.ink },
  headSub: { color: C.ink2 },
  card: { backgroundColor: C.card, borderColor: C.hair },
  cardUrgent: { borderColor: 'rgba(181,65,58,0.42)', backgroundColor: C.dangerSoft },
  cardFocus: { borderColor: 'rgba(194,162,90,0.65)' },
  count: { color: C.ink },
  dotIdle: { backgroundColor: C.muted },
  title: { color: C.ink },
  hint: { color: C.ink2 },
  cta: { backgroundColor: C.gold },
  ctaText: { color: C.ink },
  section: { color: C.ink2 },
  emptyCard: { borderColor: C.hair, backgroundColor: C.cardAlt },
  emptyTitle: { color: C.ink },
  emptyHint: { color: C.ink2 },
  countIdle: { color: C.muted },
  titleIdle: { color: C.ink2 },
  hintIdle: { color: C.muted },
});
