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
import { C } from '../lib/theme';

const NATION_FLAG = {
  Türkiye: require('../assets/flags/tr.png'),
  Kazakistan: require('../assets/flags/kk.png'),
  Kırgızistan: require('../assets/flags/ky.png'),
  Özbekistan: require('../assets/flags/uz.png'),
  Rusya: require('../assets/flags/ru.png'),
  Tayland: require('../assets/flags/th.png'),
  Türkmenistan: require('../assets/flags/tk.png'),
};

const BG = '#0A1121';
const CARD = '#121B2E';
const TILE = '#1a2438';
const GOLD = '#A89468';
const GOLD_BTN = '#C8B88E';
const BORDER = 'rgba(168,148,104,0.28)';
const TEXT_SEC = '#8E98A8';
const INK_LIGHT = '#f0ece4';
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
function FunnelTileBtn({ n, label, delta, onPress, light = false }) {
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
        style={[styles.funnelTile, light && lightStyles.funnelTile, n > 0 && styles.funnelTileOn, light && n > 0 && lightStyles.funnelTileOn, hasNew && styles.funnelTileNew]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {hasNew ? (
          <View style={styles.funnelBadge}>
            <Text style={styles.funnelBadgeText}>{delta > 9 ? '9+' : delta}</Text>
          </View>
        ) : null}
        <Text style={[styles.funnelN, light && lightStyles.funnelN, n > 0 && styles.funnelNOn, light && n > 0 && lightStyles.funnelNOn, hasNew && styles.funnelNNew]}>{n}</Text>
        <Text style={[styles.funnelL, light && lightStyles.funnelL, n > 0 && styles.funnelLOn, light && n > 0 && lightStyles.funnelLOn, hasNew && styles.funnelLNew]} numberOfLines={2}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AgencyOpsDesk({ agencyId, onOpen, onNavigateCat, padBottom = 24, light = false }) {
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
    const photo = p.data?.photo || p.data?.photoClose || p.data?.photoFull;
    const flag = NATION_FLAG[p.nationality];
    const tone = TONE[q.kind] || 'muted';
    let detail = q.detail;
    if (q.titleKey) detail = t(q.titleKey) || detail;
    else if (detail && String(detail).startsWith('pipe_')) detail = t(detail) || detail;

    return (
      <TouchableOpacity style={[styles.row, light && lightStyles.row, styles[`tone_${tone}`]]} onPress={() => openRow(q)} activeOpacity={0.88}>
        <View style={[styles.avatar, light && lightStyles.avatar]}>
          {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <Text style={styles.ph}>👤</Text>}
        </View>
        <View style={styles.main}>
          <View style={styles.top}>
            <Text style={[styles.code, light && lightStyles.code]}>{code}</Text>
          </View>
          <View style={styles.sub}>
            {flag ? <Image source={flag} style={styles.flag} /> : null}
            <Text style={[styles.subText, light && lightStyles.subText]} numberOfLines={1}>
              {p.nationality || '—'}{detail ? ` · ${detail}` : ''}
            </Text>
          </View>
        </View>
        <Text style={[styles.go, light && lightStyles.go]}>›</Text>
      </TouchableOpacity>
    );
  };

  const listPad = kbH > 0 ? (Platform.OS === 'ios' ? kbH + 20 : 24) : padBottom;

  return (
    <View style={[styles.screen, light && lightStyles.screen]}>
      <FlatList
        ref={listRef}
        data={shownRows}
        keyExtractor={(q, i) => `${q.kind}-${q.candidateId}-${i}`}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={() => load()} tintColor={GOLD} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, light && lightStyles.content, { paddingBottom: listPad }]}
        ListHeaderComponent={(
          <View>
            {focusDef && focusCount > 0 ? (
              <View style={[styles.focusCard, light && lightStyles.focusCard, focusDef?.urgent && styles.focusCardUrgent]}>
                <View style={styles.focusCardTop}>
                  {flashKeys[focusDef?.key] ? <LiveDot /> : null}
                  <Text style={styles.focusKicker}>{t('ops_focus_now')}</Text>
                </View>
                <Text style={[styles.focusTitleLine, light && lightStyles.focusTitleLine]} numberOfLines={2}>
                  {t(focusDef.titleKey)} · {t('ops_people', { n: String(focusCount) })}
                </Text>
                <Text style={[styles.focusHint, light && lightStyles.focusHint]} numberOfLines={2}>{t(focusDef.hintKey)}</Text>
                {(filter === 'arrival' || noticeIds.length > 0) ? (
                  <View style={styles.focusBtnRow}>
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
                  </View>
                ) : null}
                {groups.length > 0 ? (
                  <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.85} style={styles.focusLink}>
                    <Text style={styles.focusLinkText}>
                      {t('ops_pending_title')}{pendingN > 0 ? ` · ${pendingN}` : ''} ›
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={[styles.focusCard, light && lightStyles.focusCard, styles.focusCardClean]}>
                <View style={styles.focusCleanRow}>
                  <CalmCheck />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.focusTitleLine, light && lightStyles.focusTitleLine]}>{t('ops_today_clean')}</Text>
                    <Text style={[styles.focusHint, light && lightStyles.focusHint]} numberOfLines={2}>{t('ops_today_clean_hint')}</Text>
                  </View>
                </View>
                {groups.length > 0 ? (
                  <TouchableOpacity onPress={() => setSheetOpen(true)} activeOpacity={0.85} style={styles.focusLink}>
                    <Text style={styles.focusLinkText}>
                      {t('ops_pending_title')}{pendingN > 0 ? ` · ${pendingN}` : ''} ›
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <Text style={styles.section}>{t('ops_funnel_section')}</Text>
            <Text style={[styles.funnelHint, light && lightStyles.funnelHint]}>{t('ops_funnel_hint')}</Text>
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
                    light={light}
                  />
                );
              })}
            </View>

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
                        style={[styles.chip, light && lightStyles.chip, on && styles.chipOn, light && on && lightStyles.chipOn, flash && styles.chipFlash]}
                        onPress={() => selectFocus(g.id)}
                        activeOpacity={0.85}
                      >
                        {flash ? <LiveDot size={6} /> : null}
                        <Text style={[styles.chipText, light && lightStyles.chipText, on && styles.chipTextOn, light && on && lightStyles.chipTextOn]} numberOfLines={1}>
                          {t(g.titleKey)} · {g.count}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            {focusDef && focusCount > 0 ? (
              <View style={styles.queueHead}>
                <Text style={[styles.queueTitle, light && lightStyles.queueTitle]}>{t(focusDef.titleKey)}</Text>
                <Text style={[styles.queueHint, light && lightStyles.queueHint]}>
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
                <Text style={[styles.moreText, light && lightStyles.moreText]}>
                  {t('ops_more', { n: String(listMore) })}
                </Text>
                {filter === 'agency_turn' || filter === 'docs_overdue' ? (
                  <TouchableOpacity
                    style={[styles.moreBtn, light && lightStyles.moreBtn]}
                    onPress={() => onNavigateCat?.('process', 'inprocess')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.moreBtnText, light && lightStyles.moreBtnText]}>{t('ops_go_process')}</Text>
                  </TouchableOpacity>
                ) : null}
                {filter === 'transit' || filter === 'start_confirm' ? (
                  <TouchableOpacity
                    style={[styles.moreBtn, light && lightStyles.moreBtn]}
                    onPress={() => onNavigateCat?.('staff', 'transit')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.moreBtnText, light && lightStyles.moreBtnText]}>{t('ops_go_transit')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {data ? (
              <AgencyDeskNotes
                agencyId={agencyId}
                dark={!light}
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
            <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
          ) : null
        )}
      />

      <AgencyPendingSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        metrics={metrics}
        onPick={pickAction}
        light={light}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  focusCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  focusCardUrgent: { borderColor: 'rgba(180,35,24,0.45)' },
  focusCardClean: { borderColor: 'rgba(110,168,130,0.35)' },
  focusCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  focusCleanRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calmCheck: {
    width: 26, height: 26, borderRadius: 13, marginTop: 2,
    backgroundColor: 'rgba(110,168,130,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(142,196,160,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  calmCheckMark: { color: '#9fd4b0', fontSize: 14, fontWeight: '800', marginTop: -1 },
  focusKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: GOLD },
  focusTitleLine: { fontSize: 16, fontWeight: '800', color: '#fff', lineHeight: 21 },
  focusHint: { marginTop: 3, fontSize: 12, fontWeight: '600', color: TEXT_SEC, lineHeight: 17 },
  focusBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  focusSend: {
    backgroundColor: GOLD_BTN, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
  },
  focusSendText: { fontSize: 12, fontWeight: '800', color: '#2A2418' },
  focusLink: { marginTop: 10, alignSelf: 'flex-start' },
  focusLinkText: { fontSize: 12, fontWeight: '700', color: GOLD },

  section: {
    marginBottom: 6, marginTop: 4, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.2, textTransform: 'uppercase', color: GOLD,
  },
  funnelHint: { marginTop: -2, marginBottom: 8, fontSize: 11.5, fontWeight: '600', color: TEXT_SEC, lineHeight: 16 },
  funnel: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  funnelTileWrap: { width: '31.5%', flexGrow: 0 },
  funnelTile: {
    backgroundColor: TILE, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    position: 'relative', overflow: 'visible', minHeight: 70,
  },
  funnelTileOn: { borderColor: 'rgba(168,148,104,0.5)', backgroundColor: 'rgba(168,148,104,0.08)' },
  funnelTileNew: {
    borderColor: 'rgba(180,35,24,0.65)',
    backgroundColor: 'rgba(180,35,24,0.08)',
    borderWidth: 1,
  },
  funnelBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: CARD, zIndex: 2,
  },
  funnelBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  funnelN: { fontSize: 20, fontWeight: '800', color: '#A8B4C4' },
  funnelNOn: { color: '#FFFFFF' },
  funnelNNew: { color: '#F0A8A0' },
  funnelL: { marginTop: 3, fontSize: 10, fontWeight: '700', color: '#B8C2D0', lineHeight: 13 },
  funnelLOn: { color: '#E8EDF4' },
  funnelLNew: { color: '#E8B4AE' },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: BORDER, backgroundColor: TILE, maxWidth: 260,
  },
  chipOn: { backgroundColor: 'rgba(168,148,104,0.18)', borderColor: 'rgba(168,148,104,0.55)' },
  chipFlash: { borderColor: 'rgba(180,35,24,0.65)', backgroundColor: 'rgba(180,35,24,0.08)' },
  chipText: { fontSize: 12, fontWeight: '700', color: TEXT_SEC },
  chipTextOn: { color: INK_LIGHT },

  queueHead: { marginBottom: 8, marginTop: 2 },
  queueTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  queueHint: { marginTop: 2, fontSize: 11.5, fontWeight: '600', color: TEXT_SEC },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD,
    borderRadius: 12, padding: 10, marginBottom: 7,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    borderLeftWidth: 3, borderLeftColor: '#5a6578',
  },
  tone_hot: { borderLeftColor: '#b42318' },
  tone_warn: { borderLeftColor: '#c9a227' },
  tone_act: { borderLeftColor: GOLD },
  tone_info: { borderLeftColor: '#4a8f9c' },
  tone_muted: { borderLeftColor: '#5a6578' },
  avatar: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: TILE, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  ph: { fontSize: 18 },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontSize: 14, fontWeight: '800', color: '#fff' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  flag: { width: 16, height: 11, borderRadius: 2 },
  subText: { flex: 1, fontSize: 12, fontWeight: '600', color: TEXT_SEC },
  go: { fontSize: 20, fontWeight: '600', color: GOLD },

  moreBox: {
    marginTop: 4, marginBottom: 12, padding: 12, borderRadius: 12,
    backgroundColor: TILE, borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  moreText: { fontSize: 12.5, fontWeight: '600', color: TEXT_SEC, lineHeight: 18 },
  moreBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: GOLD_BTN, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  moreBtnText: { color: '#2A2418', fontWeight: '800', fontSize: 12 },
});

