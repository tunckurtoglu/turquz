import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Keyboard, Alert } from 'react-native';
import {
  addDeskNote, addEmployerNote, formatNoteDate,
  listDeskNotes, listEmployerNotes, removeDeskNote, removeEmployerNote,
} from '../lib/agencyNotes';
import { useLanguage } from '../i18n/LanguageContext';

const PAPER = ['#fff6c8', '#ffe8c2', '#eef6c9', '#fde8d4'];

/**
 * @param {string} [employerId] — verilirse otel notları; yoksa Bugün masası notları
 * @param {boolean} [compact] — favori sheet içinde daha sıkı boşluk
 */
export default function AgencyDeskNotes({ agencyId, employerId = null, compact = false, dark = false, onComposerFocus }) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const hotelMode = !!employerId;

  const load = useCallback(async () => {
    if (!agencyId) return;
    if (hotelMode) setNotes(await listEmployerNotes(agencyId, employerId));
    else setNotes(await listDeskNotes(agencyId));
  }, [agencyId, employerId, hotelMode]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const row = hotelMode
        ? await addEmployerNote(agencyId, employerId, text)
        : await addDeskNote(agencyId, text);
      if (row) {
        setNotes((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
        setDraft('');
        Keyboard.dismiss();
      }
    } catch (e) {
      Alert.alert(
        hotelMode ? (t('fav_hotel_notes_title') || 'Otel notları') : (t('ops_notes_title') || 'Not defteri'),
        e?.message || t('ops_notes_err') || 'Not kaydedilemedi.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      if (hotelMode) await removeEmployerNote(agencyId, employerId, id);
      else await removeDeskNote(agencyId, id);
    } catch (e) {
      console.warn('remove note:', e?.message);
      load();
    }
  };

  const canAdd = !!draft.trim() && !saving;
  const boxRef = useRef(null);
  const focusBox = () => onComposerFocus?.(boxRef.current);

  const title = hotelMode
    ? (t('fav_hotel_notes_title') || 'Otel notları')
    : (t('ops_notes_title') || 'Not defteri');
  const ph = hotelMode
    ? (t('fav_hotel_notes_ph') || 'Kontenjan, görüşme notu…')
    : (t('ops_notes_ph') || 'Unutmamanız gerekeni yazın…');
  const empty = hotelMode
    ? (t('fav_hotel_notes_empty') || 'Bu otel için henüz not yok.')
    : (t('ops_notes_empty') || 'Yapışkan not yok — buraya yazın, önünüzde kalsın.');

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.kicker, dark && styles.kickerDark]}>{title}</Text>

      <View ref={boxRef} collapsable={false} style={styles.composer}>
        <TextInput
          style={[styles.input, compact && styles.inputCompact, dark && styles.inputDark]}
          value={draft}
          onChangeText={setDraft}
          placeholder={ph}
          placeholderTextColor={dark ? '#5a6578' : '#9aa3b0'}
          multiline
          maxLength={400}
          onFocus={focusBox}
        />
        <Pressable
          onPress={add}
          disabled={!canAdd}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addBtn, dark && styles.addBtnDark,
            !canAdd && styles.addBtnOff, pressed && canAdd && styles.addBtnPressed,
          ]}
        >
          <Text style={[styles.addBtnText, dark && styles.addBtnTextDark]}>{saving ? '…' : (t('ops_notes_add') || 'Ekle')}</Text>
        </Pressable>
      </View>

      {notes.length === 0 ? (
        <Text style={[styles.hint, dark && styles.hintDark]}>{empty}</Text>
      ) : notes.map((n, i) => (
        <View key={n.id} style={[styles.paper, { backgroundColor: PAPER[i % PAPER.length] }]}>
          <View style={styles.paperTop}>
            <Text style={styles.when}>{formatNoteDate(n.created_at)}</Text>
            <Pressable onPress={() => remove(n.id)} hitSlop={10} style={styles.xBtn}>
              <Text style={styles.x}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>{n.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, paddingTop: 4 },
  wrapCompact: { marginTop: 4, marginBottom: 8, paddingTop: 0 },
  kicker: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase',
    color: '#8f7130', marginBottom: 10,
  },
  kickerDark: { color: '#A89468' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 90, backgroundColor: '#fffdf8',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(20,32,51,0.08)',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: '#142033',
    marginRight: 8,
  },
  inputDark: {
    backgroundColor: '#1a2438', borderColor: 'rgba(168,148,104,0.28)', color: '#fff',
  },
  inputCompact: { minHeight: 40, maxHeight: 72, fontSize: 13.5 },
  addBtn: {
    backgroundColor: '#142033', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  addBtnDark: { backgroundColor: '#C8B88E' },
  addBtnOff: { opacity: 0.35 },
  addBtnPressed: { opacity: 0.75 },
  addBtnText: { color: '#f5ecda', fontWeight: '800', fontSize: 13 },
  addBtnTextDark: { color: '#2A2418' },
  hint: { fontSize: 12, fontWeight: '600', color: '#6e7684', lineHeight: 17, marginBottom: 6 },
  hintDark: { color: '#8E98A8' },
  paper: {
    borderRadius: 4, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(184,149,74,0.22)',
  },
  paperTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  when: { fontSize: 11, fontWeight: '700', color: '#9a7b1f' },
  xBtn: { padding: 2 },
  x: { fontSize: 14, fontWeight: '800', color: '#a67c52' },
  body: { fontSize: 14, fontWeight: '600', color: '#2a2418', lineHeight: 20 },
});
