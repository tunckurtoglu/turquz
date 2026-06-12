// components/InterviewModal.js
// Mülakat randevusu (Faz 1). Kural: acente 3 FARKLI gün, her güne 3 saat (sabah/öğle/ikindi) tanımlar;
// aday bunlardan birini seçer. role='agency' planlar, role='candidate' seçer. Slot: "dd.mm.yyyy hh:mm".
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { Select } from './Select';
import { DAYS, monthOptions, FLIGHT_YEARS, IV_MORNING, IV_NOON, IV_EVENING } from '../cv/options';
import { getInterview, proposeInterview, selectSlot, cancelInterview, slotLabel, weekdayOf, weekdayOfParts, toISO, fromISO, slotDateKey, slotTime, agencyTakenSlots, getSlotAvailability } from '../lib/interviews';
import { notifyInterview, scheduleInterviewReminders, cancelInterviewReminders } from '../lib/push';
import { supabase } from '../lib/supabase';
import { callWindow } from '../lib/livekitCall';
// Görüntülü görüşme ekranı yalnızca AÇILINCA yüklenir (native LiveKit modülü Expo Go'da
// uygulamayı kırmasın diye lazy). Gerçek/dev build'de görüşme açıldığında devreye girer.
const InterviewCall = React.lazy(() => import('../screens/InterviewCall'));

const INK = '#1b2533';
const GOLD = '#c2a25a';

const emptyDay = () => ({ d: '', m: '', y: '', t0: '', t1: '', t2: '' });
const dayDate = (g) => `${g.d}.${g.m}.${g.y}`;
const dayFull = (g) => g.d && g.m && g.y && g.t0 && g.t1 && g.t2;

// Mevcut slotları (UTC ISO) 3 günlük yerel yapıya çöz (yeniden planlama için).
function slotsToDays(slots) {
  const byDate = {};
  (slots || []).forEach((iso) => {
    const p = fromISO(iso); if (!p) return;
    const key = `${p.d}.${p.m}.${p.y}`;
    (byDate[key] = byDate[key] || []).push(p.hhmm);
  });
  const days = Object.keys(byDate).slice(0, 3).map((date) => {
    const [d, m, y] = date.split('.');
    const tt = byDate[date];
    return {
      d, m, y,
      t0: tt.find((x) => IV_MORNING.includes(x)) || '',
      t1: tt.find((x) => IV_NOON.includes(x)) || '',
      t2: tt.find((x) => IV_EVENING.includes(x)) || '',
    };
  });
  return days.length ? days : [emptyDay()];
}