const lightStyles = StyleSheet.create({
  screen: { backgroundColor: C.bg },
  content: { backgroundColor: C.bg },
  focusCard: { backgroundColor: C.card, borderColor: C.hair },
  focusTitleLine: { color: C.ink },
  focusHint: { color: C.ink2 },
  funnelHint: { color: C.ink2 },
  funnelTile: { backgroundColor: C.card, borderColor: C.hair },
  funnelTileOn: { backgroundColor: C.goldSoft, borderColor: C.gold },
  funnelN: { color: C.ink2 },
  funnelNOn: { color: C.ink },
  funnelL: { color: C.ink2 },
  funnelLOn: { color: C.ink },
  chip: { backgroundColor: C.card, borderColor: C.hair },
  chipOn: { backgroundColor: C.goldSoft, borderColor: C.gold },
  chipText: { color: C.ink2 },
  chipTextOn: { color: C.ink },
  queueTitle: { color: C.ink },
  queueHint: { color: C.ink2 },
  row: { backgroundColor: C.card, borderColor: C.hair },
  avatar: { backgroundColor: '#E9E4DA' },
  code: { color: C.ink },
  subText: { color: C.ink2 },
  go: { color: C.goldText },
  moreText: { color: C.ink2 },
  moreBtn: { backgroundColor: C.gold },
  moreBtnText: { color: '#2A2418' },
});
