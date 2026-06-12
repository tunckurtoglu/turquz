// components/AgencyFilterSheet.js
// Acente filtre — TAM EKRAN, her kategori AÇILIR MENÜ (dropdown) satırı.
// Kapalıyken: başlık + seçim özeti + ok. Dokununca açılır (tek seferde bir tanesi).
// Seçenekler kontrollü listelerden (langOptions); filtre KANONİK value ile yapılır.
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { langOptions } from '../cv/options';
import { parseCode, candidateCode } from '../lib/candidateCode';

const GENDER_VALUES = ['male', 'female'];
const INK = '#1b2533';
const GOLD = '#c2a25a';

function Dropdown({ title, summary, open, onToggle, children }) {
  return (
    <View style={styles.dd}>
      <TouchableOpacity style={styles.ddHead} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.ddTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {summary ? <Text style={styles.ddSummary} numberOfLines={1}>{summary}</Text> : null}
        <Text style={styles.ddChev}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.ddBody}>{children}</View> : null}
    </View>
  );
}

function Chips({ options, selected, onToggle }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <TouchableOpacity key={o.value} style={[styles.chip, on && styles.chipOn]} onPress={() => onToggle(o.value)} activeOpacity={0.8}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AgencyFilterSheet({ visible, initial, onApply, onClose }) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const opts = langOptions(lang);
  const backChevron = dir === 'rtl' ? '›' : '‹';

  const [open, setOpen] = useState(null);
  const [codeText, setCodeText] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [gender, setGender] = useState('');
  const [nationalities, setNationalities] = useState([]);
  const [positions, setPositions] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [skills, setSkills] = useState([]);

  useEffect(() => {
    if (!visible) return;
    const f = initial || {};
    setCodeText(f.codeNation && f.regNo ? candidateCode(f.codeNation, f.regNo) : '');
    setAgeMin(f.ageMin ? String(f.ageMin) : ''); setAgeMax(f.ageMax ? String(f.ageMax) : '');
    setGender(f.gender || '');
    setNationalities(f.nationalities || []); setPositions(f.positions || []);
    setLanguages(f.languages || []); setSkills(f.skills || []);
    setOpen(null);
  }, [visible, initial]);

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const toggleSec = (k) => setOpen(open === k ? null : k);
  const clear = () => {
    setCodeText(''); setAgeMin(''); setAgeMax(''); setGender('');
    setNationalities([]); setPositions([]); setLanguages([]); setSkills([]);
  };
  const apply = () => {
    const cp = parseCode(codeText);
    onApply({
      codeNation: cp?.nationality,
      regNo: cp?.regNo,
      ageMin: parseInt(ageMin, 10) || undefined,
      ageMax: parseInt(ageMax, 10) || undefined,
      gender: gender || undefined,
      nationalities, positions, languages, skills,
    });
  };

  const nsel = (n) => (n ? t('agency_selected', { n }) : '');
  const codeSummary = codeText || '';
  const ageSummary = (ageMin || ageMax) ? `${ageMin || '…'} – ${ageMax || '…'}` : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('agency_filters')}</Text>
          <TouchableOpacity onPress={clear}><Text style={styles.clear}>{t('agency_clear')}</Text></TouchableOpacity>
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Dropdown title={t('candidate_no')} summary={codeSummary} open={open === 'code'} onToggle={() => toggleSec('code')}>
            <TextInput style={styles.input} value={codeText} onChangeText={(v) => setCodeText(v.toUpperCase())} placeholder="TR0123" placeholderTextColor="#9aa1ac" autoCapitalize="characters" autoCorrect={false} maxLength={10} />
          </Dropdown>

          <Dropdown title={t('agency_age')} summary={ageSummary} open={open === 'age'} onToggle={() => toggleSec('age')}>
            <View style={styles.ageRow}>
              <TextInput style={styles.input} value={ageMin} onChangeText={(v) => setAgeMin(v.replace(/[^0-9]/g, ''))} placeholder={t('agency_age_min')} placeholderTextColor="#9aa1ac" keyboardType="number-pad" maxLength={2} />
              <Text style={styles.dash}>—</Text>
              <TextInput style={styles.input} value={ageMax} onChangeText={(v) => setAgeMax(v.replace(/[^0-9]/g, ''))} placeholder={t('agency_age_max')} placeholderTextColor="#9aa1ac" keyboardType="number-pad" maxLength={2} />
            </View>
          </Dropdown>

          <Dropdown title={t('f_gender')} summary={gender ? t(`gender_${gender}`) : ''} open={open === 'gender'} onToggle={() => toggleSec('gender')}>
            <View style={styles.segment}>
              {GENDER_VALUES.map((v) => {
                const on = gender === v;
                return (
                  <TouchableOpacity key={v} style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => setGender(on ? '' : v)} activeOpacity={0.8}>
                    <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>{t(`gender_${v}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dropdown>

          <Dropdown title={t('sec_positions')} summary={nsel(positions.length)} open={open === 'positions'} onToggle={() => toggleSec('positions')}>
            <Chips options={opts.POSITIONS} selected={positions} onToggle={(v) => toggle(positions, setPositions, v)} />
          </Dropdown>

          <Dropdown title={t('step_languages')} summary={nsel(languages.length)} open={open === 'languages'} onToggle={() => toggleSec('languages')}>
            <Chips options={opts.LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, setLanguages, v)} />
          </Dropdown>

          <Dropdown title={t('sec_skills')} summary={nsel(skills.length)} open={open === 'skills'} onToggle={() => toggleSec('skills')}>
            <Chips options={opts.SKILLS} selected={skills} onToggle={(v) => toggle(skills, setSkills, v)} />
          </Dropdown>

          <Dropdown title={t('f_nationality')} summary={nsel(nationalities.length)} open={open === 'nationality'} onToggle={() => toggleSec('nationality')}>
            <Chips options={opts.NATIONALITIES} selected={nationalities} onToggle={(v) => toggle(nationalities, setNationalities, v)} />
          </Dropdown>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.applyBtn} onPress={apply} activeOpacity={0.9}>
            <Text style={styles.applyText}>{t('agency_apply')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 18, fontWeight: '800', color: INK },
  clear: { fontSize: 14, fontWeight: '700', color: '#a32d2d' },
  accent: { height: 2.5, backgroundColor: GOLD },

  content: { padding: 16, paddingBottom: 24 },

  dd: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#e6e8ec', overflow: 'hidden' },
  ddHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 15 },
  ddTitle: { fontSize: 14.5, fontWeight: '800', color: INK },
  ddSummary: { fontSize: 13, color: GOLD, fontWeight: '700', marginRight: 10, maxWidth: 150 },
  ddChev: { fontSize: 14, color: '#9aa1ac', fontWeight: '700' },
  ddBody: { paddingHorizontal: 14, paddingBottom: 16, paddingTop: 2 },

  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dash: { color: '#9aa1ac', fontSize: 18 },

  segment: { flexDirection: 'row', backgroundColor: '#eceef1', borderRadius: 12, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: INK },
  segText: { fontSize: 12.5, fontWeight: '700', color: '#737373' },
  segTextOn: { color: '#fff' },

  codeRow: { gap: 8, paddingRight: 8 },
  codeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 11, backgroundColor: '#f1f2f4' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f2f4' },
  chipOn: { backgroundColor: INK },
  chipText: { fontSize: 13, fontWeight: '600', color: '#4a4a4a' },
  chipTextOn: { color: '#fff' },

  footer: { paddingHorizontal: 18, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  applyBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  applyText: { color: INK, fontWeight: '800', fontSize: 16 },
});
