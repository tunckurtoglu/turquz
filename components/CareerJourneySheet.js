// Aday kariyer yolculuğu — 7 adım dikey (tik / aktif / kilit) + belge detayı.
import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { journeyTitleKey, JOURNEY_COUNT } from '../lib/pipeline';

const NAVY = '#0e141c';
const GOLD = '#c2a25a';
const INK = '#1b2533';
const GREEN = '#2f8a5a';

function CheckMini({ color = '#fff', size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5 10 17.5 19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockMini({ color = 'rgba(231,220,196,0.42)', size = 13 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Rect x="6" y="11" width="12" height="10" rx="2" stroke={color} strokeWidth="2.2" />
    </Svg>
  );
}

function stepStatus(step, current, certified) {
  if (certified || step < current) return 'done';
  if (step === current) return 'active';
  return 'locked';
}

export default function CareerJourneySheet({
  visible, onClose, current = 1, certified = false, onOpenStep,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const n = current > 0 ? current : 1;
  const shown = certified ? JOURNEY_COUNT : n;

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headTitle}>{t('career_started')}</Text>
            <Text style={styles.headSub}>{t('journey_progress', { n: String(shown), m: String(JOURNEY_COUNT) })}</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {Array.from({ length: JOURNEY_COUNT }, (_, i) => i + 1).map((step) => {
            const status = stepStatus(step, n, certified);
            const last = step === JOURNEY_COUNT;
            const hintKey = step === 7
              ? (status === 'done' ? 'pipe_step_7_desc' : 'pipe_step_7_wait')
              : `journey_hint_${step}`;
            const openable = status !== 'locked';
            return (
              <View key={step} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[
                    styles.dot,
                    status === 'done' && styles.dotDone,
                    status === 'active' && styles.dotNow,
                    status === 'locked' && styles.dotLock,
                  ]}>
                    {status === 'done' ? <CheckMini /> : status === 'locked' ? (
                      <LockMini />
                    ) : (
                      <Text style={styles.dotNum}>{step}</Text>
                    )}
                  </View>
                  {!last ? (
                    <View style={[styles.railLine, (status === 'done' || status === 'active') && styles.railLineOn]} />
                  ) : null}
                </View>

                <View style={[
                  styles.card,
                  status === 'active' && styles.cardNow,
                  status === 'locked' && styles.cardLock,
                ]}>
                  <Text style={[styles.stepNo, status === 'locked' && styles.muted]}>
                    {t('step')} {step}
                  </Text>
                  <Text style={[styles.title, status === 'locked' && styles.titleLock]}>{t(journeyTitleKey(step))}</Text>
                  {status !== 'locked' ? (
                    <Text style={styles.hint}>{t(hintKey)}</Text>
                  ) : null}
                  {openable ? (
                    <TouchableOpacity
                      style={[styles.cta, status === 'done' && styles.ctaDone]}
                      onPress={() => onOpenStep?.(step)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.ctaText, status === 'done' && styles.ctaTextDone]}>{t('journey_details')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockRow}>
                      <LockMini size={12} />
                      <Text style={styles.lockText}>{t('journey_locked')}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12,
  },
  back: { color: '#e7dcc4', fontSize: 32, fontWeight: '400', marginTop: -4, width: 28 },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headSub: { color: GOLD, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.4 },
  body: { paddingHorizontal: 16, paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 12, minHeight: 88 },
  rail: { width: 34, alignItems: 'center' },
  dot: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.6, borderColor: 'rgba(231,220,196,0.22)',
    zIndex: 1,
  },
  dotDone: { backgroundColor: GREEN, borderColor: GREEN },
  dotNow: { backgroundColor: '#1b2533', borderWidth: 2.2, borderColor: GOLD },
  dotLock: { backgroundColor: 'transparent', borderColor: 'rgba(231,220,196,0.16)' },
  dotNum: { color: GOLD, fontSize: 14, fontWeight: '800' },
  railLine: {
    flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 4, marginBottom: 4,
  },
  railLineOn: { backgroundColor: GOLD },
  card: {
    flex: 1, backgroundColor: '#1b2533', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12,
  },
  cardNow: { borderWidth: 1.4, borderColor: GOLD },
  cardLock: { backgroundColor: 'rgba(27,37,51,0.55)' },
  stepNo: { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 21 },
  titleLock: { color: 'rgba(231,220,196,0.42)' },
  hint: { color: '#9aa4b1', fontSize: 13, fontWeight: '600', marginTop: 6, lineHeight: 18 },
  muted: { color: 'rgba(194,162,90,0.4)' },
  cta: {
    alignSelf: 'flex-start', marginTop: 12, backgroundColor: GOLD,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
  },
  ctaDone: { backgroundColor: 'transparent', borderWidth: 1.2, borderColor: 'rgba(194,162,90,0.55)' },
  ctaText: { color: INK, fontSize: 13, fontWeight: '800' },
  ctaTextDone: { color: GOLD },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  lockText: { color: 'rgba(231,220,196,0.38)', fontSize: 12.5, fontWeight: '700' },
});