export default function InterviewModal({ visible, onClose, role, userId, agencyId, fontsReady, candidateLabel }) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const isAgency = role === 'agency';

  const [iv, setIv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState([emptyDay()]);
  const [replan, setReplan] = useState(false);
  const [taken, setTaken] = useState(new Set()); // acentede DOLU (3 kişi seçmiş) slotlar
  const [avail, setAvail] = useState({});        // aday: slot -> kaç aday seçti
  const [callOpen, setCallOpen] = useState(false); // görüntülü görüşme açık mı
  const joinPulse = useRef(new Animated.Value(1)).current;

  const remPrefix = isAgency ? `ivrem-ag-${userId}` : 'ivrem-cand';
  const remTexts = () => ({ title: t('rem_title'), '24h': t('rem_24h'), '1h': t('rem_1h'), '10m': t('rem_10m') });

  const load = useCallback(async () => {
    const row = await getInterview(userId);
    setIv(row);
    setDays(row?.status === 'proposed' ? slotsToDays(row.slots) : [emptyDay()]);
    if (isAgency) setTaken(await agencyTakenSlots(agencyId));
    else if (row?.status === 'proposed') setAvail(await getSlotAvailability());
    // Planlanmış mülakat için cihazda 24sa/1sa/10dk hatırlatma kur (idempotent); değilse temizle.
    if (row?.status === 'scheduled' && row.selectedSlot) scheduleInterviewReminders(row.selectedSlot, remPrefix, remTexts());
    else cancelInterviewReminders(remPrefix);
    setLoading(false);
  }, [userId, isAgency, agencyId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (visible) { setLoading(true); setReplan(false); load(); } }, [visible, load]);

  // "Görüşmeye Katıl" dikkat çeksin: planlandıysa yanıp sönsün.
  useEffect(() => {
    if (iv?.status === 'scheduled' && !callOpen) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(joinPulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
        Animated.timing(joinPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    joinPulse.setValue(1);
    return undefined;
  }, [iv?.status, callOpen, joinPulse]);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    const ch = supabase
      .channel(`iv-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visible, userId, load]);

  const updateDay = (i, key, v) => setDays((p) => p.map((g, idx) => (idx === i ? { ...g, [key]: v } : g)));
  const addDay = () => setDays((p) => (p.length < 3 ? [...p, emptyDay()] : p));
  const removeDay = (i) => setDays((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const distinctDates = new Set(days.filter(dayFull).map(dayDate));
  const ruleOk = days.every(dayFull) && distinctDates.size === 3;

  // Bir gün için, başka adaylarda dolu olan saatleri seçeneklerden çıkar.
  const freeOpts = (base, g) => {
    if (!(g.d && g.m && g.y)) return base;
    return base.filter((tm) => !taken.has(toISO(g.d, g.m, g.y, tm)));
  };

  const sendSlots = async () => {
    if (!ruleOk) { Alert.alert(t('iv_propose_title'), t('iv_rule_hint')); return; }
    const slots = days.flatMap((g) => [g.t0, g.t1, g.t2].map((tm) => toISO(g.d, g.m, g.y, tm))).sort();
    if (slots.some((s) => taken.has(s))) { Alert.alert(t('iv_propose_title'), t('iv_conflict')); return; }
    setBusy(true);
    try {
      await proposeInterview(userId, slots, agencyId);
      notifyInterview(userId, 'proposed');
      setReplan(false);
      await load();
    } catch (e) { Alert.alert(t('iv_propose_title'), e?.message || 'error'); }
    finally { setBusy(false); }
  };

  const pick = (slot) => {
    Alert.alert(t('iv_title'), slotLabel(slot, lang), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('iv_scheduled'), onPress: async () => {
          setBusy(true);
          try {
            const r = await selectSlot(userId, slot);
            if (r === 'full') { setAvail(await getSlotAvailability()); Alert.alert(t('iv_title'), t('iv_slot_full')); return; }
            notifyInterview(userId, 'scheduled');
            await load();
          } catch (e) { Alert.alert(t('iv_title'), e?.message || 'error'); }
          finally { setBusy(false); }
        } },
    ]);
  };

  const doCancel = () => {
    Alert.alert(t('iv_cancel'), `${t('iv_cancel')}?`, [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('iv_cancel'), style: 'destructive', onPress: async () => {
          setBusy(true);
          try { await cancelInterview(userId); cancelInterviewReminders(remPrefix); await load(); } finally { setBusy(false); }
        } },
    ]);
  };

  const status = iv?.status;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={[styles.title, fontsReady && styles.titleFont]}>{t('iv_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />
          ) : status === 'scheduled' ? (
            <>
              <View style={styles.schedCard}>
                <View style={styles.schedAccent} />
                <View style={styles.schedBadge}><Text style={styles.schedCheck}>✓</Text></View>
                <Text style={styles.schedKicker}>{t('iv_scheduled')}</Text>
                <Text style={styles.schedDay}>{weekdayOf(iv.selectedSlot, lang)}</Text>
                <Text style={styles.schedDate}>{slotDateKey(iv.selectedSlot)}</Text>
                <View style={styles.schedTimePill}><Text style={styles.schedTimeText}>🕒 {slotTime(iv.selectedSlot)}</Text></View>
                <Text style={styles.schedTz}>🌍 {t('iv_localtime')}</Text>
              </View>
              {callWindow(iv.selectedSlot).joinable ? (
                <Animated.View style={{ opacity: joinPulse }}>
                  <TouchableOpacity style={styles.joinBtn} onPress={() => setCallOpen(true)} activeOpacity={0.9}>
                    <Text style={styles.joinText}>🎥 {t('call_join')}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
              {isAgency ? (
                <>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => { setReplan(true); setIv({ ...iv, status: 'proposed' }); }} activeOpacity={0.85}>
                    <Text style={styles.ghostText}>{t('iv_replan')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.schedCancel} onPress={doCancel} activeOpacity={0.85}>
                    <Text style={styles.schedCancelText}>{t('iv_cancel')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.congratsBox}>
                  <View style={styles.congratsIconWrap}><Text style={styles.congratsIcon}>🎉</Text></View>
                  <Text style={styles.congratsTitle}>{t('iv_congrats_title')}</Text>
                  <Text style={styles.congratsText}>{t('iv_congrats')}</Text>
                </View>
              )}
            </>
          ) : isAgency ? (
            <>
              {status === 'proposed' && !replan ? (
                <View style={styles.waitBox}>
                  <Text style={styles.waitText}>⏳ {t('iv_waiting_candidate')}</Text>
                  <View style={styles.slotWrap}>
                    {iv.slots.map((s) => <View key={s} style={styles.slotChip}><Text style={styles.slotChipText}>{slotLabel(s, lang)}</Text></View>)}
                  </View>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => setReplan(true)} activeOpacity={0.85}>
                    <Text style={styles.ghostText}>{t('iv_replan')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={doCancel} activeOpacity={0.85}>
                    <Text style={styles.cancelBtnText}>{t('iv_cancel')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.hintBox}>
                    <Text style={styles.hintRule}>{t('iv_rule_hint')}</Text>
                    <Text style={styles.hintTz}>👥 {t('iv_multi_note')}</Text>
                    <Text style={styles.hintTz}>🌍 {t('iv_agency_tz')}</Text>
                  </View>

                  {/* 3 gün ilerleme göstergesi */}
                  <View style={styles.steps}>
                    {[0, 1, 2].map((i) => {
                      const st = i < days.length ? (dayFull(days[i]) ? 'done' : 'active') : 'todo';
                      return (
                        <React.Fragment key={i}>
                          <View style={[styles.stepDot, st === 'done' && styles.stepDone, st === 'active' && styles.stepActive]}>
                            <Text style={[styles.stepDotText, st === 'active' && styles.stepDotTextOn, st === 'done' && styles.stepDotTextDone]}>{st === 'done' ? '✓' : i + 1}</Text>
                          </View>
                          {i < 2 ? <View style={styles.stepLine} /> : null}
                        </React.Fragment>
                      );
                    })}
                  </View>

                  {days.map((g, i) => (
                    <View key={i} style={styles.dayCard}>
                      <View style={styles.dayHead}>
                        <View style={styles.dayNo}><Text style={styles.dayNoText}>{i + 1}</Text></View>
                        <Text style={styles.dayTitle}>{t('iv_day')} {i + 1}</Text>
                        <View style={{ flex: 1 }} />
                        {g.d && g.m && g.y ? <Text style={styles.dayWeek}>{weekdayOfParts(g.d, g.m, g.y, lang)}</Text> : null}
                        {days.length > 1 ? (
                          <TouchableOpacity onPress={() => removeDay(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.dayRemove}>
                            <Text style={styles.dayRemoveText}>✕</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <Text style={styles.groupLbl}>{t('iv_date_label')}</Text>
                      <View style={styles.row}>
                        <View style={styles.col}><Select label={t('f_day')} value={g.d} options={DAYS} onChange={(v) => updateDay(i, 'd', v)} /></View>
                        <View style={styles.col}><Select label={t('f_month')} value={g.m} options={monthOptions(lang)} onChange={(v) => updateDay(i, 'm', v)} /></View>
                        <View style={styles.col}><Select label={t('f_year')} value={g.y} options={FLIGHT_YEARS} onChange={(v) => updateDay(i, 'y', v)} /></View>
                      </View>
                      <View style={styles.divider} />
                      <Text style={styles.groupLbl}>{t('iv_times_label')}</Text>
                      <Select label={t('iv_morning')} value={g.t0} options={freeOpts(IV_MORNING, g)} onChange={(v) => updateDay(i, 't0', v)} />
                      <Select label={t('iv_noon')} value={g.t1} options={freeOpts(IV_NOON, g)} onChange={(v) => updateDay(i, 't1', v)} />
                      <Select label={t('iv_evening')} value={g.t2} options={freeOpts(IV_EVENING, g)} onChange={(v) => updateDay(i, 't2', v)} />
                    </View>
                  ))}

                  {days.length < 3 ? (
                    <TouchableOpacity style={styles.addDay} onPress={addDay} activeOpacity={0.85}>
                      <Text style={styles.addDayText}>+ {t('iv_add_day')} ({days.length}/3)</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity style={[styles.sendBtn, (busy || !ruleOk) && { opacity: 0.5 }]} onPress={sendSlots} disabled={busy || !ruleOk} activeOpacity={0.9}>
                    {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.sendText}>{t('iv_send')}</Text>}
                  </TouchableOpacity>
                </>
              )}
              {iv && replan ? (
                <TouchableOpacity style={styles.cancelLink} onPress={doCancel} activeOpacity={0.8}>
                  <Text style={styles.cancelLinkText}>{t('iv_cancel')}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : status === 'proposed' ? (
            // Aday: güne göre gruplanmış slotları seç
            <>
              <Text style={styles.pickHint}>{t('iv_pick_hint')}</Text>
              <Text style={styles.tzNote}>🌍 {t('iv_localtime')}</Text>
              {Object.entries((iv.slots || []).reduce((acc, s) => { const dk = slotDateKey(s); (acc[dk] = acc[dk] || []).push(s); return acc; }, {})).map(([date, ss]) => (
                <View key={date} style={styles.pickGroup}>
                  <Text style={styles.pickDay}>{weekdayOf(ss[0], lang)} · {date}</Text>
                  {ss.slice().sort().map((s) => {
                    const cnt = avail[s] || 0;
                    const full = cnt >= 3;
                    return (
                      <TouchableOpacity key={s} style={[styles.pickSlot, full && styles.pickSlotFull]} onPress={() => pick(s)} disabled={busy || full} activeOpacity={0.85}>
                        <Text style={[styles.pickSlotText, full && styles.pickSlotTextFull]}>🕒 {slotTime(s)}</Text>
                        {full ? (
                          <Text style={styles.pickFullTag}>{t('iv_slot_full_tag')}</Text>
                        ) : (
                          <Text style={styles.pickChev}>{dir === 'rtl' ? '‹' : '›'}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.none}>{t('iv_none')}</Text>
          )}
        </ScrollView>
      </View>
      {callOpen ? (
        <Suspense fallback={null}>
          <InterviewCall visible={callOpen} candidateUserId={userId} candidateLabel={candidateLabel} onClose={() => setCallOpen(false)} />
        </Suspense>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 18, fontWeight: '800', color: INK },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  accent: { height: 2.5, backgroundColor: GOLD },

  content: { padding: 16 },

  hintBox: { backgroundColor: '#faf7ef', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 18 },
  hintRule: { fontSize: 13, color: '#5a5341', lineHeight: 19, fontWeight: '600' },
  hintTz: { fontSize: 12, color: '#9a7b1f', lineHeight: 18, marginTop: 8, fontWeight: '700' },

  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#d6dae0', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepActive: { borderColor: GOLD, backgroundColor: '#faf2e0' },
  stepDone: { borderColor: GOLD, backgroundColor: GOLD },
  stepDotText: { fontSize: 13, fontWeight: '800', color: '#9aa1ac' },
  stepDotTextOn: { color: '#9a7b1f' },
  stepDotTextDone: { color: INK },
  stepLine: { width: 34, height: 2, backgroundColor: '#e1e4e9' },

  dayCard: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#1b2533', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  groupLbl: { fontSize: 11, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#f0f1f3', marginVertical: 14 },
  dayNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  dayNoText: { color: INK, fontWeight: '800', fontSize: 13 },
  dayTitle: { fontSize: 14, fontWeight: '800', color: INK },
  dayWeek: { fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  dayRemove: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  dayRemoveText: { color: '#a32d2d', fontSize: 13, fontWeight: '800' },
  addDay: { borderWidth: 1, borderColor: GOLD, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 6 },
  addDayText: { color: '#9a7b1f', fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },

  sendBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  sendText: { color: INK, fontWeight: '800', fontSize: 15 },

  waitBox: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec', borderRadius: 12, padding: 16 },
  waitText: { color: '#9a6b16', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { backgroundColor: '#f6efdd', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  slotChipText: { color: '#9a7b1f', fontWeight: '800', fontSize: 12.5 },
  ghostBtn: { backgroundColor: '#e7eaef', borderWidth: 1, borderColor: '#c5ccd6', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  ghostText: { color: INK, fontWeight: '800', fontSize: 14 },
  cancelBtn: { backgroundColor: '#fbeaea', borderWidth: 1, borderColor: '#e8b5b0', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },
  schedCancel: { paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  schedCancelText: { color: '#e8806f', fontWeight: '700', fontSize: 13 },

  schedCard: {
    backgroundColor: '#1b2533', borderRadius: 18, paddingTop: 30, paddingBottom: 26, paddingHorizontal: 22, alignItems: 'center',
    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  schedAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: GOLD },
  schedBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  schedCheck: { color: '#1b2533', fontSize: 32, fontWeight: '900', marginTop: -2 },
  schedKicker: { color: GOLD, fontSize: 11.5, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 14 },
  schedDay: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
  schedDate: { color: '#9aa4b1', fontSize: 15, fontWeight: '600', marginTop: 4 },
  schedTimePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.5)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9, marginTop: 16 },
  schedTimeText: { color: GOLD, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  schedTz: { color: '#6f7b8a', fontSize: 11.5, fontWeight: '700', marginTop: 16 },
  joinBtn: { backgroundColor: '#1f8a4c', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14, shadowColor: '#1f8a4c', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  joinText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  congratsBox: {
    marginTop: 14, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center',
    borderWidth: 1, borderColor: '#eadfc2', shadowColor: '#1b2533', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  congratsIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#faf2e0', borderWidth: 1, borderColor: '#eadfc2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  congratsIcon: { fontSize: 26 },
  congratsTitle: { fontSize: 17, fontWeight: '800', color: '#9a7b1f', marginBottom: 8, letterSpacing: 0.3 },
  congratsText: { color: '#5a5341', fontSize: 13, fontWeight: '600', lineHeight: 20, textAlign: 'center' },

  pickHint: { fontSize: 13.5, color: '#6b6457', lineHeight: 19, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12, marginBottom: 10 },
  tzNote: { fontSize: 12, color: '#1f7d96', fontWeight: '700', marginBottom: 14 },
  pickGroup: { marginBottom: 14 },
  pickDay: { fontSize: 13, fontWeight: '800', color: '#9a7b1f', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  pickSlot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, marginBottom: 8 },
  pickSlotFull: { backgroundColor: '#f1f2f4', borderColor: '#e0e2e6' },
  pickSlotText: { fontSize: 16, fontWeight: '800', color: INK },
  pickSlotTextFull: { color: '#9aa1ac' },
  pickFullTag: { fontSize: 12, fontWeight: '800', color: '#a32d2d' },
  pickChev: { fontSize: 22, color: GOLD, fontWeight: '800' },

  cancelLink: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  cancelLinkText: { color: '#a32d2d', fontWeight: '700', fontSize: 13.5 },
  none: { textAlign: 'center', color: '#9aa1ac', fontSize: 15, marginTop: 40 },
});
