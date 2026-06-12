// components/TranscriptModal.js
// Mülakat konuşma kaydını (transkript) gösterir. Her satır: konuşmacı + metin.
// İzleyenin dilinde gösterir; orijinali de küçük olarak altta verir.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getTranscript } from '../lib/transcripts';

const INK = '#1b2533';
const GOLD = '#c2a25a';

const fmtTime = (iso) => {
  const dt = new Date(iso);
  if (isNaN(dt)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function TranscriptModal({ visible, candidateUserId, candidateLabel, onClose }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await getTranscript(candidateUserId));
    setLoading(false);
  }, [candidateUserId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const whoLabel = (role) => (role === 'agency' ? t('role_agency') : (candidateLabel || t('role_candidate')));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.title}>{t('transcript_title')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.close}>✕</Text></TouchableOpacity>
        </View>
        <View style={styles.accent} />
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 30 }} />
          ) : rows.length ? (
            rows.map((r) => {
              const translated = r.translations && r.translations[lang];
              const main = translated || r.text_original;
              const showOrig = translated && r.text_original && translated !== r.text_original;
              const agency = r.speaker_role === 'agency';
              return (
                <View key={r.id} style={[styles.line, agency ? styles.lineAgency : styles.lineCand]}>
                  <View style={styles.lineHead}>
                    <Text style={[styles.who, { color: agency ? '#9a7b1f' : '#1f7d96' }]}>{whoLabel(r.speaker_role)}</Text>
                    <Text style={styles.time}>{fmtTime(r.created_at)}</Text>
                  </View>
                  <Text style={styles.text}>{main}</Text>
                  {showOrig ? <Text style={styles.orig}>{r.text_original}</Text> : null}
                </View>
              );
            })
          ) : (
            <Text style={styles.empty}>{t('transcript_empty')}</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: INK },
  close: { fontSize: 20, color: INK, fontWeight: '700' },
  accent: { height: 2.5, backgroundColor: GOLD },
  content: { padding: 16 },
  line: { backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 10, borderWidth: 0.5, borderColor: '#e6e8ec', borderLeftWidth: 3 },
  lineAgency: { borderLeftColor: GOLD },
  lineCand: { borderLeftColor: '#1f7d96' },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  who: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  time: { fontSize: 11, color: '#9aa1ac', fontWeight: '600' },
  text: { fontSize: 14.5, color: INK, fontWeight: '500', lineHeight: 20 },
  orig: { fontSize: 12, color: '#9aa1ac', fontStyle: 'italic', marginTop: 4, lineHeight: 17 },
  empty: { textAlign: 'center', color: '#9aa1ac', fontSize: 15, marginTop: 40 },
});
