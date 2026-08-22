import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, Animated, Keyboard, Platform, Dimensions,
} from 'react-native';
import { loadAgencyOps } from '../lib/ops';
import {
  PENDING_ACTIONS, FUNNEL_TILES, QUEUE_SHOW,
  pendingTotal, pickFocusFilter,
  activeFocusGroups, FOCUS_DEFS, countForFocus, opsFingerprint,
} from '../lib/opsUi';
import {
  seedFunnelSeen, funnelNewDeltas, clampFunnelSeen, markFunnelTileSeen,
} from '../lib/opsFunnelSeen';
import { loadFunnelSeen, saveFunnelSeen } from '../lib/opsFunnelSeenStore';
import { candidateCode } from '../lib/candidateCode';
import { useLanguage } from '../i18n/LanguageContext';
import AgencyPendingSheet from './AgencyPendingSheet';
import AgencyDeskNotes from './AgencyDeskNotes';
import AgencyNoticeSheet from './AgencyNoticeSheet';

const NATION_FLAG = {
  Türkiye: require('../assets/flags/tr.png'),
  Kazakistan: require('../assets/flags/kk.png'),
  Kırgızistan: require('../assets/flags/ky.png'),
  Özbekistan: require('../assets/flags/uz.png'),
  Rusya: require('../assets/flags/ru.png'),
  Tayland: require('../assets/flags/th.png'),
  Türkmenistan: require('../assets/flags/tk.png'),
};

const TONE = {
  interview_today: 'hot',
  docs_overdue: 'hot',
  boarding: 'warn',
  chat: 'info',
  agency_turn: 'act',
  offered_wait: 'muted',
  start_confirm: 'hot',
  transit: 'info',
  arrival: 'warn',
};

function LiveDot({ size = 8 }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#b42318',
        opacity: anim,
      }}
    />
  );
}

/** Sakin onay — yumuşak nabız, problem yok hissi. */
function CalmCheck() {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[styles.calmCheck, { opacity: pulse }]}>
      <Text style={styles.calmCheckMark}>✓</Text>
    </Animated.View>
  );
}

