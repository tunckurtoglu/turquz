// Belge süre hatırlatıcıları — aday footer “Hatırlatıcı”.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getCandidateStatus, passportDeadline, formatDeadlineRemain, docsUnlocked } from '../lib/candidate';
import { listDocuments } from '../lib/documents';
import { supabase } from '../lib/supabase';

const NAVY = '#000b18';
const GOLD = '#c2a25a';
const PKG = ['passport', 'diploma', 'criminal', 'health_report'];

function StopwatchIcon({ color = GOLD, size = 22 }) {
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

/** Aktif belge sürelerini topla (şimdilik adım 1 paketi; yapı genişlemeye uygun). */
export async function loadDocReminders(userId) {
  if (!userId) return [];
  const [status, rows] = await Promise.all([
    getCandidateStatus(userId),
    listDocuments(userId),
  ]);
  if (!status || !(docsUnlocked(status) || status.status === 'accepted')) return [];
  const has = (k) => (rows || []).some((r) => r.kind === k && r.submitted_at);
  const pkgDone = PKG.every(has);
  const dl = passportDeadline(status);
  if (!dl || pkgDone) return [];
  return [{
    id: 'docs_pkg',
    titleKey: 'remind_docs_pkg',
    subKey: 'remind_docs_pkg_sub',
    endAt: dl.end.getTime(),
    overdue: dl.overdue,
    step: 1,
  }];
}

export default function RemindersSheet({ visible, onClose, userId, onOpenDocs }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [now, setNow] = useState(Date.now());
  const blink = useRef(new Animated.Value(1)).current;

  const refresh = useCallback(async () => {
    const list = await loadDocReminders(userId);
    setItems(list);
  }, [userId]);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  useEffect(() => {
    if (!visible || !userId) return undefined;
    const ch = supabase
      .channel(`reminders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_status', filter: `user_id=eq.${userId}` }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents', filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visible, userId, refresh]);

  useEffect(() => {
    if (!visible || !items.length) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, items.length]);

  useEffect(() => {
    if (!visible || !items.length) {
      blink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 550, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, items.length, blink]);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle}>{t('remind_sheet_title')}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {items.length ? (
            <View style={styles.panel}>
              {items.map((it, idx) => {
                const left = it.endAt - now;
                const overdue = left <= 0;
                const last = idx === items.length - 1;
                return (
                  <TouchableOpacity
                    key={it.id}
                    style={[styles.row, !last && styles.rowBorder, overdue && styles.rowOver]}
                    onPress={() => {
                      onClose?.();
                      onOpenDocs?.({ scrollToStep: it.step });
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.iconCol}>
                      <View style={[styles.iconWrap, overdue && styles.iconOver]}>
                        <StopwatchIcon color={overdue ? '#e85a4f' : GOLD} size={20} />
                      </View>
                      <Animated.View style={[styles.warnDot, { opacity: blink }]} />
                    </View>
                    <View style={styles.mid}>
                      <Text style={styles.title}>{t(it.titleKey)}</Text>
                      <Text style={styles.sub}>{t(it.subKey)}</Text>
                      <Text style={[styles.clock, overdue && styles.clockOver]}>
                        {overdue ? t('deadline_overdue_short') : formatDeadlineRemain(left, t)}
                      </Text>
                      <Text style={styles.openHint}>{t('remind_open_docs')} ›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><StopwatchIcon size={28} color="#cbb88a" /></View>
              <Text style={styles.emptyText}>{t('remind_empty')}</Text>
            </View>
          )}
        </ScrollView>
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
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 16, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(194,162,90,0.22)' },
  rowOver: { backgroundColor: 'rgba(232,90,79,0.08)' },
  iconCol: { alignItems: 'center', gap: 8, paddingTop: 2 },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(194,162,90,0.12)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconOver: { backgroundColor: 'rgba(232,90,79,0.15)', borderColor: 'rgba(232,90,79,0.45)' },
  warnDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#e03b30',
  },
  mid: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  sub: { color: '#8fa3bb', fontSize: 12.5, fontWeight: '500', marginTop: 4, lineHeight: 17 },
  clock: { color: GOLD, fontSize: 15, fontWeight: '800', marginTop: 10, lineHeight: 22 },
  clockOver: { color: '#e85a4f' },
  openHint: { color: '#cbb88a', fontSize: 12.5, fontWeight: '700', marginTop: 8 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(194,162,90,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: '#9fb0c4', fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
});
