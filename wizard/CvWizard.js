// wizard/CvWizard.js
// Adımları sırayla gezdiren kapsayıcı. Veri App'ten gelir (data/onChange).
// Başlıklar seçili dilden; önizlemeye dil geçer; ilk adımda Geri -> onExit, önizlemeden sonra -> onFinish.
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function CvWizard({ onExit, onFinish, data: extData, onChange }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const [localData, setLocalData] = useState({});
  const data = extData || localData;
  const [step, setStep] = useState(0);

  const update = (patch) => {
    if (onChange) onChange(patch);
    else setLocalData((d) => ({ ...d, ...patch }));
  };

  const isPreview = step === STEPS.length;
  const Current = !isPreview ? STEPS[step].Component : null;

  const goNext = () => {
    if (isPreview) { onFinish && onFinish(); return; }
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  };
  const goPrev = () => {
    if (step === 0) { onExit && onExit(); return; }
    setStep((s) => s - 1);
  };

  const rowDir = dir === 'rtl' ? 'row-reverse' : 'row';
  const align = dir === 'rtl' ? 'right' : 'left';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        {/* Üst başlık + ilerleme */}
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

        {/* İçerik */}
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isPreview ? <CVPreview data={data} /> : <Current data={data} update={update} />}
        </ScrollView>

        {/* Alt butonlar */}
        <View style={[styles.footer, { flexDirection: rowDir, paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={goPrev}>
            <Text style={styles.btnGhostText}>{t('back')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={goNext}>
            <Text style={styles.btnPrimaryText}>
              {isPreview ? t('done') : (step === STEPS.length - 1 ? t('preview') : t('next'))}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  content: { padding: 20, paddingBottom: 32 },
  footer: { gap: 12, padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e8ec' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#1b2533' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ccd2' },
  btnGhostText: { color: '#1b2533', fontWeight: '700', fontSize: 15 },
});
