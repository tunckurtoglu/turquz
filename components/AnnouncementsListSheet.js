// Duyuru listesi — aday footer “Duyurular”.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listAnnouncementNotifications, markAnnouncementsRead } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { announcementText } from '../lib/announcementI18n';

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

export default function AnnouncementsListSheet({ visible, onClose, userId }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const list = await listAnnouncementNotifications(userId);
      setItems(list);
      await markAnnouncementsRead(userId);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) {
      setDetail(null);
      refresh();
    }
  }, [visible, refresh]);

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
  const detailTitle = pack?.title || t('notif_announcement');
  const detailBody = pack?.body || '';
  const detailWhen = detail?.createdAt ? fmt(detail.createdAt) : '';

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={detail ? () => setDetail(null) : handleClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={detail ? () => setDetail(null) : handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle}>
            {detail ? t('notif_announcement_read') : t('home_announcements')}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {detail ? (
          <ScrollView
            contentContainerStyle={[styles.detailBody, { paddingBottom: insets.bottom + 36 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.detailCard}>
              <View style={styles.badgeRow}>
                <View style={styles.detailBell}><BellIcon size={20} /></View>
                {detailWhen ? <Text style={styles.when}>{detailWhen}</Text> : null}
              </View>
              <Text style={styles.detailTitle}>{detailTitle}</Text>
              {detailBody ? <Text style={styles.detailText}>{detailBody}</Text> : null}
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
            showsVerticalScrollIndicator={false}
          >
            {loading && !items.length ? (
              <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
            ) : items.length ? (
              <View style={styles.panel}>
                {items.map((n, idx) => {
                  const { title, body } = announcementText(n.payload || {}, lang);
                  const last = idx === items.length - 1;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[styles.row, !last && styles.rowBorder]}
                      onPress={() => setDetail({ payload: n.payload || {}, createdAt: n.created_at })}
                      activeOpacity={0.85}
                    >
                      <View style={styles.iconWrap}><BellIcon size={20} /></View>
                      <View style={styles.mid}>
                        <Text style={styles.title} numberOfLines={2}>{title || t('notif_announcement')}</Text>
                        {body ? <Text style={styles.sub} numberOfLines={2}>{body}</Text> : null}
                        <Text style={styles.when}>{fmt(n.created_at)}</Text>
                      </View>
                      <Text style={styles.chev}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><BellIcon size={28} color="#cbb88a" /></View>
                <Text style={styles.emptyText}>{t('notif_empty')}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
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
