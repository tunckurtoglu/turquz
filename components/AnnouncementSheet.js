// Duyuru okuma ekranı — uzun metinleri rahat okumak için.
import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { announcementText } from '../lib/announcementI18n';

const INK = '#1b2533';
const GOLD = '#c2a25a';

const fmt = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function AnnouncementSheet({ visible, announcement, onClose }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const pack = announcementText(announcement?.payload || announcement, lang);
  const title = pack.title || t('notif_announcement');
  const body = pack.body;
  const when = announcement?.createdAt ? fmt(announcement.createdAt) : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{t('notif_announcement')}</Text>
            <Text style={styles.headTitle} numberOfLines={1}>{t('notif_announcement_read')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.done}>{t('close') || 'Kapat'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 36 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeIcon}>📢</Text>
              {when ? <Text style={styles.when}>{when}</Text> : null}
            </View>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.text}>{body}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6e8ec',
  },
  close: { fontSize: 32, color: INK, fontWeight: '700', marginTop: -4, width: 28 },
  kicker: { fontSize: 11, fontWeight: '800', color: GOLD, letterSpacing: 0.6, textTransform: 'uppercase' },
  headTitle: { fontSize: 16, fontWeight: '800', color: INK, marginTop: 1 },
  done: { fontSize: 14, fontWeight: '800', color: '#8a6a1f', paddingHorizontal: 4 },
  body: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#e8e4d8',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badgeIcon: { fontSize: 22 },
  when: { fontSize: 12, fontWeight: '700', color: '#a79f8d' },
  title: { fontSize: 22, fontWeight: '800', color: INK, lineHeight: 28, marginBottom: 14 },
  text: { fontSize: 16, fontWeight: '500', color: '#2a3340', lineHeight: 26 },
});
