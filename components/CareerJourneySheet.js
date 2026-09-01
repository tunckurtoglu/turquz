// Aday kariyer yolculuğu — 9 adım dikey (tik / aktif / kilit) + belge detayı.
// Adım 7: belge yok; işe başlama tarihine kadar pasif, sonra sezon bitimine geri sayım.
// Adım 8 forum + 9 sertifika: şimdilik “Yakında” (pasif).
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { journeyTitleKey, JOURNEY_COUNT } from '../lib/pipeline';
import { formatCountdown } from '../lib/interviews';
import { isYmdDue, msUntilYmdGate, msUntilSeasonEnd } from '../lib/flights';

const NAVY = '#0e141c';
const GOLD = '#c2a25a';
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

function fmtYmd(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}.${m}.${y}`;
}

function stepStatus(step, current, { workStartReached, seasonComplete } = {}) {
  // Forum: yakında. Sertifika: kilitli/pasif (yakında rozeti yok).
  if (step === 8) return 'soon';
  if (step === 9) return 'locked';
  if (step === 7) {
    if (seasonComplete || current > 7) return 'done';
    if (current < 7) return 'locked';
    if (!workStartReached) return 'pending';
    return 'active';
  }
  if (current > JOURNEY_COUNT) return 'done';
  if (step < current) return 'done';
  if (step === current) return 'active';
  return 'locked';
}

function hintFor(step, status) {
  if (step === 8) return 'journey_hint_8';
  if (step === 9) return status === 'done' ? 'pipe_step_9_desc' : 'journey_hint_9';
  if (step === 7) {
    if (status === 'done') return 'journey_hint_7_done';
    return null;
  }
  return `journey_hint_${step}`;
}

export default function CareerJourneySheet({
  visible, onClose, current = 1, certified = false,
  workStartYmd = null, seasonEndAt = null, seasonComplete = false,
  onOpenStep,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const n = current > 0 ? current : 1;
  const shown = Math.min(n, JOURNEY_COUNT);
  const [nowTick, setNowTick] = useState(Date.now());

  const workStartReached = !workStartYmd || isYmdDue(workStartYmd, nowTick);
  const seasonDone = !!(seasonComplete || certified);

  useEffect(() => {
    if (!visible) return undefined;
    const needTick = n >= 7 && !seasonDone;
    if (!needTick) return undefined;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, n, seasonDone]);

  const startLeft = workStartYmd && !workStartReached ? msUntilYmdGate(workStartYmd, nowTick) : 0;
  const seasonLeft = workStartReached && !seasonDone ? msUntilSeasonEnd(seasonEndAt, nowTick) : 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>✕</Text>
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
            const status = stepStatus(step, n, { workStartReached, seasonComplete: seasonDone });
            const last = step === JOURNEY_COUNT;
            const hintKey = hintFor(step, status);
            const openable = (status === 'active' || status === 'done') && step !== 7 && step < 8 && !!onOpenStep;
            const showStep7Wait = step === 7 && status === 'pending';
            const showStep7Season = step === 7 && status === 'active';
            const isSoon = status === 'soon';
            const showHint = (status !== 'locked' && status !== 'pending') || isSoon || step === 9;
            return (
              <View key={step} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[
                    styles.dot,
                    status === 'done' && styles.dotDone,
                    status === 'active' && styles.dotNow,
                    (status === 'locked' || status === 'pending' || isSoon) && styles.dotLock,
                  ]}>
                    {status === 'done' ? <CheckMini /> : (status === 'locked' || status === 'pending' || isSoon) ? (
                      <LockMini />
                    ) : (
                      <Text style={styles.dotNum}>{step}</Text>
                    )}
                  </View>
                  {!last ? (
                    <View style={[styles.railLine, (status === 'done' || status === 'active' || status === 'pending') && styles.railLineOn]} />
                  ) : null}
                </View>

                <View style={[
                  styles.card,
                  status === 'active' && styles.cardNow,
                  status === 'pending' && styles.cardPending,
                  (status === 'locked' || isSoon) && styles.cardLock,
                ]}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.stepNo, (status === 'locked' || status === 'pending' || isSoon) && styles.muted]}>
                      {t('step')} {step}
                    </Text>
                    {isSoon ? (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonBadgeText}>{t('soon')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.title, (status === 'locked' || isSoon) && styles.titleLock]}>
                    {t(journeyTitleKey(step))}
                  </Text>
                  {step === 7 && (workStartYmd || seasonEndAt) && status !== 'locked' ? (
                    <View style={styles.dateBlock}>
                      {workStartYmd ? (
                        <Text style={styles.dateLine}>{t('work_start_label')}: {fmtYmd(workStartYmd)}</Text>
                      ) : null}
                      {seasonEndAt ? (
                        <Text style={styles.dateLine}>{t('season_end_label')}: {fmtYmd(seasonEndAt)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  {showHint && hintKey ? (
                    <Text style={styles.hint}>{t(hintKey)}</Text>
                  ) : null}
                  {showStep7Wait ? (
                    <>
                      <Text style={styles.hint}>{t('journey_hint_7_wait')}</Text>
                      {startLeft > 0 ? (
                        <View style={styles.cdBox}>
                          <Text style={styles.cdTitle}>⏱ {t('work_start_countdown_title')}: {formatCountdown(startLeft)}</Text>
                          <Text style={styles.cdSub}>{t('work_start_countdown_sub')}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                  {showStep7Season ? (
                    <View style={styles.cdBox}>
                      {seasonLeft > 0 ? (
                        <>
                          <Text style={styles.cdTitle}>⏱ {t('season_countdown_title')}: {formatCountdown(seasonLeft)}</Text>
                          <Text style={styles.cdSub}>{t('season_countdown_sub')}</Text>
                        </>
                      ) : (
                        <Text style={styles.cdSub}>{t('season_countdown_sub')}</Text>
                      )}
                    </View>
                  ) : null}
                  {openable ? (
                    <TouchableOpacity
                      style={styles.openBtn}
                      onPress={() => { onClose?.(); onOpenStep(step); }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.openBtnText}>{t('docs_title')}</Text>
                    </TouchableOpacity>
                  ) : null}
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
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  close: { color: 'rgba(255,255,255,0.7)', fontSize: 22, fontWeight: '700', width: 28 },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headSub: { color: 'rgba(231,220,196,0.65)', fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: 'row', minHeight: 88 },
  rail: { width: 36, alignItems: 'center' },
  dot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(194,162,90,0.35)',
  },
  dotDone: { backgroundColor: GREEN, borderColor: GREEN },
  dotNow: { backgroundColor: GOLD, borderColor: GOLD },
  dotLock: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
  dotNum: { color: NAVY, fontWeight: '900', fontSize: 12 },
  railLine: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
  railLineOn: { backgroundColor: 'rgba(194,162,90,0.45)' },
  card: {
    flex: 1, marginLeft: 10, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardNow: { borderColor: GOLD, backgroundColor: 'rgba(194,162,90,0.12)' },
  cardPending: { borderColor: 'rgba(194,162,90,0.28)', backgroundColor: 'rgba(255,255,255,0.05)' },
  cardLock: { opacity: 0.55 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  stepNo: { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  soonBadge: {
    backgroundColor: 'rgba(194,162,90,0.22)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.4)',
  },
  soonBadgeText: { color: GOLD, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  titleLock: { color: 'rgba(255,255,255,0.45)' },
  muted: { color: 'rgba(231,220,196,0.4)' },
  dateBlock: { marginTop: 8, gap: 3 },
  dateLine: { color: 'rgba(231,220,196,0.85)', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hint: { color: 'rgba(231,220,196,0.72)', fontSize: 13, lineHeight: 18, marginTop: 6, fontWeight: '500' },
  cdBox: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
  },
  cdTitle: { color: '#f0e6d0', fontSize: 14, fontWeight: '700' },
  cdSub: { color: 'rgba(240,230,208,0.75)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  openBtn: {
    alignSelf: 'flex-start', marginTop: 10, backgroundColor: GOLD, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  openBtnText: { color: NAVY, fontWeight: '800', fontSize: 13 },
});
