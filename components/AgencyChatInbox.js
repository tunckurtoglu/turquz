import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { listAgencyChatThreads } from '../lib/ops';
import { groupByEmployer } from '../lib/employerAttach';
import { candidateCode } from '../lib/candidateCode';
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

export default function AgencyChatInbox({ agencyId, onOpen, padBottom = 24, onBadgeChange }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!agencyId) return;
    setBusy(true);
    try {
      const list = await listAgencyChatThreads(agencyId, 120);
      setRows(list);
      const unread = list.reduce((n, th) => n + (th.count || 0), 0);
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

  const sections = useMemo(
    () => groupByEmployer(rows || [], { noneLabel: t('employer_group_none') || 'İşletme atanmamış' }),
    [rows, t],
  );

  if (rows == null) {
    return <ActivityIndicator color="#b8954a" style={{ marginTop: 50 }} />;
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(th) => th.candidateId}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor="#b8954a" />}
      contentContainerStyle={[styles.content, { paddingBottom: padBottom }]}
      ListHeaderComponent={(
        <View style={styles.head}>
          <Text style={styles.kicker}>{t('nav_messages')}</Text>
          <Text style={styles.title}>{t('agency_chat_inbox_title') || 'Süreç sohbetleri'}</Text>
          <Text style={styles.lead}>
            {t('agency_chat_inbox_lead') || 'Sözleşme aşamasından sonra adaylarla açılan mesajlar burada.'}
          </Text>
        </View>
      )}
      ListEmptyComponent={(
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('agency_chat_empty') || 'Henüz sohbet yok'}</Text>
          <Text style={styles.emptySub}>
            {t('agency_chat_empty_sub') || 'Sözleşme adımı açılınca buradan yazışabilirsiniz.'}
          </Text>
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.secHead}>
          <Text style={styles.secTitle} numberOfLines={1}>{section.title}</Text>
          <Text style={styles.secN}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item: th }) => {
        const p = th.profile;
        const code = candidateCode(p.nationality, p.reg_no);
        const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
        const flag = NATION_FLAG[p.nationality];
        const unread = th.count > 0;
        return (
          <TouchableOpacity
            style={[styles.row, unread && styles.rowUnread]}
            onPress={() => onOpen?.(p)}
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
                <Text style={[styles.code, unread && styles.codeHot]}>{code}</Text>
                <Text style={styles.ago}>{ago(th.lastAt, t)}</Text>
              </View>
              <View style={styles.sub}>
                {flag ? <Image source={flag} style={styles.flag} /> : null}
                <Text style={styles.subText} numberOfLines={1}>
                  {p.nationality || '—'}
                  {unread ? ` · ${th.count} ${t('agency_chat_new') || 'yeni'}` : ''}
                </Text>
              </View>
            </View>
            <Text style={styles.go}>›</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const INK = '#142033';
const GOLD = '#b8954a';

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  head: { marginBottom: 14 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', color: '#8f7130', marginBottom: 6 },
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  lead: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#6e7684', lineHeight: 18 },
  secHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginTop: 10, marginBottom: 8, paddingHorizontal: 4,
  },
  secTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: INK, letterSpacing: 0.2 },
  secN: {
    minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: 'rgba(184,149,74,0.18)', overflow: 'hidden',
    fontSize: 11, fontWeight: '800', color: '#8f7130', textAlign: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fffdf8',
    borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(20,32,51,0.07)',
  },
  rowUnread: { borderColor: 'rgba(180,35,24,0.35)', backgroundColor: '#fff8f6' },
  avatar: { width: 48, height: 48, borderRadius: 14, overflow: 'visible', backgroundColor: '#ebe4d6', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 14 },
  ph: { fontSize: 20 },
  unreadDot: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#fff',
  },
  unreadN: { color: '#fff', fontSize: 10, fontWeight: '800' },
  main: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  code: { fontSize: 15, fontWeight: '800', color: INK },
  codeHot: { color: '#b42318' },
  ago: { fontSize: 11, fontWeight: '600', color: '#9aa3b0' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  flag: { width: 16, height: 11, borderRadius: 2 },
  subText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: '#6e7684' },
  go: { fontSize: 22, fontWeight: '300', color: '#8f7130' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(20,32,51,0.15)', borderRadius: 18, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: INK },
  emptySub: { marginTop: 6, fontSize: 13, color: '#6e7684', textAlign: 'center' },
});
