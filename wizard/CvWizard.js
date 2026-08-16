// wizard/CvWizard.js
// Adımları sırayla gezdiren kapsayıcı. Veri App'ten gelir (data/onChange).
// startStep: hangi adımdan açılacağı (0-6 form, 7 = önizleme).
// Önizlemeden "Düzenle": tüm bölümler tek kaydırmalı sayfada.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [editingFromPreview, setEditingFromPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => { setStep(startStep); }, [startStep]);

  const scrollRef = useRef(null);
  const yRef = useRef(0);
  const onScroll = (e) => { yRef.current = e.nativeEvent.contentOffset.y; };
  useEffect(() => {
    if (yRef.current <= 0) return undefined;
    const id = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: yRef.current, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [data]);
  useEffect(() => {
    yRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, editingFromPreview]);

  const update = (patch) => {
    if (onChange) onChange(patch);
    else setLocalData((d) => ({ ...d, ...patch }));
  };

  const effPreviewOnly = previewOnly && !editingFromPreview;
  const isPreview = !editingFromPreview && step === STEPS.length;
  const Current = !isPreview && !editingFromPreview ? STEPS[step]?.Component : null;

  const age = ageFromBirth(data.birthDay, data.birthMonth, data.birthYear);
  const ageBlocked = age != null && (age < MIN_AGE || age > MAX_AGE);
  const nextBlocked = !editingFromPreview && step === 0 && ageBlocked;
  const editBlocked = editingFromPreview && ageBlocked;

  const leaveEditToPreview = () => {
    setEditingFromPreview(false);
    setStep(STEPS.length);
  };

  const goNext = () => {
    if (nextBlocked) return;
    if (isPreview) { setAccepted(false); setConfirmOpen(true); return; }
    setStep((s) => Math.min(s + 1, TOTAL - 1));
  };
  const goPrev = () => {
    if (editingFromPreview) { leaveEditToPreview(); return; }
    if (effPreviewOnly) { onExit && onExit(); return; }
    if (step === 0) { onExit && onExit(); return; }
    setStep((s) => s - 1);
  };

  const onDownloadPdf = useCallback(async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await previewRef.current?.downloadPdf?.();
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy]);

  const rowDir = dir === 'rtl' ? 'row-reverse' : 'row';
  const align = dir === 'rtl' ? 'right' : 'left';

  const renderNavFooter = (mode) => {
    // mode: 'preview' | 'editAll' | 'inline'
    const sticky = mode === 'preview' || mode === 'editAll';
    return (
      <View style={[
        sticky ? styles.footerSticky : styles.footerInline,
        sticky && { paddingBottom: Math.max(insets.bottom, 12) },
      ]}>
        {mode === 'preview' ? (
          <TouchableOpacity
            style={[styles.pdfBtn, pdfBusy && styles.pdfBtnBusy]}
            onPress={onDownloadPdf}
            disabled={pdfBusy}
            activeOpacity={0.85}
          >
            {pdfBusy
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.pdfBtnText}>{t('pdf_download')}</Text>}
          </TouchableOpacity>
        ) : null}
        <View style={{ flexDirection: rowDir, gap: 12 }}>
          {mode === 'preview' ? (
            <>
              <NavBtn label={t('back')} onPress={goPrev} />
              <NavBtn primary label={t('home_edit_short')} onPress={() => { setEditingFromPreview(true); setStep(0); }} />
            </>
          ) : mode === 'editAll' ? (
            <>
              <NavBtn label={t('back')} onPress={leaveEditToPreview} />
              <NavBtn primary label={t('save')} onPress={leaveEditToPreview} disabled={editBlocked} />
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
      </View>
    );
  };

  const headerTitle = editingFromPreview
    ? t('cv_edit_title')
    : (isPreview ? t('preview') : t(STEPS[step].key));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.flex}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          {!isPreview && !editingFromPreview ? (
            <Text style={[styles.stepCount, { textAlign: align }]}>
              {t('step')} {step + 1} / {TOTAL}
            </Text>
          ) : null}
          <Text style={[styles.stepTitle, { textAlign: align, marginTop: (isPreview || editingFromPreview) ? 0 : 2 }]}>
            {headerTitle}
          </Text>
          {!isPreview && !editingFromPreview ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL) * 100}%` }]} />
            </View>
          ) : null}
        </View>

        {editingFromPreview ? (
          <>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={[styles.content, { paddingBottom: 16 }]}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
            >
              {STEPS.map(({ key, Component }, idx) => (
                <View key={key} style={[styles.editBlock, idx > 0 && styles.editBlockGap]}>
                  <Text style={[styles.editBlockTitle, { textAlign: align }]}>{t(key)}</Text>
                  <Component data={data} update={update} />
                </View>
              ))}
            </ScrollView>
            {renderNavFooter('editAll')}
          </>
        ) : isPreview ? (
          <>
            <View style={styles.previewFill}>
              <CVPreview ref={previewRef} data={data} hidePdfBtn />
            </View>
            {renderNavFooter('preview')}
          </>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {Current ? <Current data={data} update={update} /> : null}
            {renderNavFooter('inline')}
          </ScrollView>
        )}
      </View>

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
  editBlock: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6e8ec',
  },
  editBlockGap: { marginTop: 14 },
  editBlockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#c2a25a',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  previewFill: { flex: 1, width: '100%', backgroundColor: '#eef0f2', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  footerInline: { gap: 12, marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e6e8ec' },
  footerSticky: {
    gap: 10, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e6e8ec',
  },
  pdfBtn: {
    backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  pdfBtnBusy: { opacity: 0.6 },
  pdfBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  btn: { flex: 1, minHeight: 50, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#1b2533' },
  btnDisabled: { backgroundColor: '#b9bec6' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15, textAlign: 'center' },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ccd2' },
  btnGhostText: { color: '#1b2533', fontWeight: '700', fontSize: 15, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#1b2533', marginBottom: 12 },
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