/** Yeni güncelleme olan süreç özeti kutusu — kırmızı rozet + hafif yanıp sönme. */
function FunnelTileBtn({ n, label, delta, onPress }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const hasNew = delta > 0;
  useEffect(() => {
    if (!hasNew) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasNew, pulse]);

  return (
    <Animated.View style={[styles.funnelTileWrap, hasNew && { opacity: pulse }]}>
      <TouchableOpacity
        style={[styles.funnelTile, n > 0 && styles.funnelTileOn, hasNew && styles.funnelTileNew]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {hasNew ? (
          <View style={styles.funnelBadge}>
            <Text style={styles.funnelBadgeText}>{delta > 9 ? '9+' : delta}</Text>
          </View>
        ) : null}
        <Text style={[styles.funnelN, n > 0 && styles.funnelNOn, hasNew && styles.funnelNNew]}>{n}</Text>
        <Text style={[styles.funnelL, hasNew && styles.funnelLNew]} numberOfLines={2}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgencyOpsDesk({ agencyId, onOpen, onNavigateCat, padBottom = 24 }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(null);
  const [busy, setBusy] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [flashKeys, setFlashKeys] = useState({});
  // undefined = depodan henüz okunmadı; null = ilk kez; object = görüldü sayaçları
  const [funnelSeen, setFunnelSeen] = useState(undefined);
  const prevMetrics = useRef(null);
  const userPicked = useRef(false);
  const fpRef = useRef('');
  const listRef = useRef(null);
  const scrollY = useRef(0);
  const kbHRef = useRef(0);
  const composerNode = useRef(null);
  const [kbH, setKbH] = useState(0);

  const syncFunnelSeen = useCallback((m) => {
    setFunnelSeen((prev) => {
      if (prev === undefined) return prev;
      if (prev == null) {
        const seeded = seedFunnelSeen(m);
        saveFunnelSeen(agencyId, seeded);
        return seeded;
      }
      const clamped = clampFunnelSeen(prev, m);
      if (JSON.stringify(clamped) !== JSON.stringify(prev)) {
        saveFunnelSeen(agencyId, clamped);
        return clamped;
      }
      return prev;
    });
  }, [agencyId]);

  const load = useCallback(async (opts) => {
    if (!agencyId) return;
    const silent = !!opts?.silent;
    if (!silent) setBusy(true);
    try {
      const next = await loadAgencyOps(agencyId);
      const fp = opsFingerprint(next);
      if (fp === fpRef.current) return;
      fpRef.current = fp;
      const m = next?.metrics || {};
      const counts = next?.countsByKind || {};
      const prev = prevMetrics.current;
      if (prev) {
        const bumps = {};
        PENDING_ACTIONS.forEach((a) => {
          const n = Number(m[a.key]) || 0;
          const p = Number(prev[a.key]) || 0;
          if (n > p) bumps[a.key] = true;
        });
        if (Object.keys(bumps).length) {
          setFlashKeys((f) => ({ ...f, ...bumps }));
          setTimeout(() => {
            setFlashKeys((f) => {
              const copy = { ...f };
              Object.keys(bumps).forEach((k) => { delete copy[k]; });
              return copy;
            });
          }, 3500);
        }
      }
      prevMetrics.current = m;
      setData(next);
      syncFunnelSeen(m);
      setFilter((cur) => {
        if (userPicked.current && cur && countForFocus(cur, m, counts) > 0) return cur;
        const auto = pickFocusFilter(m, counts);
        if (!auto) userPicked.current = false;
        return auto;
      });
    } catch (e) {
      console.warn('ops:', e?.message);
      if (!silent) {
        setData({ metrics: {}, queue: [], countsByKind: {} });
        setFilter(null);
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }, [agencyId, syncFunnelSeen]);

  useEffect(() => {
    let alive = true;
    setFunnelSeen(undefined);
    loadFunnelSeen(agencyId).then((seen) => {
      if (!alive) return;
      setFunnelSeen(seen);
    });
    return () => { alive = false; };
  }, [agencyId]);

  // Depo okunduktan sonra mevcut metriklerle senkronize et
  useEffect(() => {
    if (funnelSeen === undefined || !data?.metrics) return;
    syncFunnelSeen(data.metrics);
  }, [funnelSeen, data, syncFunnelSeen]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const tmr = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(tmr);
  }, [load]);

  const alignComposer = useCallback(() => {
    const node = composerNode.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, w, h) => {
      const winH = Dimensions.get('window').height;
      const kb = kbHRef.current;
      const limit = winH - (Platform.OS === 'ios' ? kb : 0) - 16;
      const bottom = y + h;
      if (bottom > limit) {
        listRef.current?.scrollToOffset({
          offset: Math.max(0, scrollY.current + (bottom - limit)),
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      const h = Math.max(0, e?.endCoordinates?.height || 0);
      kbHRef.current = h;
      setKbH(h);
      setTimeout(alignComposer, 60);
      setTimeout(alignComposer, 320);
    };
    const onHide = () => {
      kbHRef.current = 0;
      setKbH(0);
    };
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [alignComposer]);

  const metrics = data?.metrics || {};
  const countsByKind = data?.countsByKind || {};
  const groups = activeFocusGroups(metrics, countsByKind);
  const focusDef = filter ? FOCUS_DEFS[filter] : null;
  const focusCount = filter ? countForFocus(filter, metrics, countsByKind) : 0;

  const allRows = (data?.queue || []).filter((q) => filter && q.kind === filter);
  const shownRows = allRows.slice(0, QUEUE_SHOW);
  const noticeIds = [...new Set(allRows.map((q) => q.candidateId).filter(Boolean))];
  const listMore = Math.max(0, focusCount - shownRows.length);
  const pendingN = pendingTotal(metrics);
  const topFocus = pickFocusFilter(metrics, countsByKind);

  const selectFocus = (id) => {
    userPicked.current = true;
    setFilter(id);
  };

  const openRow = (q) => {
    if (!q?.profile) return;
    onOpen?.(q.profile, {
      ...(q.openChat ? { _openChat: true } : {}),
      ...(q.openHireConfirm ? { _openHireConfirm: true } : {}),
    });
  };

  const pickAction = (a) => {
    setSheetOpen(false);
    if (a.cat === 'messages' || a.filter === 'chat') {
      onNavigateCat?.('messages');
      return;
    }
    if (a.filter === 'arrival' || a.sub === 'arrivals') {
      onNavigateCat?.(a.webCat || a.cat || 'staff', a.webSub || a.sub || 'arrivals');
      return;
    }
    if (a.filter) selectFocus(a.filter);
  };

  const funnelDeltas = funnelNewDeltas(metrics, funnelSeen);

  const openFunnelTile = (tile) => {
    const nav = tile.nav || {};
    const next = markFunnelTileSeen(funnelSeen, metrics, tile.metricKey);
    setFunnelSeen(next);
    saveFunnelSeen(agencyId, next);
    onNavigateCat?.(nav.cat, nav.sub);
  };

  const renderRow = ({ item: q }) => {
    const p = q.profile;
    const code = candidateCode(p.nationality, p.reg_no);
    const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
    const flag = NATION_FLAG[p.nationality];
    const tone = TONE[q.kind] || 'muted';
    let detail = q.detail;
    if (q.titleKey) detail = t(q.titleKey) || detail;
    else if (detail && String(detail).startsWith('pipe_')) detail = t(detail) || detail;

    return (
      <TouchableOpacity style={[styles.row, styles[`tone_${tone}`]]} onPress={() => openRow(q)} activeOpacity={0.88}>
        <View style={styles.avatar}>
          {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <Text style={styles.ph}>👤</Text>}
        </View>
        <View style={styles.main}>
          <View style={styles.top}>
            <Text style={styles.code}>{code}</Text>
          </View>
          <View style={styles.sub}>
            {flag ? <Image source={flag} style={styles.flag} /> : null}
            <Text style={styles.subText} numberOfLines={1}>
              {p.nationality || '—'}{detail ? ` · ${detail}` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.go}>›</Text>
      </TouchableOpacity>
    );
  };

  const listPad = kbH > 0 ? (Platform.OS === 'ios' ? kbH + 20 : 24) : padBottom;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={shownRows}
        keyExtractor={(q, i) => `${q.kind}-${q.candidateId}-${i}`}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={() => load()} tintColor="#b8954a" />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: listPad }]}
        ListHeaderComponent={(
          <View>
            {focusDef && focusCount > 0 ? (
              <View style={[styles.focusCard, focusDef?.urgent && styles.focusCardUrgent]}>
                <View style={styles.focusCardTop}>
                  {flashKeys[focusDef?.key] ? <LiveDot /> : null}
                  <Text style={styles.focusKicker}>{t('ops_focus_now')}</Text>
                </View>
                <Text style={styles.focusTitle}>{t(focusDef.titleKey)}</Text>
                <Text style={styles.focusHint}>{t(focusDef.hintKey)}</Text>
                <Text style={styles.focusCount}>{t('ops_people', { n: String(focusCount) })}</Text>
                {filter === 'arrival' ? (
                  <TouchableOpacity onPress={() => onNavigateCat?.('staff', 'arrivals')} activeOpacity={0.85} style={styles.focusSend}>
                    <Text style={styles.focusSendText}>{t('ops_go_arrivals')}</Text>
                  </TouchableOpacity>
                ) : null}
                {noticeIds.length ? (
                  <TouchableOpacity onPress={() => setNoticeOpen(true)} activeOpacity={0.85} style={styles.focusSend}>
                    <Text style={styles.focusSendText}>{t('agency_notice_to_group', { n: String(noticeIds.length) })}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.85} style={styles.focusLink}>
                  <Text style={styles.focusLinkText}>
                    {t('ops_all_groups')}{pendingN > 0 ? ` · ${pendingN}` : ''} ›
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.focusCard, styles.focusCardClean]}>
                <View style={styles.focusCleanRow}>
                  <CalmCheck />
                  <Text style={styles.focusTitle}>{t('ops_today_clean')}</Text>
                </View>
                <Text style={styles.focusHint}>{t('ops_today_clean_hint')}</Text>
                <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.85} style={styles.focusLink}>
                  <Text style={styles.focusLinkText}>
                    {t('ops_all_groups')}{pendingN > 0 ? ` · ${pendingN}` : ''} ›
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {groups.length > 1 ? (
              <>
                <Text style={styles.section}>{t('ops_other_pending')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {groups.map((g) => {
                    const flash = !!flashKeys[g.key];
                    const on = filter === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.chip, on && styles.chipOn, flash && styles.chipFlash]}
                        onPress={() => selectFocus(g.id)}
                        activeOpacity={0.85}
                      >
                        {flash ? <LiveDot size={6} /> : null}
                        <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                          {t(g.titleKey)} · {g.count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {groups.length === 1 && topFocus ? (
              <Text style={styles.oneGroupNote}>{t('ops_one_group')}</Text>
            ) : null}

            <Text style={styles.section}>{t('ops_funnel_section')}</Text>
            <Text style={styles.funnelHint}>{t('ops_funnel_hint')}</Text>
            <View style={styles.funnel}>
              {FUNNEL_TILES.map((tile) => {
                const n = metrics[tile.metricKey] ?? 0;
                const delta = funnelDeltas[tile.metricKey] || 0;
                return (
                  <FunnelTileBtn
                    key={tile.id}
                    n={n}
                    label={t(tile.titleKey)}
                    delta={delta}
                    onPress={() => openFunnelTile(tile)}
                  />
                );
              })}
            </View>

            {focusDef && focusCount > 0 ? (
              <View style={styles.queueHead}>
                <Text style={styles.queueTitle}>{t(focusDef.titleKey)}</Text>
                <Text style={styles.queueHint}>
                  {t('ops_showing', {
                    a: String(Math.min(shownRows.length, QUEUE_SHOW)),
                    b: String(focusCount),
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={(
          <View>
            {listMore > 0 ? (
              <View style={styles.moreBox}>
                <Text style={styles.moreText}>
                  {t('ops_more', { n: String(listMore) })}
                </Text>
                {filter === 'agency_turn' || filter === 'docs_overdue' ? (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => onNavigateCat?.('process', 'inprocess')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.moreBtnText}>{t('ops_go_process')}</Text>
                  </TouchableOpacity>
                ) : null}
                {filter === 'transit' || filter === 'start_confirm' ? (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => onNavigateCat?.('staff', 'transit')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.moreBtnText}>{t('ops_go_transit')}</Text>
                  </TouchableOpacity>
                ) : null}
                {filter === 'offered_wait' ? (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => onNavigateCat?.('process', 'offered')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.moreBtnText}>{t('ops_go_offered')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {data ? (
              <AgencyDeskNotes
                agencyId={agencyId}
                onComposerFocus={(node) => {
                  composerNode.current = node;
                  alignComposer();
                  setTimeout(alignComposer, 320);
                }}
              />
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          busy && !data ? (
            <ActivityIndicator color="#b8954a" style={{ marginTop: 40 }} />
          ) : null
        )}
      />

      <AgencyPendingSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        metrics={metrics}
        onPick={pickAction}
      />
      <AgencyNoticeSheet
        visible={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={noticeIds}
        targetKind="focus"
      />
    </View>
  );
}

const INK = '#142033';
const GOLD = '#b8954a';

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: '#8f7130', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.4, lineHeight: 34 },
  lead: { marginTop: 8, fontSize: 14, fontWeight: '600', color: '#6e7684', lineHeight: 20, marginBottom: 14 },

  focusCard: {
    backgroundColor: '#0e141c', borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  focusCardUrgent: { borderColor: 'rgba(180,35,24,0.4)' },
  focusCardClean: { borderColor: 'rgba(110,168,130,0.35)' },
  focusCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  focusCleanRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  calmCheck: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(110,168,130,0.22)',
    borderWidth: 1.5, borderColor: 'rgba(142,196,160,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  calmCheckMark: { color: '#9fd4b0', fontSize: 15, fontWeight: '800', marginTop: -1 },
  focusKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(231,220,196,0.5)' },
  focusTitle: { fontSize: 20, fontWeight: '800', color: '#f5ecda' },
  focusHint: { marginTop: 4, fontSize: 13, fontWeight: '600', color: 'rgba(231,220,196,0.5)', lineHeight: 18 },
  focusCount: { marginTop: 10, fontSize: 15, fontWeight: '800', color: GOLD },
  focusSend: {
    marginTop: 12, alignSelf: 'flex-start', backgroundColor: GOLD,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14,
  },
  focusSendText: { fontSize: 13, fontWeight: '800', color: '#0e141c' },
  focusLink: { marginTop: 12, alignSelf: 'flex-start' },
  focusLinkText: { fontSize: 13, fontWeight: '700', color: 'rgba(231,220,196,0.65)' },

  section: {
    marginBottom: 8, marginTop: 6, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.1, textTransform: 'uppercase', color: '#8f7130',
  },
  oneGroupNote: { fontSize: 12, fontWeight: '600', color: '#6e7684', marginBottom: 10 },
  funnelHint: { marginTop: -4, marginBottom: 10, fontSize: 12, fontWeight: '600', color: '#6e7684', lineHeight: 17 },
  funnel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  funnelTileWrap: { width: '31%', flexGrow: 1, minWidth: 96, maxWidth: '33%' },
  funnelTile: {
    backgroundColor: '#fffdf8', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(20,32,51,0.07)', position: 'relative', overflow: 'visible',
  },
  funnelTileOn: { borderColor: 'rgba(184,149,74,0.35)', backgroundColor: '#fffdf8' },
  funnelTileNew: {
    borderColor: 'rgba(180,35,24,0.75)',
    backgroundColor: '#fff6f4',
    borderWidth: 1.5,
  },
  funnelBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#fff', zIndex: 2,
  },
  funnelBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  funnelN: { fontSize: 22, fontWeight: '800', color: '#9aa3b0' },
  funnelNOn: { color: INK },
  funnelNNew: { color: '#b42318' },
  funnelL: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#6e7684', lineHeight: 14 },
  funnelLNew: { color: '#8a3a32' },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: '#ddd6c8', backgroundColor: '#fffdf8', maxWidth: 260,
  },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipFlash: { borderColor: 'rgba(180,35,24,0.7)', backgroundColor: '#fff8f6' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#6e7684' },
  chipTextOn: { color: '#f5ecda' },

  queueHead: { marginBottom: 10, marginTop: 4 },
  queueTitle: { fontSize: 18, fontWeight: '800', color: INK },
  queueHint: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#6e7684' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fffdf8',
    borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(20,32,51,0.07)',
    borderLeftWidth: 4, borderLeftColor: '#9aa3b0',
  },
  tone_hot: { borderLeftColor: '#b42318' },
  tone_warn: { borderLeftColor: '#9a6700' },
  tone_act: { borderLeftColor: GOLD },
  tone_info: { borderLeftColor: '#2a6f7a' },
  tone_muted: { borderLeftColor: '#9aa3b0' },
  avatar: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ebe4d6', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  ph: { fontSize: 20 },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 15, fontWeight: '800', color: INK },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  flag: { width: 16, height: 11, borderRadius: 2 },
  subText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#6e7684' },
  go: { fontSize: 22, fontWeight: '300', color: '#8f7130' },

  moreBox: {
    marginTop: 4, marginBottom: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#f4f1ea', borderWidth: 1, borderColor: 'rgba(20,32,51,0.08)',
  },
  moreText: { fontSize: 13, fontWeight: '600', color: '#6e7684', lineHeight: 18 },
  moreBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: INK, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  moreBtnText: { color: '#f5ecda', fontWeight: '800', fontSize: 12 },

  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(20,32,51,0.15)', borderRadius: 18, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: INK },
  emptySub: { marginTop: 6, fontSize: 13, color: '#6e7684', textAlign: 'center' },
  emptyBtn: { marginTop: 14, backgroundColor: INK, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBtnText: { color: '#f5ecda', fontWeight: '800' },
});
