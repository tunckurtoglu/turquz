// wizard/CvWizard.js
// Adımları sırayla gezdiren kapsayıcı. Veri App'ten gelir (data/onChange).
// startStep: hangi adımdan açılacağı (0-6 form, 7 = önizleme).
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, Dimensions,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ageFromBirth, MIN_AGE, MAX_AGE } from '../cv/options';

import Step1Personal from './steps/Step1Personal';
import Step2Profile from './steps/Step2Profile';
import Step3Family from './steps/Step3Family';
import Step4Languages from './steps/Step4Languages';
import Step5Experience from './steps/Step5Experience';
import Step6Education from './steps/Step6Education';
import Step7SkillsEtc from './steps/Step7SkillsEtc';
import CVPreview from '../screens/CVPreview';

const STEPS = [
  { key: 'step_personal', Component: Step1Personal },
  { key: 'step_profile', Component: Step2Profile },
  { key: 'step_family', Component: Step3Family },
  { key: 'step_languages', Component: Step4Languages },
  { key: 'step_experience', Component: Step5Experience },
  { key: 'step_education', Component: Step6Education },
  { key: 'step_skills', Component: Step7SkillsEtc },
];

const TOTAL = STEPS.length + 1; // +1 = Önizleme
const PREVIEW_MIN_H = Math.round(Dimensions.get('window').height * 0.52);

