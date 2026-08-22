import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, SectionList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Keyboard, Platform,
} from 'react-native';
import { listAgencyChatThreads } from '../lib/ops';
import { groupByEmployer } from '../lib/employerAttach';
import { candidateCode, maskedName } from '../lib/candidateCode';
import { useLanguage } from '../i18n/LanguageContext';

const NATION_FLAG = {
  Türkiye: require('../assets/flags/tr.png'),
  Kazakistan: require('../assets/flags/kk.png'),
  Kırgızistan: require('../assets/flags/ky.png'),
  Özbekistan: require('../assets/flags/uz.png'),
  Rusya: require('../assets/flags/ru.png'),
  Tayland: require('../assets/flags/th.png'),
  Türkmenistan: require('../assets/flags/tk.png'),
};

function ago(iso, t) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t('chat_just_now') || 'az önce';
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} sa`;
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
  return code.includes(term) || name.includes(term) || full.includes(term) || hotel.includes(term);
}

export default function AgencyChatInbox({ agencyId, onOpen, padBottom = 24, onBadgeChange, hideIntro = false }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
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

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr');
    return (rows || []).filter((th) => matchThread(th, term));
  }, [rows, query]);

  const sections = useMemo(() => {
    const active = filtered.filter((r) => !r.closed);
    const history = filtered.filter((r) => r.closed);
    const activeSecs = groupByEmployer(active, { noneLabel: t('employer_group_none') || 'İşletme atanmamış' });
    if (!history.length) return activeSecs;
    return [
      ...activeSecs,
      {
        key: 'history',
        title: t('agency_chat_history') || 'Süreci sonlanan adaylar',
        data: history,
      },
    ];
  }, [filtered, t]);

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
    return <ActivityIndicator color="#c2a25a" style={{ marginTop: 50 }} />;
  }

  // iOS pencereyi küçültmez; Android genelde resize eder — çift boşluk olmasın.
  const avoidKb = Platform.OS === 'ios' ? kbH : 0;
  const listPad = avoidKb > 0 ? 12 : padBottom;

  return (
    <View style={[styles.wrap, avoidKb > 0 && { paddingBottom: avoidKb }]}>
      <View style={[styles.topBar, (compact || hideIntro) && styles.topBarCompact]}>
        {!hideIntro && !compact ? (
          <>
            <Text style={styles.kicker}>{t('nav_messages')}</Text>
            <Text style={styles.title}>{t('agency_chat_inbox_title') || 'Süreç sohbetleri'}</Text>
            <Text style={styles.lead}>
              {t('agency_chat_inbox_lead') || 'Sözleşme aşamasından sonra adaylarla açılan mesajlar burada.'}
            </Text>
          </>
        ) : null}
        <View style={[styles.searchBox, (compact || hideIntro) && styles.searchBoxCompact]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('agency_chat_search_ph') || 'İsim veya aday no ile ara'}
            placeholderTextColor="#7a8796"
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
      </View>

      <SectionList
        style={styles.list}
        sections={displaySections}
        keyExtractor={(th) => th.candidateId}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor="#c2a25a" />}
        contentContainerStyle={[styles.content, { paddingBottom: listPad }]}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {searching
                ? (t('agency_chat_search_empty') || 'Sonuç bulunamadı')
                : (t('agency_chat_empty') || 'Henüz sohbet yok')}
            </Text>
            <Text style={styles.emptySub}>
              {searching
                ? (t('agency_chat_search_empty_sub') || 'Başka bir isim veya kod deneyin.')
                : (t('agency_chat_empty_sub') || 'Sözleşme adımı açılınca buradan yazışabilirsiniz.')}
            </Text>
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
              {section.title}
            </Text>
            {section._unread > 0 ? (
              <Text style={styles.secUnread}>{section._unread}</Text>
            ) : null}
            <Text style={styles.secN}>{section._count}</Text>
          </TouchableOpacity>
        )}
        renderItem={({ item: th, section }) => {
          const p = th.profile;
          const code = candidateCode(p.nationality, p.reg_no);
          const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
          const flag = NATION_FLAG[p.nationality];
          const unread = !th.closed && th.count > 0;
          const hist = section.key === 'history' || th.closed;
          const name = maskedName(p.data);
          return (
            <TouchableOpacity
              style={[styles.row, unread && styles.rowUnread, hist && styles.rowHistory]}
              onPress={() => { Keyboard.dismiss(); onOpen?.(p); }}
              activeOpacity={0.88}
            >
              <View style={styles.avatar}>
                {photo ? <Image source={{ uri: photo }} style={styles.avatarImg} /> : <Text style={styles.ph}>👤</Text>}
                {unread ? (
                  <View style={styles.unreadDot}>
                    <Text style={styles.unreadN}>{th.count > 9 ? '9+' : th.count}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.main}>
                <View style={styles.top}>
                  <Text style={[styles.code, unread && styles.codeHot, hist && styles.codeMuted]} numberOfLines={1}>
                    {name ? `${name} · ${code}` : code}
                  </Text>
                  <Text style={styles.ago}>{ago(th.lastAt, t)}</Text>
                </View>
                <View style={styles.sub}>
                  {flag ? <Image source={flag} style={styles.flag} /> : null}
                  <Text style={styles.subText} numberOfLines={1}>
                    {hist
                      ? (t('agency_chat_ended') || 'Süreç sonlandı · arşiv')
                      : `${p.nationality || '—'}${unread ? ` · ${th.count} ${t('agency_chat_new') || 'yeni'}` : ''}`}
                  </Text>
                </View>
              </View>
              <Text style={styles.go}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const GOLD = '#c2a25a';
const NAVY = '#000b18';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  topBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: NAVY },
  topBarCompact: { paddingTop: 4, paddingBottom: 6 },
  list: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, flexGrow: 1 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: GOLD, marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  lead: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#9fb0c4', lineHeight: 18 },
  searchBox: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0a1524', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(90,130,170,0.28)',
  },
  searchBoxCompact: { marginTop: 0 },
  searchIcon: { fontSize: 16, color: GOLD, fontWeight: '700' },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff', padding: 0 },
  searchClear: { fontSize: 16, color: '#7a8796', fontWeight: '700', paddingHorizontal: 4 },
  searchDone: { fontSize: 14, fontWeight: '800', color: GOLD, paddingHorizontal: 4 },
  secHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: '#0a1524', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(194,162,90,0.28)',
  },
  secHeadHistory: { marginTop: 18, borderColor: 'rgba(90,130,170,0.22)' },
  secChevron: { fontSize: 14, fontWeight: '800', color: GOLD, width: 14 },
  secTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#e8eef6', letterSpacing: 0.2 },
  secTitleHistory: { color: '#9fb0c4' },
  secUnread: {
    minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    backgroundColor: '#d24b40', overflow: 'hidden',
    fontSize: 11, fontWeight: '800', color: '#fff', textAlign: 'center',
  },
  secN: {
    minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(194,162,90,0.18)', overflow: 'hidden',
    fontSize: 11, fontWeight: '800', color: GOLD, textAlign: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0a1524',
    borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(90,130,170,0.28)',
  },
  rowUnread: { borderColor: 'rgba(210,75,64,0.55)', backgroundColor: 'rgba(210,75,64,0.12)' },
  rowHistory: { opacity: 0.72 },
  avatar: { width: 48, height: 48, borderRadius: 14, overflow: 'visible', backgroundColor: '#071019', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 14 },
  ph: { fontSize: 20 },
  unreadDot: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: NAVY,
  },
  unreadN: { color: '#fff', fontSize: 10, fontWeight: '800' },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  code: { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff' },
  codeHot: { color: '#f0c0b8' },
  codeMuted: { color: '#9fb0c4' },
  ago: { fontSize: 11, fontWeight: '600', color: '#7a8796' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  flag: { width: 16, height: 11, borderRadius: 2 },
  subText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#9fb0c4' },
  go: { fontSize: 22, fontWeight: '300', color: GOLD },
  empty: {
    alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(90,130,170,0.35)',
    borderRadius: 18, marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#9fb0c4', textAlign: 'center' },
});
