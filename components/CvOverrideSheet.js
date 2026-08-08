// components/CvOverrideSheet.js
// Acentenin aday CV'sini kendi kopyasında düzenlemesi (yalnızca bu acente görür).
import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function certLine(c) {
  if (typeof c === 'string') return c;
  return [c?.name, c?.institution].filter(Boolean).join(' — ');
}

function ChipList({ items, onChange, placeholder, addLabel }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  };
  return (
    <View style={styles.chipWrap}>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
            <TouchableOpacity onPress={() => onChange(items.filter((x) => x !== item))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.chipX}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <View style={styles.chipInputRow}>
        <TextInput
          style={[styles.input, styles.chipInput]}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor="#9aa1ac"
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.chipAddBtn} onPress={add} activeOpacity={0.85}>
          <Text style={styles.chipAddText}>{addLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ExpList({ items, onChange, t }) {
  const add = () => onChange([...(items || []), { date: '', company: '', position: '' }]);
  const update = (i, patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <View style={styles.expWrap}>
      {(items || []).map((exp, i) => (
        <View key={i} style={styles.expCard}>
          <TouchableOpacity style={styles.expRemove} onPress={() => remove(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.expRemoveText}>✕</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} value={exp.date || ''} onChangeText={(v) => update(i, { date: v })} placeholder="04.2024 – 10.2024" placeholderTextColor="#9aa1ac" />
          <TextInput style={styles.input} value={exp.company || ''} onChangeText={(v) => update(i, { company: v })} placeholder={t('f_company')} placeholderTextColor="#9aa1ac" />
          <TextInput style={styles.input} value={exp.position || ''} onChangeText={(v) => update(i, { position: v })} placeholder={t('f_position')} placeholderTextColor="#9aa1ac" />
        </View>
      ))}
      <TouchableOpacity style={styles.expAddBtn} onPress={add} activeOpacity={0.85}>
        <Text style={styles.expAddText}>{t('add_exp')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Section({ label, changed, onReset, undoLabel, editedLabel, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>{label}</Text>
          {changed ? <View style={styles.editedBadge}><Text style={styles.editedBadgeText}>{editedLabel}</Text></View> : null}
        </View>
        {changed ? (
          <TouchableOpacity onPress={onReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.undoLink}>{undoLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function CvOverrideSheet({ visible, base, overrides, onChange, onClear, onClose, hasOverrides }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';

  const merged = {
    ...base,
    ...overrides,
    certificates: (overrides.certificates
      ?? (base.certificates || []).map(certLine)),
  };

  const set = (patch) => onChange({ ...overrides, ...patch });
  const resetField = (field) => {
    const next = { ...overrides };
    delete next[field];
    onChange(next);
  };
  const fieldChanged = (field) => field in overrides;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t('cv_edit_title')}</Text>
            <Text style={styles.subtitle}>{t('cv_edit_hint')}</Text>
          </View>
          {hasOverrides ? (
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.resetBtn}>{t('cv_edit_reset')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 52 }} />}
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Section label={t('f_title')} changed={fieldChanged('title')} onReset={() => resetField('title')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <TextInput style={styles.input} value={merged.title || ''} onChangeText={(v) => set({ title: v })} placeholderTextColor="#9aa1ac" />
          </Section>

          <Section label={t('sec_profile')} changed={fieldChanged('profile')} onReset={() => resetField('profile')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <TextInput style={[styles.input, styles.inputMulti]} value={merged.profile || ''} onChangeText={(v) => set({ profile: v })} multiline placeholderTextColor="#9aa1ac" />
          </Section>

          <Section label={t('sec_positions')} changed={fieldChanged('positions')} onReset={() => resetField('positions')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <ChipList items={merged.positions || []} onChange={(v) => set({ positions: v })} placeholder="..." addLabel={t('cv_edit_add')} />
          </Section>

          <Section label={t('sec_skills')} changed={fieldChanged('skills')} onReset={() => resetField('skills')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <ChipList items={merged.skills || []} onChange={(v) => set({ skills: v })} placeholder="..." addLabel={t('cv_edit_add')} />
          </Section>

          <Section label={t('sec_certs')} changed={fieldChanged('certificates')} onReset={() => resetField('certificates')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <ChipList items={(merged.certificates || []).map(certLine)} onChange={(v) => set({ certificates: v })} placeholder="..." addLabel={t('cv_edit_add')} />
          </Section>

          <Section label={t('step_experience')} changed={fieldChanged('experience')} onReset={() => resetField('experience')} undoLabel={t('cv_edit_undo')} editedLabel={t('cv_edit_field_tag')}>
            <ExpList items={merged.experience || []} onChange={(v) => set({ experience: v })} t={t} />
          </Section>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.doneText}>{t('passport_info_save')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28 },
  backChevron: { fontSize: 28, color: INK, fontWeight: '300' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  subtitle: { fontSize: 11.5, color: '#888', marginTop: 2, fontWeight: '600', textAlign: 'center' },
  resetBtn: { fontSize: 12, fontWeight: '800', color: '#a32d2d' },
  accent: { height: 2.5, backgroundColor: GOLD },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionLabel: { fontSize: 13.5, fontWeight: '800', color: INK },
  editedBadge: { backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  editedBadgeText: { fontSize: 10, fontWeight: '800', color: INK },
  undoLink: { fontSize: 12, fontWeight: '700', color: '#a32d2d' },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe2e7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: INK,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  chipWrap: { gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eef0f4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: INK },
  chipX: { fontSize: 12, color: '#888', fontWeight: '700' },
  chipInputRow: { flexDirection: 'row', gap: 8 },
  chipInput: { flex: 1 },
  chipAddBtn: { backgroundColor: INK, borderRadius: 9, paddingHorizontal: 14, justifyContent: 'center' },
  chipAddText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  expWrap: { gap: 10 },
  expCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e6e8ec', padding: 12, gap: 8 },
  expRemove: { position: 'absolute', top: 8, right: 10, zIndex: 1 },
  expRemoveText: { color: '#a32d2d', fontWeight: '800', fontSize: 15 },
  expAddBtn: { alignSelf: 'flex-start', backgroundColor: INK, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  expAddText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e8ec' },
  doneBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneText: { color: INK, fontWeight: '800', fontSize: 15 },
});