function NavBtn({ style, textStyle, label, onPress, disabled, primary }) {
  return (
    <TouchableOpacity style={[styles.btn, primary ? styles.btnPrimary : styles.btnGhost, disabled && styles.btnDisabled, style]} onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <Text style={[primary ? styles.btnPrimaryText : styles.btnGhostText, textStyle]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CvWizard({ onExit, onFinish, onEdit, data: extData, onChange, startStep = 0, previewOnly = false }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const [localData, setLocalData] = useState({});
  const data = extData || localData;
  const [step, setStep] = useState(startStep);
  const [confirmOpen, setConfirmOpen] = useState(false); // onay modalı açık mı
  const [accepted, setAccepted] = useState(false);       // onay kutusu işaretli mi
  const [editingFromPreview, setEditingFromPreview] = useState(false); // önizlemeden düzenlemeye geçildi mi

  // startStep dışarıdan değişirse (örn. Home'dan Önizle/Düzenle) adımı senkronla
  useEffect(() => { setStep(startStep); }, [startStep]);

  // Scroll konumunu koru: bir alan doldurulunca/Select kapanınca RN ScrollView'ı bazen
  // istem dışı "en üste" atıyor. Kullanıcının konumunu hatırlayıp veri değişiminden sonra
  // geri getiriyoruz; adım değişince ise bilerek tepeye alıyoruz.
  const scrollRef = useRef(null);
  const yRef = useRef(0);
  const onScroll = (e) => { yRef.current = e.nativeEvent.contentOffset.y; };
  useEffect(() => {
    if (yRef.current <= 0) return undefined;
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: yRef.current, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [data]);
  useEffect(() => { yRef.current = 0; scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  const update = (patch) => {
    if (onChange) onChange(patch);
    else setLocalData((d) => ({ ...d, ...patch }));
  };

  const effPreviewOnly = previewOnly && !editingFromPreview; // saf önizleme (Home'dan açılınca)
  const isPreview = step === STEPS.length;
  const Current = !isPreview ? STEPS[step].Component : null;

  // Step1 yaş kontrolü: aralık dışındaysa ileri gitme engellenir.
  // (Pasaport CV'den kaldırıldı — teklif sonrası "Belgeler"de yüklenir.)
  const age = ageFromBirth(data.birthDay, data.birthMonth, data.birthYear);
  const ageBlocked = age != null && (age < MIN_AGE || age > MAX_AGE);
  const nextBlocked = step === 0 && ageBlocked;

  const goNext = () => {
    if (nextBlocked) return;
    if (isPreview) { setAccepted(false); setConfirmOpen(true); return; } // önce onay al
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  };
  const goPrev = () => {
    // Önizlemeden düzenlemeye geçilip ilk adımda Geri'ye basılırsa: vazgeç, önizlemeye dön
    if (editingFromPreview && step === 0) { setEditingFromPreview(false); setStep(STEPS.length); return; }
    if (effPreviewOnly) { onExit && onExit(); return; }   // saf önizleme: Geri = çıkış (Home)
    if (step === 0) { onExit && onExit(); return; }
    setStep((s) => s - 1);
  };

  const rowDir = dir === 'rtl' ? 'row-reverse' : 'row';
  const align = dir === 'rtl' ? 'right' : 'left';

  const renderNavFooter = () => (
    <View style={[styles.footerInline, { flexDirection: rowDir }]}>
      {effPreviewOnly ? (
        <>
          <NavBtn label={t('back')} onPress={goPrev} />
          <NavBtn primary label={t('home_edit_short')} onPress={() => { setEditingFromPreview(true); setStep(0); }} />
        </>
      ) : (
        <>
          <NavBtn label={t('back')} onPress={goPrev} />
          <NavBtn
            primary
            label={isPreview ? t('save') : (step === STEPS.length - 1 ? t('preview') : t('next'))}
            onPress={goNext}
            disabled={nextBlocked}
          />
        </>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={[styles.stepCount, { textAlign: align }]}>
            {t('step')} {step + 1} / {TOTAL}
          </Text>
          <Text style={[styles.stepTitle, { textAlign: align }]}>
            {isPreview ? t('preview') : t(STEPS[step].key)}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL) * 100}%` }]} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {isPreview ? (
            <View style={[styles.previewBox, { height: PREVIEW_MIN_H }]}>
              <CVPreview data={data} />
            </View>
          ) : (
            <Current data={data} update={update} />
          )}
          {renderNavFooter()}
        </ScrollView>
      </View>

      {/* Onay (disclaimer) modalı — Bitti'ye basınca */}
      <Modal visible={confirmOpen} transparent animationType="slide" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.modalTitle, { textAlign: align }]}>{t('confirm_title')}</Text>

            <TouchableOpacity
              style={[styles.checkRow, { flexDirection: rowDir }]}
              onPress={() => setAccepted((a) => !a)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                {accepted ? <Text style={styles.checkboxTick}>✓</Text> : null}
              </View>
              <Text style={[styles.checkLabel, { textAlign: align }]}>{t('confirm_check')}</Text>
            </TouchableOpacity>

            <View style={[styles.modalBtns, { flexDirection: rowDir }]}>
              <NavBtn label={t('back')} onPress={() => setConfirmOpen(false)} />
              <NavBtn
                primary
                label={t('confirm_accept')}
                onPress={() => { if (accepted) { setConfirmOpen(false); onFinish && onFinish(); } }}
                disabled={!accepted}
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e6e8ec' },
  stepCount: { fontSize: 12, fontWeight: '700', color: '#9aa1ac', letterSpacing: 0.5 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#1b2533', marginTop: 2 },
  progressTrack: { height: 4, backgroundColor: '#e6e8ec', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: '#c2a25a', borderRadius: 2 },
  content: { padding: 20, flexGrow: 1 },
  previewBox: { width: '100%' },
  footerInline: { gap: 12, marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e6e8ec' },
  btn: { flex: 1, minHeight: 50, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#1b2533' },
  btnDisabled: { backgroundColor: '#b9bec6' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ccd2' },
  btnGhostText: { color: '#1b2533', fontWeight: '700', fontSize: 15, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#1b2533', marginBottom: 12 },
  modalText: { fontSize: 14, lineHeight: 21, color: '#3a4452', marginBottom: 18 },
  checkRow: { alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  checkbox: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: '#c2a25a',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: '#c2a25a' },
  checkboxTick: { color: '#1b2533', fontSize: 16, fontWeight: '900' },
  checkLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1b2533', lineHeight: 20 },
  modalBtns: { gap: 12 },
});
