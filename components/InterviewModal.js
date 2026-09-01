// components/InterviewModal.js
// Mülakat: acente TEK gün + 3 dilimde serbest saat önerir; aday birini seçer.
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { Select } from './Select';
import TimeWheelSheet from './TimeWheelSheet';
import { DAYS, monthOptions, FLIGHT_YEARS, ivBandIndex, ivBandOpen, ivEarliestInBand } from '../cv/options';
import {
  getInterview, proposeInterview, selectSlot, cancelInterview, candidateDeclineInterview, markInterviewDone, slotLabel, weekdayOf, weekdayOfParts,
  toISO, fromISO, slotDateKey, slotTime, slotMs, formatCountdown, agencyBusySlots, agencyScheduledCounts,
  getSlotAvailability, slotConflictKind, conflictNeighborLabels,
} from '../lib/interviews';
import { notifyInterview, scheduleInterviewReminders, cancelInterviewReminders, checkInterviewReminders } from '../lib/push';
import { supabase } from '../lib/supabase';
import { callWindow, getCallWindowOpts } from '../lib/livekitCall';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const InterviewCall = React.lazy(() => import('../screens/InterviewCall'));

const INK = '#1b2533';
const GOLD = '#c2a25a';
const BAND_KEYS = ['t0', 't1', 't2'];
const BAND_LABELS = ['iv_morning', 'iv_noon', 'iv_evening'];

const emptyForm = () => ({ d: '', m: '', y: '', t0: '', t1: '', t2: '' });
const openBandsOf = (g, nowMs = Date.now()) => {
  if (!(g.d && g.m && g.y)) return [0, 1, 2];
  return [0, 1, 2].filter((bi) => ivBandOpen(g.d, g.m, g.y, bi, nowMs));
};
const formReady = (g, nowMs = Date.now()) => {
  if (!(g.d && g.m && g.y)) return false;
  const open = openBandsOf(g, nowMs);
  if (!open.length) return false;
  return open.every((bi) => !!g[BAND_KEYS[bi]]);
};

// Mevcut slotları tek gün + 3 dilime çöz (yeniden planlama / eski 9-slot kayıtlar).
function slotsToForm(slots) {
  const parsed = (slots || []).map(fromISO).filter(Boolean);
  if (!parsed.length) return emptyForm();
  const { d, m, y } = parsed[0];
  const sameDay = parsed.filter((p) => p.d === d && p.m === m && p.y === y);
  const times = sameDay.map((p) => p.hhmm);
  const pick = (band) => times.find((tm) => ivBandIndex(tm) === band) || '';
  return { d, m, y, t0: pick(0), t1: pick(1), t2: pick(2) };
}

