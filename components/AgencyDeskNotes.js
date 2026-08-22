import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Keyboard, Alert } from 'react-native';
import { addDeskNote, formatNoteDate, listDeskNotes, removeDeskNote } from '../lib/agencyNotes';
import { useLanguage } from '../i18n/LanguageContext';

const PAPER = ['#fff6c8', '#ffe8c2', '#eef6c9', '#fde8d4'];

export default function AgencyDeskNotes({ agencyId, onComposerFocus }) {
  const { t } = useLanguage();
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!agencyId) return;
    setNotes(await listDeskNotes(agencyId));
  }, [agencyId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const row = await addDeskNote(agencyId, text);
      if (row) {
        setNotes((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
        setDraft('');
        Keyboard.dismiss();
      }
    } catch (e) {
      Alert.alert(t('ops_notes_title') || 'Not defteri', e?.message || t('ops_notes_err') || 'Not kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await removeDeskNote(agencyId, id);
    } catch (e) {
      console.warn('remove note:', e?.message);
      load();
    }
  };

  const canAdd = !!draft.trim() && !saving;
  const boxRef = useRef(null);

  const focusBox = () => onComposerFocus?.(boxRef.current);

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{t('ops_notes_title') || 'Not defteri'}</Text>

      <View ref={boxRef} collapsable={false} style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('ops_notes_ph') || 'Unutmamanız gerekeni yazın…'}
          placeholderTextColor="#9aa3b0"
          multiline
          maxLength={400}
          onFocus={focusBox}
        />
        <Pressable
          onPress={add}
          disabled={!canAdd}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, !canAdd && styles.addBtnOff, pressed && canAdd && styles.addBtnPressed]}
        >
          <Text style={styles.addBtnText}>{saving ? '…' : (t('ops_notes_add') || 'Ekle')}</Text>
        </Pressable>
      </View>

      {notes.length === 0 ? (
        <Text style={styles.hint}>{t('ops_notes_empty') || 'Yapışkan not yok — buraya yazın, önünüzde kalsın.'}</Text>
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
  kicker: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase',
    color: '#8f7130', marginBottom: 10,
  },
  composer: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 90, backgroundColor: '#fffdf8',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(20,32,51,0.08)',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontWeight: '600', color: '#142033',
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: '#142033', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  addBtnOff: { opacity: 0.35 },
  addBtnPressed: { opacity: 0.75 },
  addBtnText: { color: '#f5ecda', fontWeight: '800', fontSize: 13 },
  hint: { fontSize: 12, fontWeight: '600', color: '#6e7684', lineHeight: 17, marginBottom: 6 },
  paper: {
    borderRadius: 4, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(184,149,74,0.22)',
  },
  paperTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  when: { fontSize: 11, fontWeight: '700', color: '#8f7130', letterSpacing: 0.2 },
  xBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 15, fontWeight: '700', color: '#8a7a5a' },
  body: { fontSize: 15, fontWeight: '600', color: '#2a2418', lineHeight: 21 },
});
