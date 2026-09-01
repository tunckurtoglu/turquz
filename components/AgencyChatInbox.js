import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, SectionList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Keyboard, Platform, ScrollView,
} from 'react-native';
import { listAgencyChatThreads } from '../lib/ops';
import { groupByEmployer } from '../lib/employerAttach';
import { candidateCode, maskedName } from '../lib/candidateCode';
import { useLanguage } from '../i18n/LanguageContext';
import { C } from '../lib/theme';

const BG = C.bg;
const CARD = C.card;
const GOLD = C.goldText;
const GOLD_BTN = C.gold;
const BORDER = C.hair;
const TEXT_SEC = C.ink2;
const INK = C.ink;

function threadTime(iso, t) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  if (d >= startOfToday) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  if (d >= startOfYesterday) return t('chat_yesterday') || 'dün';
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa`;
  return `${Math.floor(h / 24)} g`;
}

function matchThread(th, term) {
  if (!term) return true;
  const p = th.profile || {};
  const code = (candidateCode(p.nationality, p.reg_no) || '').toLocaleLowerCase('tr');
  const name = (maskedName(p.data) || '').toLocaleLowerCase('tr');
  const full = [p.data?.firstName, p.data?.lastName, p.data?.passportFirstName, p.data?.passportLastName]
    .filter(Boolean).join(' ').toLocaleLowerCase('tr');
  const hotel = (th.employerLabel || '').toLocaleLowerCase('tr');
  const preview = (th.lastPreview || '').toLocaleLowerCase('tr');
  return code.includes(term) || name.includes(term) || full.includes(term) || hotel.includes(term) || preview.includes(term);
}

function FilterPill({ label, active, badge, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>{label}</Text>
      {badge > 0 ? (
        <View style={[styles.pillBadge, active && styles.pillBadgeActive]}>
          <Text style={[styles.pillBadgeTxt, active && styles.pillBadgeTxtActive]}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AgencyChatInbox({ agencyId, onOpen, padBottom = 24, onBadgeChange, hideIntro = false }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [kbH, setKbH] = useState(0);
  const [searchFocus, setSearchFocus] = useState(false);
  const seeded = React.useRef(false);

  const load = async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      const list = await listAgencyChatThreads(agencyId, 250);
      setRows(list);
      const unread = list.reduce((n, th) => n + (th.closed ? 0 : (th.count || 0)), 0);
      onBadgeChange?.(unread);
    } catch (e) {
      setRows([]);
      onBadgeChange?.(0);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const tmr = setInterval(load, 15000);
    return () => clearInterval(tmr);
  }, [agencyId]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKbH(Math.max(0, e?.endCoordinates?.height || 0));
    const onHide = () => setKbH(0);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const unreadTotal = useMemo(
    () => (rows || []).reduce((n, th) => n + (th.closed ? 0 : (th.count || 0)), 0),
    [rows],
  );

  const archiveTotal = useMemo(() => (rows || []).filter((r) => r.closed).length, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr');
    let list = (rows || []).filter((th) => matchThread(th, term));
    if (filter === 'unread') list = list.filter((th) => !th.closed && th.count > 0);
    else if (filter === 'archive') list = list.filter((th) => th.closed);
    else list = list.filter((th) => !th.closed);
    return list;
  }, [rows, query, filter]);

  const sections = useMemo(() => {
    if (filter === 'archive') {
      return groupByEmployer(filtered, { noneLabel: t('employer_group_none') || 'İşletme atanmamış' });
    }
    const activeSecs = groupByEmployer(filtered, { noneLabel: t('employer_group_none') || 'İşletme atanmamış' });
    if (filter !== 'all') return activeSecs;
    const history = (rows || []).filter((r) => r.closed && matchThread(r, query.trim().toLocaleLowerCase('tr')));
    if (!history.length) return activeSecs;
    return [
      ...activeSecs,
      {
        key: 'history',
        title: t('agency_chat_history') || 'Süreci sonlanan adaylar',
        data: history,
      },
    ];
  }, [filtered, filter, rows, query, t]);

  useEffect(() => {
    if (!rows || seeded.current) return;
    const active = rows.filter((r) => !r.closed);
    const secs = groupByEmployer(active, { noneLabel: 'x' });
    const withUnread = secs.filter((s) => s.data.some((th) => th.count > 0)).map((s) => s.key);
    if (withUnread.length) setOpenKeys(new Set(withUnread));
    else if (secs[0]) setOpenKeys(new Set([secs[0].key]));
    seeded.current = true;
  }, [rows]);

  const searching = !!query.trim();
  const compact = searchFocus || kbH > 0;
  const displaySections = useMemo(
    () => sections.map((s) => {
      const open = searching || openKeys.has(s.key);
      const unreadN = s.data.reduce((n, th) => n + (th.closed ? 0 : (th.count || 0)), 0);
      return { ...s, data: open ? s.data : [], _count: s.data.length, _unread: unreadN, _open: open };
    }),
    [sections, openKeys, searching],
  );

  const toggle = (key) => {
    if (searching) return;
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (rows == null) {
    return <ActivityIndicator color={GOLD_BTN} style={{ marginTop: 50 }} />;
  }

  const avoidKb = Platform.OS === 'ios' ? kbH : 0;
  const listPad = avoidKb > 0 ? 12 : padBottom;

  const emptyTitle = searching
    ? (t('agency_chat_search_empty') || 'Sonuç bulunamadı')
    : filter === 'archive'
      ? (t('agency_chat_empty') || 'Henüz sohbet yok')
      : filter === 'unread'
        ? (t('agency_chat_filter_unread') || 'Okunmamış')
        : (t('agency_chat_empty') || 'Henüz sohbet yok');

  const emptySub = searching
    ? (t('agency_chat_search_empty_sub') || 'Başka bir isim veya kod deneyin.')
    : filter === 'unread'
      ? (t('agency_chat_empty_sub') || 'Tüm mesajlar okundu.')
      : (t('agency_chat_empty_sub') || 'Sözleşme adımı açılınca buradan yazışabilirsiniz.');

  return (
    <View style={[styles.wrap, avoidKb > 0 && { paddingBottom: avoidKb }]}>
      <View style={[styles.topBar, compact && styles.topBarCompact]}>
        {!hideIntro && !compact ? (
          <>
            <Text style={styles.kicker}>{t('agency_chat_inbox_title') || 'Süreç sohbetleri'}</Text>
            <Text style={styles.lead}>
              {t('agency_chat_inbox_lead') || 'Sözleşme sonrası aday yazışmaları'}
            </Text>
          </>
        ) : null}
        <View style={[styles.searchBox, compact && styles.searchBoxCompact]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('agency_chat_search_ph') || 'İsim veya aday no ile ara'}
            placeholderTextColor={TEXT_SEC}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
          {compact ? (
            <TouchableOpacity
              onPress={() => { Keyboard.dismiss(); setSearchFocus(false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchDone}>{t('done') || 'Tamam'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {!compact ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillRow}
            contentContainerStyle={styles.pillRowInner}
          >
            <FilterPill
              label={t('agency_chat_filter_all') || 'Tümü'}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterPill
              label={t('agency_chat_filter_unread') || 'Okunmamış'}
              active={filter === 'unread'}
              badge={unreadTotal}
              onPress={() => setFilter('unread')}
            />
            <FilterPill
              label={t('agency_chat_filter_archive') || 'Arşiv'}
              active={filter === 'archive'}
              badge={archiveTotal}
              onPress={() => setFilter('archive')}
            />
          </ScrollView>
        ) : null}
      </View>

      <SectionList
        style={styles.list}
        sections={displaySections}
        keyExtractor={(th) => th.candidateId}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={GOLD_BTN} />}
        contentContainerStyle={[styles.content, { paddingBottom: listPad }]}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptySub}>{emptySub}</Text>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={[styles.secHead, section.key === 'history' && styles.secHeadHistory]}
            onPress={() => toggle(section.key)}
            activeOpacity={0.85}
          >
            <Text style={styles.secChevron}>{section._open ? '▾' : '▸'}</Text>
            <Text style={[styles.secTitle, section.key === 'history' && styles.secTitleHistory]} numberOfLines={1}>
              {section.key === 'history' ? `${section.title} · ${section._count}` : section.title}
            </Text>
            {section._unread > 0 ? (
              <View style={styles.secUnread}>
                <Text style={styles.secUnreadTxt}>{section._unread}</Text>
              </View>
            ) : null}
            {section.key !== 'history' ? (
              <View style={styles.secN}>
                <Text style={styles.secNTxt}>{section._count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
        renderItem={({ item: th, section }) => {
          const p = th.profile;
          const code = candidateCode(p.nationality, p.reg_no);
          const photo = p.data?.photo || p.data?.photoClose || p.data?.photoFull;
          const unread = !th.closed && th.count > 0;
          const hist = section.key === 'history' || th.closed;
          const name = maskedName(p.data);
          const preview = th.lastPreview
            ? th.lastPreview
            : hist
              ? (t('agency_chat_ended') || 'Süreç sonlandı · arşiv')
              : (t('chat_empty') || 'Henüz mesaj yok');
          return (
            <TouchableOpacity
              style={[styles.row, unread && styles.rowUnread, hist && styles.rowHistory]}
              onPress={() => { Keyboard.dismiss(); onOpen?.(p); }}
              activeOpacity={0.88}
            >
              <View style={styles.avatar}>
                {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <Text style={styles.ph}>👤</Text>}
              </View>
              <View style={styles.main}>
                <View style={styles.top}>
                  <Text style={[styles.name, unread && styles.nameHot]} numberOfLines={1}>
                    {name || code}
                    {name ? <Text style={styles.codeInline}> · {code}</Text> : null}
                  </Text>
                  <Text style={[styles.ago, unread && styles.agoHot]}>{threadTime(th.lastAt, t)}</Text>
                </View>
                <View style={styles.sub}>
                  <Text style={[styles.preview, unread && styles.previewHot]} numberOfLines={1}>
                    {preview}
                  </Text>
                  {unread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadN}>{th.count > 9 ? '9+' : th.count}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: BG },
  topBarCompact: { paddingTop: 2, paddingBottom: 6 },
  list: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, flexGrow: 1 },
  kicker: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase',
    color: GOLD, marginBottom: 4,
  },
  lead: { fontSize: 13, fontWeight: '600', color: TEXT_SEC, lineHeight: 18, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  searchBoxCompact: { marginTop: 0 },
  searchIcon: { fontSize: 16, color: GOLD, fontWeight: '700' },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: INK, padding: 0 },
  searchClear: { fontSize: 16, color: TEXT_SEC, fontWeight: '700', paddingHorizontal: 4 },
  searchDone: { fontSize: 14, fontWeight: '800', color: GOLD_BTN, paddingHorizontal: 4 },
  pillRow: { marginTop: 10, marginHorizontal: -16 },
  pillRowInner: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  pillActive: { backgroundColor: INK, borderColor: INK },
  pillTxt: { fontSize: 13, fontWeight: '800', color: INK },
  pillTxtActive: { color: '#F7F2E8' },
  pillBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: 'rgba(168,148,104,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  pillBadgeActive: { backgroundColor: 'rgba(247,242,232,0.2)' },
  pillBadgeTxt: { fontSize: 10, fontWeight: '800', color: GOLD_BTN },
  pillBadgeTxtActive: { color: '#F7F2E8' },
  secHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
  },
  secHeadHistory: { marginTop: 16, borderColor: 'rgba(142,152,168,0.22)' },
  secChevron: { fontSize: 13, fontWeight: '800', color: GOLD, width: 14 },
  secTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: INK, letterSpacing: 0.6, textTransform: 'uppercase' },
  secTitleHistory: { color: TEXT_SEC, textTransform: 'none', letterSpacing: 0.2, fontSize: 13 },
  secUnread: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: '#b42318', alignItems: 'center', justifyContent: 'center',
  },
  secUnreadTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  secN: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7,
    backgroundColor: 'rgba(168,148,104,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  secNTxt: { fontSize: 11, fontWeight: '800', color: GOLD_BTN },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  rowUnread: { borderColor: 'rgba(200,184,142,0.45)', borderLeftWidth: 3, borderLeftColor: GOLD_BTN },
  rowHistory: { opacity: 0.72 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, overflow: 'hidden',
    backgroundColor: BG, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  avatarImg: { width: 46, height: 46 },
  ph: { fontSize: 20 },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '800', color: INK },
  nameHot: { color: INK },
  codeInline: { fontWeight: '600', color: TEXT_SEC },
  ago: { fontSize: 11, fontWeight: '600', color: TEXT_SEC },
  agoHot: { color: GOLD },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  preview: { flex: 1, fontSize: 13, fontWeight: '600', color: TEXT_SEC },
  previewHot: { color: '#b8c0cc' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: '#b42318', alignItems: 'center', justifyContent: 'center',
  },
  unreadN: { color: '#fff', fontSize: 10, fontWeight: '800' },
  empty: {
    alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20,
    borderWidth: 1, borderStyle: 'dashed', borderColor: BORDER,
    borderRadius: 18, marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: INK },
  emptySub: { marginTop: 6, fontSize: 13, color: TEXT_SEC, textAlign: 'center', lineHeight: 18 },
});