export default function InterviewModal({ visible, onClose, role, userId, agencyId, employerId, fontsReady, candidateLabel, autoJoin }) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const isAgency = role === 'agency';

  const [iv, setIv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [replan, setReplan] = useState(false);
  const [busySlots, setBusySlots] = useState([]); // diğer adayların teklif/seçim slotları
  const [schedCounts, setSchedCounts] = useState({});
  const [avail, setAvail] = useState({});        // aday: slot -> kaç aday seçti
  const [wheelBand, setWheelBand] = useState(null); // 0|1|2 saat tekerleği
  const [callOpen, setCallOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const joinPulse = useRef(new Animated.Value(1)).current;
  const autoJoinedRef = useRef(false);

  const remPrefix = isAgency ? `ivrem-ag-${userId}` : 'ivrem-cand';
  const remTexts = () => ({ title: t('rem_title'), '24h': t('rem_24h'), '15m': t('rem_15m'), '5m': t('rem_5m') });

  const [callOpts, setCallOpts] = useState({ minutes: 10, extraSecs: 0 });

  const load = useCallback(async () => {
    let row = await getInterview(userId);
    let opts = { minutes: 10, extraSecs: 0 };
    if (row?.status === 'scheduled' && row.selectedSlot) {
      opts = await getCallWindowOpts(row);
      setCallOpts(opts);
    } else {
      setCallOpts(opts);
    }
    // Süre + uzatma + grace bittiyse scheduled'ı kapat — acente yeniden planlayabilsin.
    if (row?.status === 'scheduled' && row.selectedSlot && callWindow(row.selectedSlot, opts).ended) {
      try { await markInterviewDone(userId); } catch (e) { /* yoksay */ }
      cancelInterviewReminders(remPrefix);
      row = await getInterview(userId);
    }
    setIv(row);
    setForm(row?.status === 'proposed' ? slotsToForm(row.slots) : emptyForm());
    if (isAgency) {
      const [busyList, counts] = await Promise.all([agencyBusySlots(agencyId, userId), agencyScheduledCounts(agencyId)]);
      setBusySlots(busyList);
      setSchedCounts(counts);
    } else if (row?.status === 'proposed') setAvail(await getSlotAvailability());
    if (row?.status === 'scheduled' && row.selectedSlot) {
      scheduleInterviewReminders(row.selectedSlot, remPrefix, remTexts());
      checkInterviewReminders(userId);
    } else cancelInterviewReminders(remPrefix);
    setLoading(false);
  }, [userId, isAgency, agencyId, employerId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible) { setLoading(true); setReplan(false); autoJoinedRef.current = false; load(); }
    else setCallOpen(false);
  }, [visible, load]);

  useEffect(() => {
    if (!visible || iv?.status !== 'scheduled' || !iv?.selectedSlot) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, iv?.status, iv?.selectedSlot]);

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

  // Acente şeridinden "Katıl" ile açıldıysa pencere uygunsa otomatik bağlan.
  useEffect(() => {
    if (!visible || loading || !autoJoin || autoJoinedRef.current || callOpen) return;
    if (iv?.status === 'scheduled' && iv.selectedSlot && callWindow(iv.selectedSlot, callOpts).joinable) {
      autoJoinedRef.current = true;
      if (IS_EXPO_GO) {
        Alert.alert(t('call_error'), 'Expo Go’da görüntülü görüşme yok. Development build kullanın.');
        return;
      }
      setCallOpen(true);
    }
  }, [visible, loading, autoJoin, iv, callOpen, t]);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    const ch = supabase
      .channel(`iv-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visible, userId, load]);

  const updateForm = (key, v) => setForm((p) => {
    const next = { ...p, [key]: v };
    // Gün değişince geçmiş dilim saatlerini temizle.
    if (key === 'd' || key === 'm' || key === 'y') {
      [0, 1, 2].forEach((bi) => {
        if (!ivBandOpen(next.d, next.m, next.y, bi)) next[BAND_KEYS[bi]] = '';
      });
    }
    return next;
  });

  // Dilim kilitleri saniyelik değil; gün seçimine + "şimdi"ye bağlı (ekran açıkken tazele).
  const [bandTick, setBandTick] = useState(Date.now());
  useEffect(() => {
    if (!visible || !isAgency) return undefined;
    const id = setInterval(() => setBandTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [visible, isAgency]);
  useEffect(() => {
    if (!form.d || !form.m || !form.y) return;
    setForm((p) => {
      let changed = false;
      const next = { ...p };
      [0, 1, 2].forEach((bi) => {
        if (!ivBandOpen(p.d, p.m, p.y, bi, bandTick) && next[BAND_KEYS[bi]]) {
          next[BAND_KEYS[bi]] = '';
          changed = true;
        }
      });
      return changed ? next : p;
    });
  }, [bandTick, form.d, form.m, form.y]);

  const openBands = openBandsOf(form, bandTick);
  const ruleOk = formReady(form, bandTick);

  const doPropose = async (slots) => {
    setBusy(true);
    try {
      await proposeInterview(userId, slots, agencyId, employerId);
      notifyInterview(userId, 'proposed');
      setReplan(false);
      await load();
    } catch (e) {
      const msg = String(e?.message || e || '');
      Alert.alert(
        t('iv_propose_title'),
        msg.includes('candidate_passive') ? t('iv_candidate_passive')
          : msg.includes('favorite_required') ? (t('offer_fav_required_body') || 'Adayı önce bir otel favorisine ekleyin.')
            : msg.includes('employer_incomplete') ? (t('employer_need_details') || 'Otel bilgilerini tamamlayın.')
              : (msg || 'error'),
      );
    }
    finally { setBusy(false); }
  };

  const sendSlots = async () => {
    if (!(form.d && form.m && form.y)) { Alert.alert(t('iv_propose_title'), t('iv_rule_hint')); return; }
    if (!openBands.length) { Alert.alert(t('iv_propose_title'), t('iv_past_slot')); return; }
    const times = openBands.map((bi) => form[BAND_KEYS[bi]]).filter(Boolean);
    if (times.length !== openBands.length) { Alert.alert(t('iv_propose_title'), t('iv_need_one_slot')); return; }
    if (new Set(times).size !== times.length) { Alert.alert(t('iv_propose_title'), t('iv_rule_hint')); return; }
    const slots = times.map((tm) => toISO(form.d, form.m, form.y, tm)).sort();
    if (slots.some((s) => !(slotMs(s) > Date.now() + 60 * 1000))) {
      Alert.alert(t('iv_propose_title'), t('iv_past_slot'));
      return;
    }

    for (const s of slots) {
      const kind = slotConflictKind(s, busySlots);
      if (kind === 'near') {
        const n = conflictNeighborLabels(s, busySlots, lang);
        const msg = t('iv_near_conflict')
          .replace('{conflict}', n?.conflict || '')
          .replace('{later}', n?.later || '')
          .replace('{earlier}', n?.earlier || '');
        Alert.alert(t('iv_propose_title'), msg);
        return;
      }
      if (kind === 'exact' && (schedCounts[s] || 0) >= 3) {
        Alert.alert(t('iv_propose_title'), t('iv_slot_full'));
        return;
      }
    }

    const exacts = slots.filter((s) => slotConflictKind(s, busySlots) === 'exact');
    if (exacts.length) {
      Alert.alert(t('iv_propose_title'), t('iv_group_warn'), [
        { text: t('consent_cancel'), style: 'cancel' },
        { text: t('iv_send'), onPress: () => doPropose(slots) },
      ]);
      return;
    }
    await doPropose(slots);
  };

  const doDecline = () => {
    Alert.alert(t('iv_decline'), t('iv_decline_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('iv_decline'), style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            const agencyIdForPush = iv?.createdBy || null;
            await candidateDeclineInterview();
            notifyInterview(userId, 'declined', agencyIdForPush);
            cancelInterviewReminders(remPrefix);
            await load();
            onClose?.();
          } catch (e) { Alert.alert(t('iv_title'), e?.message || 'error'); }
          finally { setBusy(false); }
        } },
    ]);
  };

  const pick = (slot) => {
    Alert.alert(t('iv_title'), slotLabel(slot, lang), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('iv_scheduled'), onPress: async () => {
          setBusy(true);
          try {
            const r = await selectSlot(userId, slot);
            if (r === 'full') { setAvail(await getSlotAvailability()); Alert.alert(t('iv_title'), t('iv_slot_full')); return; }
            if (r === 'past') { Alert.alert(t('iv_title'), t('iv_past_slot')); return; }
            if (r === 'invalid' || r === 'no_interview') { Alert.alert(t('iv_title'), t('iv_none')); await load(); return; }
            notifyInterview(userId, 'scheduled');
            checkInterviewReminders(userId);
            await load();
          } catch (e) { Alert.alert(t('iv_title'), e?.message || 'error'); }
          finally { setBusy(false); }
        } },
    ]);
  };

  // Görüşmeyi aç (Expo Go'da native modül olmadığı için engelle, çökmesin).
  const openCall = () => {
    if (IS_EXPO_GO) { Alert.alert('Görüntülü görüşme', 'Görüntülü görüşme Expo Go\'da çalışmaz. Lütfen uygulamayı dev/gerçek build üzerinden açın.'); return; }
    setCallOpen(true);
  };
  const closeCall = useCallback(() => setCallOpen(false), []);

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
  const win = status === 'scheduled' && iv?.selectedSlot ? callWindow(iv.selectedSlot, callOpts) : null;
  const joinable = !!win?.joinable;
  const countdownLeft = win?.base ? win.base - nowTick : 0;
  // Biten / done: acente için planlama ekranı (scheduled UI değil).
  const showScheduledUi = status === 'scheduled' && iv?.selectedSlot && !win?.ended;

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
          ) : showScheduledUi ? (
            <>
              <View style={styles.schedCard}>
                <View style={styles.schedAccent} />
                <View style={styles.schedBadge}><Text style={styles.schedCheck}>✓</Text></View>
                <Text style={styles.schedKicker}>{t('iv_scheduled')}</Text>
                <Text style={styles.schedDay}>{weekdayOf(iv.selectedSlot, lang)}</Text>
                <Text style={styles.schedDate}>{slotDateKey(iv.selectedSlot)}</Text>
                <View style={styles.schedTimePill}><Text style={styles.schedTimeText}>🕒 {slotTime(iv.selectedSlot)}</Text></View>
                {countdownLeft > 0 ? (
                  <Text style={styles.schedCountdown}>⏱ {t('iv_countdown')}: {formatCountdown(countdownLeft)}</Text>
                ) : null}
                <Text style={styles.schedTz}>🌍 {t('iv_localtime')}</Text>
              </View>
              {joinable ? (
                <Animated.View style={{ opacity: joinPulse }}>
                  <TouchableOpacity style={styles.joinBtn} onPress={openCall} activeOpacity={0.9}>
                    <Text style={styles.joinText}>🎥 {t('call_join')}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <Text style={styles.waitJoinNote}>
                  {countdownLeft > 0 ? t('iv_waiting_join') : t('iv_ended')}
                </Text>
              )}
              {isAgency ? (
                <>
                  <TouchableOpacity
                    style={styles.ghostBtn}
                    onPress={() => {
                      setForm(slotsToForm(iv.slots?.length ? iv.slots : (iv.selectedSlot ? [iv.selectedSlot] : [])));
                      setReplan(true);
                      setIv({ ...iv, status: 'proposed' });
                    }}
                    activeOpacity={0.85}
                  >
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
                  {(() => {
                    const by = iv.respondBy ? new Date(iv.respondBy).getTime() : 0;
                    const left = by - nowTick;
                    if (!by) return null;
                    if (left <= 0 || iv.noResponseNotifiedAt) {
                      return <Text style={styles.slaOverdue}>⏳ {t('iv_respond_overdue')}</Text>;
                    }
                    return <Text style={styles.slaOk}>⏱ {t('iv_waiting_sla').replace('{left}', formatCountdown(left))}</Text>;
                  })()}
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

                  <View style={styles.dayCard}>
                    <View style={styles.dayHead}>
                      <View style={styles.dayNo}><Text style={styles.dayNoText}>1</Text></View>
                      <Text style={styles.dayTitle}>{t('iv_date_label')}</Text>
                      <View style={{ flex: 1 }} />
                      {form.d && form.m && form.y ? <Text style={styles.dayWeek}>{weekdayOfParts(form.d, form.m, form.y, lang)}</Text> : null}
                    </View>
                    <View style={styles.row}>
                      <View style={styles.col}><Select label={t('f_day')} value={form.d} options={DAYS} onChange={(v) => updateForm('d', v)} /></View>
                      <View style={styles.col}><Select label={t('f_month')} value={form.m} options={monthOptions(lang)} onChange={(v) => updateForm('m', v)} /></View>
                      <View style={styles.col}><Select label={t('f_year')} value={form.y} options={FLIGHT_YEARS} onChange={(v) => updateForm('y', v)} /></View>
                    </View>
                    <View style={styles.divider} />
                    <Text style={styles.groupLbl}>{t('iv_times_label')}</Text>
                    {BAND_KEYS.map((key, bi) => {
                      const locked = !!(form.d && form.m && form.y) && !ivBandOpen(form.d, form.m, form.y, bi, bandTick);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.timePickRow, locked && styles.timePickRowLocked]}
                          onPress={() => { if (!locked) setWheelBand(bi); }}
                          activeOpacity={locked ? 1 : 0.85}
                          disabled={locked}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.timePickLbl, locked && styles.timePickLblLocked]}>{t(BAND_LABELS[bi])}</Text>
                            <Text style={[styles.timePickVal, (!form[key] || locked) && styles.timePickPh]}>
                              {locked ? `🔒 ${t('iv_band_locked')}` : (form[key] ? `🕒 ${form[key]}` : t('iv_pick_time'))}
                            </Text>
                          </View>
                          {!locked ? <Text style={styles.timePickChev}>›</Text> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

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
            // Aday: güne göre gruplanmış slotları seç + yanıt SLA / red
            <>
              <Text style={styles.pickHint}>{t('iv_pick_hint')}</Text>
              <Text style={styles.tzNote}>🌍 {t('iv_localtime')}</Text>
              {(() => {
                const by = iv.respondBy ? new Date(iv.respondBy).getTime() : 0;
                const left = by - nowTick;
                if (!by) return null;
                if (left <= 0 || iv.noResponseNotifiedAt) {
                  return <Text style={styles.slaOverdue}>⏳ {t('iv_respond_overdue')}</Text>;
                }
                return <Text style={styles.slaOk}>⏱ {t('iv_respond_deadline').replace('{left}', formatCountdown(left))}</Text>;
              })()}
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
              {!isAgency ? (
                <TouchableOpacity style={[styles.declineBtn, busy && { opacity: 0.5 }]} onPress={doDecline} disabled={busy} activeOpacity={0.85}>
                  <Text style={styles.declineBtnText}>{t('iv_decline')}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={styles.none}>{t('iv_none')}</Text>
          )}
        </ScrollView>
      </View>
      {callOpen ? (
        <Suspense fallback={null}>
          <InterviewCall visible={callOpen} candidateUserId={userId} candidateLabel={candidateLabel} slotISO={iv?.selectedSlot || ''} onClose={closeCall} />
        </Suspense>
      ) : null}

      <TimeWheelSheet
        visible={wheelBand !== null}
        bandIndex={wheelBand ?? 0}
        minHhmm={wheelBand !== null ? (ivEarliestInBand(form.d, form.m, form.y, wheelBand, bandTick) || '') : ''}
        value={wheelBand !== null
          ? (form[BAND_KEYS[wheelBand]] || ivEarliestInBand(form.d, form.m, form.y, wheelBand, bandTick) || '')
          : ''}
        title={wheelBand !== null ? t(BAND_LABELS[wheelBand]) : ''}
        cancelLabel={t('consent_cancel')}
        saveLabel={t('iv_save_time')}
        onCancel={() => setWheelBand(null)}
        onSave={(hhmm) => {
          if (wheelBand === null) return;
          const iso = toISO(form.d, form.m, form.y, hhmm);
          if (!(slotMs(iso) > Date.now() + 60 * 1000)) {
            Alert.alert(t('iv_propose_title'), t('iv_past_slot'));
            return;
          }
          updateForm(BAND_KEYS[wheelBand], hhmm);
          setWheelBand(null);
        }}
      />
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
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  timePickRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#faf7ef', borderWidth: 1, borderColor: '#e3d2a3',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
  },
  timePickRowLocked: { backgroundColor: '#f1f2f4', borderColor: '#e0e2e6' },
  timePickLbl: { fontSize: 11, fontWeight: '800', color: '#9a7b1f', letterSpacing: 0.3, marginBottom: 3 },
  timePickLblLocked: { color: '#9aa1ac' },
  timePickVal: { fontSize: 17, fontWeight: '800', color: INK },
  timePickPh: { color: '#9aa1ac', fontWeight: '600', fontSize: 15 },
  timePickChev: { fontSize: 22, color: GOLD, fontWeight: '800', marginLeft: 8 },

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
  declineBtn: { backgroundColor: '#fbeaea', borderWidth: 1, borderColor: '#e8b5b0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  declineBtnText: { color: '#a32d2d', fontWeight: '800', fontSize: 15 },
  slaOk: { fontSize: 13, fontWeight: '800', color: '#9a7b1f', marginBottom: 12, marginTop: 4 },
  slaOverdue: { fontSize: 13, fontWeight: '800', color: '#a32d2d', marginBottom: 12, marginTop: 4 },
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
  schedCountdown: { color: GOLD, fontSize: 15, fontWeight: '800', marginTop: 14, letterSpacing: 0.4 },
  waitJoinNote: { textAlign: 'center', color: '#8b95a3', fontSize: 13, fontWeight: '600', marginTop: 14, lineHeight: 19 },
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
