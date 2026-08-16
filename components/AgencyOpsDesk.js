import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView, Animated,
} from 'react-native';
import { loadAgencyOps } from '../lib/ops';
import {
  PENDING_ACTIONS, FUNNEL_TILES, QUEUE_SHOW,
  pendingTotal, urgentTotal, pickFocusFilter,
  activeFocusGroups, FOCUS_DEFS, countForFocus,
} from '../lib/opsUi';
import { candidateCode } from '../lib/candidateCode';
import { useLanguage } from '../i18n/LanguageContext';
import AgencyPendingSheet from './AgencyPendingSheet';

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

export default function AgencyOpsDesk({ agencyId, onOpen, onNavigateCat, padBottom = 24 }) {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(null);
  const [busy, setBusy] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flashKeys, setFlashKeys] = useState({});
  const prevMetrics = useRef(null);
  const userPicked = useRef(false);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      const next = await loadAgencyOps(agencyId);
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
      setFilter((cur) => {
        if (userPicked.current && cur && countForFocus(cur, m, counts) > 0) return cur;
        const auto = pickFocusFilter(m, counts);
        if (!auto) userPicked.current = false;
        return auto;
      });
    } catch (e) {
      console.warn('ops:', e?.message);
      setData({ metrics: {}, queue: [], countsByKind: {} });
      setFilter(null);
    } finally {
      setBusy(false);
    }
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const metrics = data?.metrics || {};
  const countsByKind = data?.countsByKind || {};
  const groups = activeFocusGroups(metrics, countsByKind);
  const focusDef = filter ? FOCUS_DEFS[filter] : null;
  const focusCount = filter ? countForFocus(filter, metrics, countsByKind) : 0;

  const allRows = (data?.queue || []).filter((q) => filter && q.kind === filter);
  const shownRows = allRows.slice(0, QUEUE_SHOW);
  const listMore = Math.max(0, focusCount - shownRows.length);
  const pendingN = pendingTotal(metrics);
  const urgentN = urgentTotal(metrics);
  const topFocus = pickFocusFilter(metrics, countsByKind);

  const selectFocus = (id) => {
    userPicked.current = true;
    setFilter(id);
  };

  const openRow = (q) => {
    if (!q?.profile) return;
    onOpen?.(q.profile, {
      ...(q.openChat ? { _openChat: true } : {}),
      ...(q.boarding === 'missed' || q.boarding === 'no_response' ? { _openWorkStart: true } : {}),
      ...(q.openHireConfirm ? { _openHireConfirm: true } : {}),
    });
  };

  const pickAction = (a) => {
    setSheetOpen(false);
    if (a.cat === 'messages' || a.filter === 'chat') {
      onNavigateCat?.('messages');
      return;
    }
    if (a.filter) selectFocus(a.filter);
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

  return (
    <>
      <FlatList
        data={shownRows}
        keyExtractor={(q, i) => `${q.kind}-${q.candidateId}-${i}`}
        renderItem={renderRow}
        refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={load} tintColor="#b8954a" />}
        contentContainerStyle={[styles.content, { paddingBottom: padBottom }]}
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
                const nav = tile.nav || {};
                return (
                  <TouchableOpacity
                    key={tile.id}
                    style={[styles.funnelTile, n > 0 && styles.funnelTileOn]}
                    onPress={() => onNavigateCat?.(nav.cat, nav.sub)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.funnelN, n > 0 && styles.funnelNOn]}>{n}</Text>
                    <Text style={styles.funnelL} numberOfLines={2}>{t(tile.titleKey)}</Text>
                  </TouchableOpacity>
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
        ListFooterComponent={
          listMore > 0 ? (
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
          ) : null
        }
        ListEmptyComponent={(
          busy && !data ? (
            <ActivityIndicator color="#b8954a" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{urgentN > 0 ? t('ops_group_done') : t('ops_no_focus')}</Text>
              <Text style={styles.emptySub}>
                {urgentN > 0 ? t('ops_refresh_next') : t('ops_no_action')}
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={load} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('ops_refresh')}</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      />

      <AgencyPendingSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        metrics={metrics}
        onPick={pickAction}
      />
    </>
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
  focusLink: { marginTop: 12, alignSelf: 'flex-start' },
  focusLinkText: { fontSize: 13, fontWeight: '700', color: 'rgba(231,220,196,0.65)' },

  section: {
    marginBottom: 8, marginTop: 6, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.1, textTransform: 'uppercase', color: '#8f7130',
  },
  oneGroupNote: { fontSize: 12, fontWeight: '600', color: '#6e7684', marginBottom: 10 },
  funnelHint: { marginTop: -4, marginBottom: 10, fontSize: 12, fontWeight: '600', color: '#6e7684', lineHeight: 17 },
  funnel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  funnelTile: {
    width: '31%', flexGrow: 1, minWidth: 96, maxWidth: '33%',
    backgroundColor: '#fffdf8', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(20,32,51,0.07)',
  },
  funnelTileOn: { borderColor: 'rgba(184,149,74,0.35)', backgroundColor: '#fffdf8' },
  funnelN: { fontSize: 22, fontWeight: '800', color: '#9aa3b0' },
  funnelNOn: { color: INK },
  funnelL: { marginTop: 4, fontSize: 11, fontWeight: '700', color: '#6e7684', lineHeight: 14 },

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
