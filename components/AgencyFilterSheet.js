// components/AgencyFilterSheet.js
// Acente gelişmiş filtre sheet'i.
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { langOptions, normalizeWorkAvailability } from '../cv/options';
import { C } from '../lib/theme';
import TurquzWordmark from './TurquzWordmark';

const GENDER_VALUES = ['male', 'female'];
const EMPLOYMENT_VALUES = ['student', 'employed'];
const GOLD = '#E4B35D';
const NAVY = '#0B1220';
const CARD = '#141E2E';
const SURFACE = '#1A2536';
const MUTED = '#8B96A8';
const LINE = 'rgba(228,179,93,0.28)';

function Section({ title, summary, open, onToggle, children, last, light }) {
  return (
    <View style={[styles.sec, light && lightStyles.sec, last && styles.secLast]}>
      <TouchableOpacity style={[styles.secHead, light && lightStyles.secHead]} onPress={onToggle} activeOpacity={0.75}>
        <View style={styles.secHeadText}>
          <Text style={[styles.secTitle, light && lightStyles.secTitle]} numberOfLines={1}>{title}</Text>
          {summary ? <Text style={[styles.secSummary, light && lightStyles.secSummary]} numberOfLines={1}>{summary}</Text> : null}
        </View>
        <View style={[styles.secChevWrap, light && lightStyles.secChevWrap, open && styles.secChevWrapOn]}>
          <Text style={[styles.secChev, light && lightStyles.secChev, open && styles.secChevOn, open && light && lightStyles.secChevOn]}>{open ? '▾' : '›'}</Text>
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.secBody}>{children}</View> : null}
    </View>
  );
}

