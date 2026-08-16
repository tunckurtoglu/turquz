// components/NotificationBell.js
// Zil ikonu + okunmamış rozeti + bildirim listesi. Hem aday hem acente ekranında kullanılır.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listNotifications, unreadCount, markAllRead } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { candidateCode } from '../lib/candidateCode';
import { slotLabel } from '../lib/interviews';
import AnnouncementSheet from './AnnouncementSheet';
import { announcementText } from '../lib/announcementI18n';

const INK = '#1b2533';
const GOLD = '#c2a25a';

// Tür başına ikon + renk (rozet). Bilinmeyen tür için default.
const META = {
  offer: { icon: '📩', bg: '#e7ecf3', fg: '#1f3a63' },
  offer_accepted: { icon: '✓', bg: '#e7f3ec', fg: '#1f8a4c' },
  offer_rejected: { icon: '✕', bg: '#fbeae8', fg: '#b5413a' },
  accepted: { icon: '🎉', bg: '#f3ecdc', fg: '#9a7b1f' },
  document: { icon: '📄', bg: '#e7ecf3', fg: '#1f3a63' },
  docs_deadline: { icon: '⏰', bg: '#fbeae8', fg: '#b5413a' },
  docs_extra: { icon: '⏳', bg: '#fbf0db', fg: '#c98a1e' },
  reupload: { icon: '🔄', bg: '#fbf0db', fg: '#c98a1e' },
  interview: { icon: '🎥', bg: '#f3ecdc', fg: '#9a7b1f' },
  interview_proposed: { icon: '🎥', bg: '#f3ecdc', fg: '#9a7b1f' },
  interview_scheduled: { icon: '🎥', bg: '#f3ecdc', fg: '#9a7b1f' },
  interview_declined: { icon: '✕', bg: '#fbeae8', fg: '#b5413a' },
  interview_no_response: { icon: '⏳', bg: '#fbf0db', fg: '#c98a1e' },
  interview_respond_remind: { icon: '⏰', bg: '#fbf0db', fg: '#c98a1e' },
  pool_passive: { icon: '⏸', bg: '#f1f3f6', fg: '#5b6575' },
  chat_message: { icon: '💬', bg: '#e7ecf3', fg: '#1f3a63' },
  announcement: { icon: '📢', bg: '#f3ecdc', fg: '#9a7b1f' },
  employment_end_requested: { icon: '🚪', bg: '#fbeae8', fg: '#b5413a' },
  employment_end_requested_ack: { icon: '🚪', bg: '#fbf0db', fg: '#c98a1e' },
  employment_end_undone: { icon: '↩', bg: '#e7f3ec', fg: '#1f8a4c' },
  employment_disputed: { icon: '⚖️', bg: '#fbf0db', fg: '#c98a1e' },
  employment_completed: { icon: '🏅', bg: '#f3ecdc', fg: '#9a7b1f' },
  employment_early_exit: { icon: '🚪', bg: '#f1f3f6', fg: '#5b6575' },
  employment_continued: { icon: '✓', bg: '#e7f3ec', fg: '#1f8a4c' },
  employment_end_remind: { icon: '⏰', bg: '#fbf0db', fg: '#c98a1e' },
  flight_ticket_ready: { icon: '✈️', bg: '#e7ecf3', fg: '#1f3a63' },
  flight_ticket_sent: { icon: '✈️', bg: '#e7f3ec', fg: '#1f8a4c' },
  employment_started: { icon: '🏨', bg: '#e7f3ec', fg: '#1f8a4c' },
  work_start_confirm: { icon: '❓', bg: '#fbf0db', fg: '#c98a1e' },
  work_start_remind: { icon: '⏰', bg: '#fbf0db', fg: '#c98a1e' },
  boarding_check: { icon: '🛫', bg: '#f3ecdc', fg: '#9a7b1f' },
  boarding_confirmed: { icon: '✓', bg: '#e7f3ec', fg: '#1f8a4c' },
  boarding_missed: { icon: '⚠️', bg: '#fbeae8', fg: '#b5413a' },
  boarding_no_response: { icon: '⏰', bg: '#fbf0db', fg: '#c98a1e' },
  pickup: { icon: '🤝', bg: '#e7ecf3', fg: '#1f3a63' },
  default: { icon: '🔔', bg: '#f3ecdc', fg: '#9a7b1f' },
};
const metaOf = (type) => META[type] || META.default;

