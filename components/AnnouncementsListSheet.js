// Duyuru listesi — aday footer “Duyurular”.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listAnnouncementNotifications, markAnnouncementsRead } from '../lib/notifications';
import { markAgencyNoticeRead, listAgencyNotices, listNoticeAudienceBuckets, agencyNoticeFromLabel } from '../lib/agencyNotices';
import NoticeAudienceBuckets from './NoticeAudienceBuckets';
import { supabase } from '../lib/supabase';
import { announcementText } from '../lib/announcementI18n';
import { C } from '../lib/theme';

const NAVY = '#000b18';
const GOLD = '#c2a25a';

function BellIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const fmt = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function AnnouncementsListSheet({ visible, onClose, userId, agencyId, onCompose, onOpenSent, onComposeGroup, reloadAt, embedded = false, contentPadBottom, onRead }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const isHub = !!agencyId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('brief'); // brief | turquz
  const [sent, setSent] = useState([]);
  const [buckets, setBuckets] = useState([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await listAnnouncementNotifications(userId);
      setItems(isHub ? list.filter((n) => n.type === 'announcement') : list);
      await markAnnouncementsRead(userId);
      if (isHub) {
        const [hist, b] = await Promise.all([
          listAgencyNotices(40),
          listNoticeAudienceBuckets(agencyId),
        ]);
        setSent(hist);
        setBuckets(b);
      }
      onRead?.();
    } finally {
      setLoading(false);
    }
  }, [userId, isHub, agencyId, onRead]);

  useEffect(() => {
    if (visible) {
      setDetail(null);
      setTab('brief');
    }
  }, [visible]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, reloadAt, refresh]);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    const ch = supabase
      .channel(`announcements-list-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visible, userId, refresh]);

  const handleClose = () => {
    setDetail(null);
    onClose?.();
  };

  const pack = detail ? announcementText(detail.payload || {}, lang) : null;
  const isAgency = detail?.type === 'agency_notice' || detail?.payload?.from === 'agency';
  const fromLabel = isAgency ? agencyNoticeFromLabel(detail?.payload || {}, t) : '';
  const detailTitle = pack?.title || (isAgency ? fromLabel : t('notif_announcement'));
  const detailBody = pack?.body || '';
  const detailWhen = detail?.createdAt ? fmt(detail.createdAt) : '';
  const detailTone = detail?.payload?.tone;
  const scrollPad = contentPadBottom ?? (insets.bottom + 28);

  if (!embedded && !visible) return null;

  const shell = (
      <View style={[styles.wrap, embedded && styles.wrapEmbedded, embedded && lightStyles.wrap, !embedded && { paddingTop: insets.top + 6 }]}>
      {!embedded ? <StatusBar barStyle="light-content" /> : null}
      <View style={[styles.header, embedded && styles.headerEmbedded, embedded && lightStyles.header]}>
        {!embedded || detail ? (
          <TouchableOpacity
            onPress={detail ? () => setDetail(null) : handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.back, embedded && lightStyles.back]}>‹</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 28 }} />
        )}
        {embedded && !detail ? (
          <View style={{ width: 28 }} />
        ) : (
          <Text style={[styles.headTitle, embedded && lightStyles.headTitle]}>
            {detail ? (isAgency ? fromLabel : t('notif_announcement_read')) : t('home_announcements')}
          </Text>
        )}
        <View style={{ width: 28 }} />
      </View>

        {isHub && !detail ? (
          <View style={[styles.tabs, embedded && lightStyles.tabs]}>
            <TouchableOpacity
              style={[styles.tab, embedded && lightStyles.tab, tab === 'brief' && styles.tabOn]}
              onPress={() => setTab('brief')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, embedded && lightStyles.tabText, tab === 'brief' && styles.tabTextOn, tab === 'brief' && embedded && lightStyles.tabTextOn]}>{t('agency_notice_hub')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, embedded && lightStyles.tab, tab === 'turquz' && styles.tabOn]}
              onPress={() => setTab('turquz')}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, embedded && lightStyles.tabText, tab === 'turquz' && styles.tabTextOn, tab === 'turquz' && embedded && lightStyles.tabTextOn]}>{t('agency_notice_turquz')}</Text>
              {items.some((n) => !n.read_at) ? <View style={styles.tabDot} /> : null}
            </TouchableOpacity>
          </View>
        ) : null}

        {detail ? (
          <ScrollView
            contentContainerStyle={[styles.detailBody, embedded && lightStyles.detailBody, { paddingBottom: scrollPad }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.detailCard, embedded && lightStyles.detailCard]}>
              <View style={styles.badgeRow}>
                <View style={styles.detailBell}><BellIcon size={20} /></View>
                {detailWhen ? <Text style={styles.when}>{detailWhen}</Text> : null}
              </View>
              {isAgency ? (
                <Text style={[styles.agencyKicker, embedded && lightStyles.agencyKicker]}>
                  {fromLabel}
                  {detailTone ? ` · ${t(`agency_notice_tone_${detailTone}`)}` : ''}
                </Text>
              ) : null}
              <Text style={[styles.detailTitle, embedded && lightStyles.detailTitle]}>{detailTitle}</Text>
              {detailBody ? <Text style={[styles.detailText, embedded && lightStyles.detailText]}>{detailBody}</Text> : null}
              {isAgency ? <Text style={[styles.noReply, embedded && lightStyles.noReply]}>{t('agency_notice_no_reply')}</Text> : null}
            </View>
          </ScrollView>
        ) : isHub && tab === 'brief' ? (
          <ScrollView
            contentContainerStyle={[styles.body, embedded && lightStyles.body, { paddingBottom: scrollPad }]}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={[styles.compose, embedded && lightStyles.compose]} onPress={() => onCompose?.()} activeOpacity={0.88}>
              <Text style={[styles.composeText, embedded && lightStyles.composeText]}>{t('agency_notice_new')}</Text>
            </TouchableOpacity>
            <Text style={[styles.hubHint, embedded && lightStyles.hubHint]}>{t('agency_notice_hub_hint')}</Text>
            <NoticeAudienceBuckets
              buckets={buckets}
              mode="send"
              theme={embedded ? 'light' : 'dark'}
              t={t}
              onSendGroup={(b) => onComposeGroup?.(b)}
            />
            {loading && !sent.length ? (
              <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
            ) : sent.length ? (
              <View style={styles.panel}>
                {sent.map((h, idx) => {
                  const last = idx === sent.length - 1;
                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[styles.row, embedded && lightStyles.row, !last && styles.rowBorder]}
                      onPress={() => onOpenSent?.(h)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.mid}>
                        <Text style={[styles.agencyKicker, embedded && lightStyles.agencyKicker]}>{t(`agency_notice_tone_${h.tone || 'info'}`)}</Text>
                        <Text style={[styles.title, embedded && lightStyles.title]} numberOfLines={2}>{h.title}</Text>
                        <Text style={[styles.when, embedded && lightStyles.when]}>
                          {fmt(h.created_at)} · {t('agency_notice_read_n', { a: String(h.readN), b: String(h.sentN) })}
                        </Text>
                      </View>
                      <Text style={[styles.chev, embedded && lightStyles.chev]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.empty, embedded && lightStyles.empty]}>
                <View style={styles.emptyIcon}><BellIcon size={28} color="#cbb88a" /></View>
                <Text style={[styles.emptyText, embedded && lightStyles.emptyText]}>{t('agency_notice_empty_hist')}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.body, embedded && lightStyles.body, { paddingBottom: scrollPad }]}
            showsVerticalScrollIndicator={false}
          >
            {loading && !items.length ? (
              <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
            ) : items.length ? (
                <View style={[styles.panel, embedded && lightStyles.panel]}>
                {items.map((n, idx) => {
                  const { title, body } = announcementText(n.payload || {}, lang);
                  const last = idx === items.length - 1;
                  const agency = n.type === 'agency_notice' || n.payload?.from === 'agency';
                  const unread = !n.read_at;
                  const fromLabelRow = agency ? agencyNoticeFromLabel(n.payload || {}, t) : '';
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.row, embedded && lightStyles.row, !last && styles.rowBorder, unread && styles.rowUnread]}
                      onPress={async () => {
                        setDetail({
                          id: n.id,
                          type: n.type,
                          payload: n.payload || {},
                          createdAt: n.created_at,
                        });
                        if (agency) {
                          const noticeId = n.payload?.notice_id;
                          await markAgencyNoticeRead(noticeId);
                          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x)));
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <View style={styles.iconWrap}><BellIcon size={20} /></View>
                      <View style={styles.mid}>
                        {agency ? <Text style={[styles.agencyKicker, embedded && lightStyles.agencyKicker]}>{fromLabelRow}</Text> : null}
                        <Text style={[styles.title, embedded && lightStyles.title]} numberOfLines={2}>{title || (agency ? fromLabelRow : t('notif_announcement'))}</Text>
                        {body ? <Text style={[styles.sub, embedded && lightStyles.sub]} numberOfLines={2}>{body}</Text> : null}
                        <Text style={[styles.when, embedded && lightStyles.when]}>{fmt(n.created_at)}</Text>
                      </View>
                      <Text style={[styles.chev, embedded && lightStyles.chev]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.empty, embedded && lightStyles.empty]}>
                <View style={styles.emptyIcon}><BellIcon size={28} color="#cbb88a" /></View>
                <Text style={[styles.emptyText, embedded && lightStyles.emptyText]}>{t('notif_empty')}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
  );

  if (embedded) {
    if (!visible) return null;
    return shell;
  }

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={detail ? () => setDetail(null) : handleClose}>
      {shell}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  wrapEmbedded: { backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  headerEmbedded: { paddingTop: 4 },
  back: { color: '#e7dcc4', fontSize: 32, fontWeight: '400', marginTop: -4, width: 28 },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  panel: {
    backgroundColor: '#0a1524', borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,130,170,0.28)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(194,162,90,0.22)' },
  iconWrap: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 20 },
  sub: { color: '#9fb0c4', fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  when: { color: '#7a8796', fontSize: 11.5, fontWeight: '600', marginTop: 6 },
  chev: { color: GOLD, fontSize: 24, fontWeight: '300' },
  agencyKicker: {
    color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
    marginBottom: 4,
  },
  rowUnread: { backgroundColor: 'rgba(194,162,90,0.08)' },
  noReply: { marginTop: 18, fontSize: 13, fontWeight: '600', color: '#7a8796', lineHeight: 19 },
  tabs: {
    flexDirection: 'row', marginHorizontal: 18, marginBottom: 10, padding: 4,
    backgroundColor: '#0a1524', borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,130,170,0.28)',
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabOn: { backgroundColor: GOLD },
  tabText: { color: '#9fb0c4', fontSize: 13, fontWeight: '800' },
  tabTextOn: { color: '#0e141c' },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#d24b40' },
  compose: {
    backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  composeText: { color: '#0e141c', fontSize: 15, fontWeight: '800' },
  hubHint: { color: '#9fb0c4', fontSize: 13, fontWeight: '600', lineHeight: 20, marginBottom: 16 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(194,162,90,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#9fb0c4', fontSize: 14, fontWeight: '600' },

  detailBody: { paddingHorizontal: 18, paddingTop: 8 },
  detailCard: {
    backgroundColor: '#0a1524',
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,130,170,0.28)',
  },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  detailBell: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(194,162,90,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  detailTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28, marginBottom: 14 },
  detailText: { fontSize: 16, fontWeight: '500', color: '#c5d0dc', lineHeight: 26 },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { backgroundColor: C.bg },
  back: { color: C.goldText },
  headTitle: { color: C.ink },
  tabs: { backgroundColor: C.card, borderColor: C.hair },
  tab: { backgroundColor: C.bg },
  tabText: { color: C.ink2 },
  tabTextOn: { color: '#F7F2E8' },
  body: { backgroundColor: C.bg },
  detailBody: { backgroundColor: C.bg },
  panel: { backgroundColor: C.card, borderColor: C.hair },
  row: { backgroundColor: C.card },
  title: { color: C.ink },
  sub: { color: C.ink2 },
  when: { color: C.muted },
  chev: { color: C.goldText },
  agencyKicker: { color: '#8A681E' },
  rowUnread: { backgroundColor: '#FBF6EA' },
  noReply: { color: C.ink2 },
  compose: { backgroundColor: C.ink },
  composeText: { color: '#F7F2E8' },
  hubHint: { color: C.ink2 },
  empty: { backgroundColor: C.bg },
  emptyText: { color: C.ink2 },
  detailCard: { backgroundColor: C.card, borderColor: C.hair },
  detailTitle: { color: C.ink },
  detailText: { color: '#2D3948' },
});