function Chips({ options, selected, onToggle, light }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, light && lightStyles.chip, on && styles.chipOn]}
            onPress={() => onToggle(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, light && lightStyles.chipText, on && styles.chipTextOn, on && light && lightStyles.chipTextOn]} numberOfLines={2}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Seg({ options, value, onChange, multi, light }) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = multi ? (value || []).includes(o.value) : value === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segBtn, light && lightStyles.segBtn, on && styles.segBtnOn]}
            onPress={() => {
              if (multi) {
                const arr = value || [];
                onChange(arr.includes(o.value) ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
              } else {
                onChange(on ? '' : o.value);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, light && lightStyles.segText, on && styles.segTextOn, on && light && lightStyles.segTextOn]} numberOfLines={2}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AgencyFilterSheet({
  visible,
  initial,
  focusSection = null,
  onApply,
  onClose,
  light = false,
}) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const opts = langOptions(lang);
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [open, setOpen] = useState(null);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [gender, setGender] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [positions, setPositions] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [skills, setSkills] = useState([]);
  const [turquzCertified, setTurquzCertified] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const f = initial || {};
    setAgeMin(f.ageMin ? String(f.ageMin) : ''); setAgeMax(f.ageMax ? String(f.ageMax) : '');
    setGender(f.gender || '');
    setEmploymentStatus(f.employmentStatus || '');
    setAvailableMonths((f.availableMonths || []).map(normalizeWorkAvailability).filter(Boolean));
    setNationalities(f.nationalities || []); setPositions(f.positions || []);
    setLanguages(f.languages || []); setSkills(f.skills || []);
    setTurquzCertified(!!f.turquzCertified);
    setOpen(focusSection || null);
    return undefined;
  }, [visible, initial, focusSection]);

  const solo = focusSection;
  const sheetTitle = solo === 'positions'
    ? t('sec_positions')
    : solo === 'languages'
      ? t('step_languages')
      : solo === 'skills'
        ? t('sec_skills')
        : solo === 'nationality'
          ? t('f_nationality')
          : t('agency_filters');

  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const toggleSec = (k) => setOpen(open === k ? null : k);
  const clear = () => {
    if (solo === 'positions') { setPositions([]); return; }
    if (solo === 'languages') { setLanguages([]); return; }
    if (solo === 'skills') { setSkills([]); return; }
    if (solo === 'nationality') { setNationalities([]); return; }
    setAgeMin(''); setAgeMax(''); setGender('');
    setEmploymentStatus(''); setAvailableMonths([]);
    setNationalities([]); setPositions([]); setLanguages([]); setSkills([]);
    setTurquzCertified(false);
  };
  const apply = () => {
    onApply({
      ageMin: parseInt(ageMin, 10) || undefined,
      ageMax: parseInt(ageMax, 10) || undefined,
      gender: gender || undefined,
      employmentStatus: employmentStatus || undefined,
      availableMonths: availableMonths.length ? availableMonths : undefined,
      nationalities, positions, languages, skills,
      turquzCertified: turquzCertified || undefined,
    });
  };

  const nsel = (n) => (n ? t('agency_selected', { n }) : '');
  const ageSummary = (ageMin || ageMax) ? `${ageMin || '…'} – ${ageMax || '…'}` : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.wrap, light && lightStyles.wrap]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, light && lightStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.backChevron, light && lightStyles.backChevron]}>{backChevron}</Text>
          </TouchableOpacity>
          <View style={styles.headerMid}>
            <TurquzWordmark size={9} letterSpacing={1.6} fontFamily="Cinzel_600SemiBold" fontsReady style={{ marginBottom: 2 }} />
            <Text style={[styles.title, light && lightStyles.title]}>{sheetTitle}</Text>
          </View>
          <TouchableOpacity onPress={clear} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <Text style={[styles.clear, light && lightStyles.clear]}>{t('agency_clear')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, light && lightStyles.content, { paddingBottom: 28 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {solo === 'positions' ? (
            (opts.POSITION_SECTORS || []).map((sec, i) => (
              <View key={sec.value} style={[styles.posBlock, light && lightStyles.posBlock, i > 0 && styles.posBlockGap]}>
                <Text style={[styles.posSectorTitle, light && lightStyles.posSectorTitle]} numberOfLines={1}>{sec.label}</Text>
                <Chips
                  options={opts.POSITIONS_BY_SECTOR?.[sec.value] || []}
                  selected={positions}
                  onToggle={(v) => toggle(positions, setPositions, v)}
                  light={light}
                />
              </View>
            ))
          ) : null}

          {solo === 'languages' ? (
            <View style={[styles.soloPad, light && lightStyles.soloPad]}>
              <Chips options={opts.LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, setLanguages, v)} light={light} />
            </View>
          ) : null}

          {solo === 'skills' ? (
            <View style={[styles.soloPad, light && lightStyles.soloPad]}>
              <Chips options={opts.SKILLS} selected={skills} onToggle={(v) => toggle(skills, setSkills, v)} light={light} />
            </View>
          ) : null}

          {solo === 'nationality' ? (
            <View style={[styles.soloPad, light && lightStyles.soloPad]}>
              <Chips options={opts.NATIONALITIES} selected={nationalities} onToggle={(v) => toggle(nationalities, setNationalities, v)} light={light} />
            </View>
          ) : null}

          {!solo ? (
            <View style={[styles.group, light && lightStyles.group]}>
              <Section title={t('agency_age')} summary={ageSummary} open={open === 'age'} onToggle={() => toggleSec('age')} light={light}>
                <View style={styles.ageRow}>
                  <TextInput
                    style={[styles.input, light && lightStyles.input]}
                    value={ageMin}
                    onChangeText={(v) => setAgeMin(v.replace(/[^0-9]/g, ''))}
                    placeholder={t('agency_age_min')}
                    placeholderTextColor="#5A6575"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={[styles.dash, light && lightStyles.dash]}>—</Text>
                  <TextInput
                    style={[styles.input, light && lightStyles.input]}
                    value={ageMax}
                    onChangeText={(v) => setAgeMax(v.replace(/[^0-9]/g, ''))}
                    placeholder={t('agency_age_max')}
                    placeholderTextColor="#5A6575"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </Section>

              <Section
                title={t('f_gender')}
                summary={gender ? t(`gender_${gender}`) : ''}
                open={open === 'gender'}
                onToggle={() => toggleSec('gender')}
                light={light}
              >
                <Seg
                  options={GENDER_VALUES.map((v) => ({ value: v, label: t(`gender_${v}`) }))}
                  value={gender}
                  onChange={setGender}
                  light={light}
                />
              </Section>

              <Section
                title={t('f_employment_status')}
                summary={employmentStatus ? t(`es_${employmentStatus}`) : ''}
                open={open === 'employment'}
                onToggle={() => toggleSec('employment')}
                light={light}
              >
                <Seg
                  options={EMPLOYMENT_VALUES.map((v) => ({ value: v, label: t(`es_${v}`) }))}
                  value={employmentStatus}
                  onChange={setEmploymentStatus}
                  light={light}
                />
              </Section>

              <Section
                title={t('f_turquz_certified')}
                summary={turquzCertified ? t('f_turquz_certified') : ''}
                open={open === 'cert'}
                onToggle={() => toggleSec('cert')}
                light={light}
              >
                <Seg
                  options={[{ value: '1', label: t('f_turquz_certified') }]}
                  value={turquzCertified ? '1' : ''}
                  onChange={(v) => setTurquzCertified(!!v)}
                  light={light}
                />
              </Section>

              <Section
                title={t('f_work_duration')}
                summary={availableMonths.map((v) => opts.WORK_AVAILABILITY.find((o) => o.value === v)?.label).filter(Boolean).join(', ')}
                open={open === 'months'}
                onToggle={() => toggleSec('months')}
                light={light}
              >
                <Seg
                  multi
                  options={opts.WORK_AVAILABILITY}
                  value={availableMonths}
                  onChange={setAvailableMonths}
                  light={light}
                />
              </Section>

              <Section title={t('sec_positions')} summary={nsel(positions.length)} open={open === 'positions'} onToggle={() => toggleSec('positions')} light={light}>
                {(opts.POSITION_SECTORS || []).map((sec, i) => (
                  <View key={sec.value} style={[styles.posSector, i > 0 && styles.posSectorSpaced]}>
                    <Text style={[styles.posSectorTitle, light && lightStyles.posSectorTitle]} numberOfLines={1}>{sec.label}</Text>
                    <Chips
                      options={opts.POSITIONS_BY_SECTOR?.[sec.value] || []}
                      selected={positions}
                      onToggle={(v) => toggle(positions, setPositions, v)}
                      light={light}
                    />
                  </View>
                ))}
              </Section>

              <Section title={t('step_languages')} summary={nsel(languages.length)} open={open === 'languages'} onToggle={() => toggleSec('languages')} light={light}>
                <Chips options={opts.LANGUAGES} selected={languages} onToggle={(v) => toggle(languages, setLanguages, v)} light={light} />
              </Section>

              <Section title={t('sec_skills')} summary={nsel(skills.length)} open={open === 'skills'} onToggle={() => toggleSec('skills')} light={light}>
                <Chips options={opts.SKILLS} selected={skills} onToggle={(v) => toggle(skills, setSkills, v)} light={light} />
              </Section>

              <Section
                title={t('f_nationality')}
                summary={nsel(nationalities.length)}
                open={open === 'nationality'}
                onToggle={() => toggleSec('nationality')}
                last
                light={light}
              >
                <Chips options={opts.NATIONALITIES} selected={nationalities} onToggle={(v) => toggle(nationalities, setNationalities, v)} light={light} />
              </Section>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, light && lightStyles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <TouchableOpacity style={[styles.applyBtn, light && lightStyles.applyBtn]} onPress={apply} activeOpacity={0.9}>
            <Text style={[styles.applyText, light && lightStyles.applyText]}>{t('agency_show_results') || t('agency_apply')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: NAVY,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: '#E7DCC4', fontWeight: '600', marginTop: -2 },
  headerMid: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  kicker: {
    color: GOLD, fontSize: 9, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', marginBottom: 2,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#F4F7FB', letterSpacing: 0.2 },
  clear: { fontSize: 13.5, fontWeight: '700', color: MUTED, minWidth: 52, textAlign: 'right' },

  content: { paddingHorizontal: 16, paddingTop: 16 },

  searchField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: SURFACE, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, minHeight: 48, marginBottom: 14,
  },
  searchFieldErr: { borderColor: 'rgba(232,160,144,0.55)' },
  searchInput: { flex: 1, fontSize: 15.5, fontWeight: '600', color: '#fff', paddingVertical: 11 },
  searchClear: { color: MUTED, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  searchErr: { color: '#E8A090', fontSize: 12.5, fontWeight: '600', marginTop: -6, marginBottom: 10, marginLeft: 4 },

  group: {
    backgroundColor: CARD, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },

  sec: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  secLast: { borderBottomWidth: 0 },
  secHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15, gap: 10,
  },
  secHeadText: { flex: 1, minWidth: 0 },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#F0F3F7', letterSpacing: 0.15 },
  secSummary: { marginTop: 4, fontSize: 12.5, fontWeight: '600', color: GOLD },
  secChevWrap: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  secChevWrapOn: { borderColor: LINE, backgroundColor: 'rgba(228,179,93,0.12)' },
  secChev: { fontSize: 15, color: MUTED, fontWeight: '700', marginTop: -1 },
  secChevOn: { color: GOLD },
  secBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2 },

  input: {
    flex: 1, backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#fff',
  },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { color: MUTED, fontSize: 16 },

  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  segBtnOn: { backgroundColor: 'rgba(228,179,93,0.18)', borderColor: GOLD },
  segText: { fontSize: 13, fontWeight: '600', color: MUTED },
  segTextOn: { color: '#F0E6D2', fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', maxWidth: '100%',
  },
  chipOn: { backgroundColor: 'rgba(228,179,93,0.16)', borderColor: GOLD },
  chipText: { fontSize: 13, fontWeight: '600', color: '#C5CCD6', textAlign: 'center' },
  chipTextOn: { color: '#F0E6D2' },

  soloPad: {
    backgroundColor: CARD, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  posBlock: {
    backgroundColor: CARD, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  posBlockGap: { marginTop: 12 },
  posSector: { marginBottom: 4 },
  posSectorSpaced: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  posSectorTitle: {
    fontSize: 12, fontWeight: '800', color: GOLD, letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: 10, alignSelf: 'stretch',
  },

  footer: {
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: NAVY,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE,
  },
  applyBtn: {
    backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  applyText: { color: '#1A2030', fontWeight: '800', fontSize: 15.5, letterSpacing: 0.3 },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { backgroundColor: C.bg, borderBottomColor: C.hair },
  backChevron: { color: C.goldText },
  kicker: { color: C.goldText },
  title: { color: C.ink },
  clear: { color: C.ink2 },
  content: { backgroundColor: C.bg },
  searchField: { backgroundColor: C.card, borderColor: C.hair },
  searchInput: { color: C.ink },
  searchClear: { color: C.ink2 },
  searchErr: { color: C.danger },
  group: { backgroundColor: C.card, borderColor: C.hair },
  sec: { borderBottomColor: C.hair },
  secHead: { backgroundColor: C.card },
  secTitle: { color: C.ink },
  secSummary: { color: C.goldText },
  secChevWrap: { backgroundColor: C.cardAlt, borderColor: C.hair },
  secChev: { color: C.ink2 },
  secChevOn: { color: C.goldText },
  input: { backgroundColor: C.card, borderColor: C.hair, color: C.ink },
  dash: { color: C.ink2 },
  segBtn: { backgroundColor: C.cardAlt, borderColor: C.hair },
  segText: { color: C.ink2 },
  segTextOn: { color: C.ink },
  chip: { backgroundColor: C.cardAlt, borderColor: C.hair },
  chipText: { color: C.ink2 },
  chipTextOn: { color: C.ink },
  soloPad: { backgroundColor: C.card, borderColor: C.hair },
  posBlock: { backgroundColor: C.card, borderColor: C.hair },
  posSectorTitle: { color: C.goldText },
  footer: { backgroundColor: C.bg, borderTopColor: C.hair },
  applyBtn: { backgroundColor: C.ink },
  applyText: { color: '#f7f2e8' },
});