function BellIcon({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StopwatchIcon({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13.2" r="7.2" stroke={color} strokeWidth="1.8" />
      <Path d="M12 13.2V9.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 3.6h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 3.6v2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M17.6 7.2l1.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// Bildirimin geldiği tarih-saat (sabit; cihaz yerel saati).
const fmt = (iso) => {
  const dt = new Date(iso);
  if (isNaN(dt)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

function notifText(n, t, lang) {
  const p = n.payload || {};
  if (n.type === 'announcement') {
    const { title: rawTitle, body } = announcementText(p, lang);
    const title = rawTitle || t('notif_announcement');
    // Listede özet; tam metin AnnouncementSheet'te.
    if (!body) return title;
    const short = body.length > 90 ? `${body.slice(0, 87)}…` : body;
    return `${title}\n${short}`;
  }
  // document: user_id === ref_user → acente adaya gönderdi; aksi halde aday acenteye yükledi.
  if (n.type === 'document') {
    if (n.ref_user && n.user_id && n.ref_user === n.user_id) return t('notif_document_for_you');
    return t('notif_document');
  }
  if (n.type === 'interview_scheduled') {
    const code = candidateCode(p.nationality, p.reg_no);
    const slot = p.slot ? slotLabel(p.slot, lang) : '';
    if (slot) return t('notif_interview_scheduled_detail').replace('{code}', code).replace('{slot}', slot);
  }
  if (n.type === 'interview_declined') {
    const code = candidateCode(p.nationality, p.reg_no);
    if (code && !code.endsWith('----')) return t('notif_interview_declined_detail').replace('{code}', code);
  }
  if (n.type === 'interview_no_response') {
    const code = candidateCode(p.nationality, p.reg_no);
    const hours = p.hours != null ? String(p.hours) : '48';
    if (code && !code.endsWith('----')) {
      return t('notif_interview_no_response_detail').replace('{code}', code).replace('{hours}', hours);
    }
    return (t('notif_interview_no_response') || '') + (hours ? ` (${hours}s)` : '');
  }
  return t(`notif_${n.type}`);
}

export default function NotificationBell({ userId, color = '#cbd2db', onNavigate, footerLabel, excludeChat = false, excludeAnnouncement = false, footerIcon = 'bell' }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [announcement, setAnnouncement] = useState(null);

  const excludeTypes = [
    ...(excludeChat ? ['chat_message'] : []),
    ...(excludeAnnouncement ? ['announcement'] : []),
  ];

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [list, n] = await Promise.all([
      listNotifications(userId),
      unreadCount(userId, { excludeTypes }),
    ]);
    const filtered = list.filter((x) => !excludeTypes.includes(x.type));
    setItems(filtered);
    setUnread(n);
  }, [userId, excludeChat, excludeAnnouncement]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refresh]);

  const openSheet = async () => {
    setOpen(true);
    if (unread > 0) {
      await markAllRead(userId, { excludeTypes });
      setUnread(0);
      setItems((p) => p.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    }
  };

  const FooterGlyph = footerIcon === 'stopwatch' ? StopwatchIcon : BellIcon;

  return (
    <>
      {footerLabel ? (
        <TouchableOpacity style={styles.footerTab} onPress={openSheet} activeOpacity={0.85}>
          <View style={styles.footerIconWrap}>
            <FooterGlyph color={color} size={20} />
            {unread > 0 ? (
              <View style={styles.footerBadge}>
                <Text style={styles.footerBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{footerLabel}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={openSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <BellIcon color={color} />
          {unread > 0 ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
          ) : null}
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.popover, { top: insets.top + 50 }]} onPress={() => {}}>
            <View style={styles.popHeader}>
              <Text style={styles.popTitle}>{t('notif_title')}</Text>
              <View style={styles.popRule} />
            </View>
            <ScrollView style={styles.popList} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
              {items.length ? items.map((n) => {
                const m = metaOf(n.type);
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.row, !n.read_at && styles.rowUnread]}
                    onPress={() => {
                      setOpen(false);
                      if (n.type === 'announcement') {
                        setAnnouncement({
                          payload: n.payload || {},
                          createdAt: n.created_at,
                        });
                        return;
                      }
                      onNavigate?.(n);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBadge, { backgroundColor: m.bg }]}>
                      <Text style={[styles.iconText, { color: m.fg }]}>{m.icon}</Text>
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowText} numberOfLines={n.type === 'announcement' ? 3 : 3}>{notifText(n, t, lang)}</Text>
                      <Text style={styles.rowTime}>{fmt(n.created_at)}</Text>
                    </View>
                    {!n.read_at ? <View style={styles.unreadDot} /> : null}
                    <Text style={styles.rowChevron}>›</Text>
                  </TouchableOpacity>
                );
              }) : (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIcon}><BellIcon color="#cbb88a" size={28} /></View>
                  <Text style={styles.empty}>{t('notif_empty')}</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AnnouncementSheet
        visible={!!announcement}
        announcement={announcement}
        onClose={() => setAnnouncement(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', top: -6, right: -8, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  footerTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  footerIconWrap: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
  },
  footerBadge: {
    position: 'absolute', top: -2, right: -6, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#111820',
  },
  footerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  footerLabel: { fontSize: 11, fontWeight: '800', color: '#e7dcc4', letterSpacing: 0.3 },

  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.18)' },
  popover: {
    position: 'absolute', right: 10, width: 304, maxHeight: 440, backgroundColor: '#fbf8f1', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#0c1320', shadowOpacity: 0.28, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10,
  },
  popHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: '#fff' },
  popTitle: { fontSize: 15.5, fontWeight: '800', color: INK, letterSpacing: 0.2 },
  popRule: { width: 34, height: 2.5, borderRadius: 2, backgroundColor: GOLD, marginTop: 8 },
  popList: { maxHeight: 376 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#f0ece1' },
  rowUnread: { backgroundColor: '#fbf4e4' },
  iconBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 17, fontWeight: '800' },
  rowBody: { flex: 1 },
  rowText: { fontSize: 13.5, color: INK, fontWeight: '600', lineHeight: 18 },
  rowTime: { fontSize: 11, color: '#a79f8d', fontWeight: '600', marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD, marginLeft: 4 },
  rowChevron: { color: '#c9bfa6', fontSize: 22, fontWeight: '700', marginLeft: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 14 },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#f3ecdc', alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#a79f8d', fontSize: 13.5, fontWeight: '600' },
});
