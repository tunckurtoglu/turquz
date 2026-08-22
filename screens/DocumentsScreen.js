// screens/DocumentsScreen.js
// "Belgelerim": pasaport + adli sicil gibi hassas belgeler.
// Akış: "Ekle" -> (gerekli açık rıza yoksa) ConsentSheet -> rıza Supabase'e yazılır ->
// galeriden belge seç -> private 'documents' bucket'a güvenli yükleme -> "Yüklendi" durumu.
// Doğrulama (son kullanma < 1 yıl / okunaklılık) Adım 4'te Edge Function ile eklenecek.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Keyboard, RefreshControl, useWindowDimensions, StatusBar, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../i18n/LanguageContext';
// NOT: expo-document-picker / expo-file-system NATIVE'dir; statik import açılışta çöker
// (yeni build'de yokken). pickPdf içinde DİNAMİK import edilir.
import ConsentSheet from '../components/ConsentSheet';
import { Select } from '../components/Select';
import { DAYS, monthOptions, FLIGHT_YEARS } from '../cv/options';
import { getLatestConsent, saveConsent, canUploadDocs, hasSensitiveConsent } from '../lib/consent';
import { listDocuments, uploadDocument, verifyDocument, getSignedUrl, removeDocument, submitDocuments } from '../lib/documents';
import { getCandidateStatus, docsUnlocked, passportDeadline, formatDeadlineRemain, requestDocsExtraTime } from '../lib/candidate';
import { supabase } from '../lib/supabase';
import { latinFirst, latinLast } from '../lib/translit';
import { PIPELINE, kindState, activeStep, stepActor, kindOwner, DOCS_EXTRA_DAYS } from '../lib/pipeline';
import { notifyDocumentSubmit, notifyDocsDeadline } from '../lib/push';
import { getContract } from '../lib/contracts';
import { getFlight, msUntilArrival, msUntilYmdGate } from '../lib/flights';
import CountdownBanner from '../components/CountdownBanner';
import { loadProfile, saveProfile } from '../lib/profile';
import { birthPlaceFromOcr } from '../lib/passportFields';
import { CONTRACT_WEB_PAYMENT_ENABLED, PROCESS_CHAT_ENABLED, processChatUnlocked } from '../lib/features';
import { openContractPortal } from '../lib/contractPortal';
import ContractPreview from '../components/ContractPreview';
import ProcessChatSheet from '../components/ProcessChatSheet';
import ProcessChatFab from '../components/ProcessChatFab';
import PickupCard from '../components/PickupCard';
import VerifyingOverlay from '../components/VerifyingOverlay';

function fmtDocDate(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return String(v);
}

// Otomatik pasaport doğrulaması (Gemini Edge Function) AÇIK/KAPALI.
// AÇIK: pasaport Gemini ile doğrulanır (verify-passport edge function + GEMINI_API_KEY secret gerekir).
// Pasaport değilse/okunaksızsa/son kullanma <1 yıl ise yükleme geri alınır ve neden gösterilir.
const PASSPORT_VERIFY_ENABLED = true;

// Pasaport metni okunaklı kalsın diye yüksek çözünürlük + düşük sıkıştırma. base64 döndürür.
async function readableJpeg(uri) {
  // Yüksek çözünürlük + düşük sıkıştırma: MRZ ve metin okunaklı kalsın (HEIC dâhil her
  // kaynak JPEG'e döner). Doğrulama buna bağlı olduğu için kaliteyi yüksek tutuyoruz.
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 2600 } }], {
    compress: 0.95, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return out.base64;
}

const TONE_BG = { ok: 'badgeOk', warn: 'badgeWarn', err: 'badgeMiss', miss: 'badgeMiss', neutral: 'badgeNeutral' };
const TONE_TX = { ok: 'badgeTextOk', warn: 'badgeTextWarn', err: 'badgeTextMiss', miss: 'badgeTextMiss', neutral: 'badgeTextNeutral' };

function DocRow({ icon, label, desc, note, doc, badge, busy, t, onAdd, onView, onRemove }) {
  const has = !!doc;
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowMid}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
        {note ? <Text style={styles.rowNote}>⚠ {note}</Text> : null}
        <View style={[styles.badge, styles[TONE_BG[badge.tone]]]}>
          <Text style={[styles.badgeText, styles[TONE_TX[badge.tone]]]}>{badge.text}</Text>
        </View>
        {has ? (
          <View style={styles.linkRow}>
            <TouchableOpacity onPress={onView} disabled={busy}><Text style={styles.link}>{t('doc_view')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={onAdd} disabled={busy}><Text style={styles.link}>{t('photo_change')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={onRemove} disabled={busy}><Text style={[styles.link, styles.linkDanger]}>{t('photo_remove')}</Text></TouchableOpacity>
          </View>
        ) : null}
      </View>
      {!has ? (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.addBtnText}>{t('photo_add')}</Text>}
        </TouchableOpacity>
      ) : busy ? (
        <ActivityIndicator color="#c2a25a" style={{ marginLeft: 10 }} />
      ) : null}
    </View>
  );
}

export default function DocumentsScreen({ userId, onBack, fontsReady, initialChatOpen = false, initialScrollStep = null }) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const backChevron = dir === 'rtl' ? '›' : '‹';

  const [consent, setConsent] = useState(null);
  const [docs, setDocs] = useState({});          // { passport: row, criminal: row }
  const [uploading, setUploading] = useState(null); // yüklenen belge anahtarı | null
  const [verifying, setVerifying] = useState(null); // doğrulanan belge anahtarı | null
  const [verifyOverlay, setVerifyOverlay] = useState(null); // 'verifying' | 'success' | null
  const [sheetOpen, setSheetOpen] = useState(false);
  const [requireSensitive, setRequireSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDoc, setPendingDoc] = useState(null); // rıza sonrası devam edilecek belge
  const pendingPick = useRef(null); // rıza penceresi kapanınca açılacak belge (tek seferlik)
  const listRef = useRef(null);     // tebrik kartı / aşama hizası
  const stepAnchors = useRef({});   // adım -> wrap içi y
  const stepsWrapY = useRef(0);
  const docsFetchedRef = useRef(false);
  const didScrollToStep = useRef(false);
  const scrollStepTimer = useRef(null);
  const initialStepRef = useRef(initialScrollStep);
  initialStepRef.current = initialScrollStep;

  const scheduleScrollToStep = useCallback(() => {
    const target = Number(initialStepRef.current);
    if (!target || !docsFetchedRef.current) return;
    if (didScrollToStep.current && Date.now() - didScrollToStep.current > 900) return;
    if (scrollStepTimer.current) clearTimeout(scrollStepTimer.current);
    scrollStepTimer.current = setTimeout(() => {
      const local = stepAnchors.current[target];
      if (typeof local !== 'number') return;
      const y = (stepsWrapY.current || 0) + local;
      didScrollToStep.current = Date.now();
      listRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
    }, 220);
  }, []);

  const pinStep = (step, y) => {
    if (!step || typeof y !== 'number') return;
    stepAnchors.current[step] = y;
    scheduleScrollToStep();
  };
  const [psDay, setPsDay] = useState('');     // tercih edilen en erken başlangıç: gün/ay/yıl
  const [psMonth, setPsMonth] = useState('');
  const [psYear, setPsYear] = useState('');
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerPdf, setViewerPdf] = useState(false);
  const [downloading, setDownloading] = useState(false); // görüntüleyicide indir/paylaş
  const [unlocked, setUnlocked] = useState(null);     // null = henüz bilinmiyor, true/false
  const [deadline, setDeadline] = useState(null);     // pasaport 14 gün son tarihi
  const [workStartAt, setWorkStartAt] = useState(null);
  const [plannedEndOn, setPlannedEndOn] = useState(null);
  const [flightDepartOn, setFlightDepartOn] = useState(null);
  const [contract, setContract] = useState(null);     // acentenin doldurduğu sözleşme verisi
  const [processStatus, setProcessStatus] = useState(null);
  const [flight, setFlight] = useState(null);         // acentenin doldurduğu uçuş bilgisi
  const [nameSheet, setNameSheet] = useState(false);  // pasaport (Latin) isim düzeltme
  const [nFirst, setNFirst] = useState('');
  const [nLast, setNLast] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [cvData, setCvData] = useState(null);         // PDF üretmek için adayın CV'si
  const [contractPreview, setContractPreview] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [chatOpen, setChatOpen] = useState(!!initialChatOpen);
  const [passportSheet, setPassportSheet] = useState(false);
  const [passportMode, setPassportMode] = useState('upload'); // 'upload' | 'edit'
  const [pNo, setPNo] = useState('');
  const [pPlace, setPPlace] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false); // kısa "✓ Güncellendi" göstergesi
  const [sending, setSending] = useState(false);           // "Belgeleri Gönder" sırasında
  const [refreshing, setRefreshing] = useState(false);     // aşağı çekerek yenile
  const [extraBusy, setExtraBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [docsReady, setDocsReady] = useState(false);
  const [openStep, setOpenStep] = useState(null);          // null = aktif adım açık
  const turnBlink = useRef(new Animated.Value(1)).current;
  // Tüm adımlar dosya ile tamamlanır (imzalı sözleşme dâhil). isUploaded: satır var (taslak da
  // olabilir). isSubmitted: gönderilmiş (karşı tarafa geçmiş).
  const isUploaded = (k) => !!docs[k];
  const isSubmitted = (k) => !!docs[k]?.submitted_at;
  // Akış (kindState/activeStep) GÖNDERİLEN belgeyle ilerler; taslak adımı ilerletmez.
  const has = isSubmitted;
  const turnAct = unlocked ? activeStep(has) : 0;
  const turnDef = PIPELINE.find((s) => s.step === turnAct);
  const turnMine = !!(unlocked && turnDef && stepActor(turnDef, has) === 'candidate');
  const turnStepKey = turnDef?.titleKey || (turnAct >= 6 ? 'pipe_step_6' : null);

  // Yol haritası zaten tüm süreci gösteriyor — bu sayfada yalnızca odak adımı.
  const navStep = Number(initialScrollStep);
  const focusStep = (() => {
    if (navStep >= 1 && navStep <= 7) return navStep;
    if (!unlocked) return null;
    if (turnAct >= 1 && turnAct <= 5) return turnAct;
    if (turnAct >= 6) {
      if (!(has('flight_ticket') || flight?.pickupSent)) return 6;
      return 7;
    }
    return null;
  })();
  const headerTitle = t('docs_title');
  const focusHintKey = focusStep === 7
    ? (has('success_certificate') ? 'pipe_step_7_desc' : 'pipe_step_7_wait')
    : (focusStep >= 1 && focusStep <= 6 ? `journey_hint_${focusStep}` : null);

  useEffect(() => {
    if (!turnMine) {
      turnBlink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(turnBlink, { toValue: 0.38, duration: 620, useNativeDriver: true }),
      Animated.timing(turnBlink, { toValue: 1, duration: 620, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [turnMine, turnBlink]);

  useEffect(() => {
    const needTick = (docsReady && unlocked && turnAct === 1 && deadline?.end) || !!flight?.arriveAt;
    if (!needTick) return undefined;
    setNowTick(Date.now());
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [docsReady, unlocked, turnAct, deadline?.end, flight?.arriveAt]);

  // Rıza penceresi tam kapandığında galeriyi aç (modal çakışmasını önler). Tek sefer çalışır.
  const runPendingPick = () => {
    const k = pendingPick.current;
    if (!k) return;
    pendingPick.current = null;
    startUpload(k);
  };


  // Bildirimden gelince sohbeti aç.
  useEffect(() => {
    if (initialChatOpen) setChatOpen(true);
  }, [initialChatOpen]);

  useEffect(() => {
    const n = Number(initialScrollStep);
    if (n >= 1 && n <= 7) setOpenStep(n);
  }, [initialScrollStep]);

  const applyStatus = useCallback((status) => {
    setProcessStatus(status?.status || null);
    setUnlocked(docsUnlocked(status));
    setDeadline(passportDeadline(status));
    setWorkStartAt(status?.work_start_at || null);
    setPlannedEndOn(status?.planned_end_on || status?.work_end_at || null);
    setFlightDepartOn(status?.flight_depart_on || null);
  }, []);

  const refreshDocs = useCallback(async () => {
    const [rows, con, fl, status] = await Promise.all([
      listDocuments(userId), getContract(userId), getFlight(userId), getCandidateStatus(userId),
    ]);
    const map = {};
    rows.forEach((r) => { map[r.kind] = r; });
    setDocs(map);
    setContract(con);
    setFlight(fl);
    applyStatus(status);
    setDocsReady(true);
    docsFetchedRef.current = true;
    requestAnimationFrame(() => scheduleScrollToStep());
  }, [userId, applyStatus, scheduleScrollToStep]);

  // Elle yenile (aşağı çek).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshDocs(); } finally { setRefreshing(false); }
  }, [refreshDocs]);

  // ANLIK yansıma: acentenin gönderdiği sözleşme/uçuş/belge değişikliklerini realtime dinle.
  // (Supabase'de realtime açık olmalı — bkz. 0020_realtime.sql. Değilse aşağı çekerek yenile.)
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`my-docs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents', filter: `user_id=eq.${userId}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${userId}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights', filter: `user_id=eq.${userId}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_status', filter: `user_id=eq.${userId}` }, () => refreshDocs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refreshDocs]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const status = await getCandidateStatus(userId);
      if (!alive) return;
      applyStatus(status);
      const open = docsUnlocked(status);
      const dl = passportDeadline(status);
      if (open && dl?.overdue) notifyDocsDeadline(userId);
      if (!open) return; // kilitliyse rıza/belge çekmeye gerek yok
      const [row, prof] = await Promise.all([getLatestConsent(userId), loadProfile(userId)]);
      if (!alive) return;
      setConsent(row);
      setCvData(prof || {});
      await refreshDocs();
    })();
    return () => { alive = false; };
  }, [userId, refreshDocs, applyStatus]);

  useEffect(() => () => {
    if (scrollStepTimer.current) clearTimeout(scrollStepTimer.current);
  }, []);

  // Ret nedenini kullanıcıya gösterilecek metne çevir.
  const rejectReason = (note) => {
    switch (note) {
      case 'expired': return t('doc_st_expired');
      case 'expiring_soon': return t('doc_st_expiring');
      case 'not_passport': return t('doc_st_notpassport');
      default: return t('doc_st_unreadable'); // unreadable / bad_date / diğer
    }
  };

  const askExtraTime = () => {
    Alert.alert(t('docs_extra_btn'), t('docs_extra_confirm', { n: String(DOCS_EXTRA_DAYS) }), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('docs_extra_btn'), onPress: async () => {
        setExtraBusy(true);
        try {
          await requestDocsExtraTime();
          await refreshDocs();
        } catch (e) {
          const msg = String(e?.message || '');
          Alert.alert(
            t('docs_extra_btn'),
            /already_requested/i.test(msg) ? t('docs_extra_done', { n: String(DOCS_EXTRA_DAYS) }) : t('docs_extra_fail'),
          );
        } finally {
          setExtraBusy(false);
        }
      } },
    ]);
  };

  // Pasaport PDF yüklendikten sonra Gemini ile doğrula (verify-passport edge function).
  const runPassportVerify = async (row) => {
    if (!PASSPORT_VERIFY_ENABLED || !row) return;
    setVerifying('passport');
    setVerifyOverlay('verifying');
    try {
      let v = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        v = await verifyDocument('passport');
        if (!(v && v.status === 'review' && v.note === 'ai_unavailable')) break;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2500));
      }
      const realVerdict = v && (v.status === 'valid' || (v.status === 'review' && v.note !== 'ai_unavailable'));
      if (realVerdict) {
        setDocs((m) => ({ ...m, passport: { ...(m.passport || {}), status: v.status, note: v.note, expiry_date: v.expiryDate } }));
        const f = v.fields || {};
        const patch = {};
        if (f.passportNumber) patch.passportNo = String(f.passportNumber).replace(/\s+/g, '').trim();
        const pob = birthPlaceFromOcr(f.placeOfBirth, cvData);
        if (pob) patch.birthPlace = pob;
        if (cvData && Object.keys(patch).length) {
          const merged = { ...cvData, ...patch };
          setCvData(merged);
          saveProfile(userId, merged, lang).catch((e2) => console.warn('pasaport alanları kaydedilemedi:', e2?.message));
        }
        setVerifyOverlay('success');
        setTimeout(() => setVerifyOverlay(null), 1800);
      } else if (v && v.status === 'invalid') {
        setVerifyOverlay(null);
        await removeDocument(userId, 'passport', row.storage_path).catch(() => {});
        setDocs((m) => { const n = { ...m }; delete n.passport; return n; });
        Alert.alert(t('doc_rejected_title'), rejectReason(v.note));
      } else {
        setVerifyOverlay('success');
        setTimeout(() => setVerifyOverlay(null), 1800);
      }
    } catch (e) {
      console.warn('passport verify error (sessiz):', e?.message);
      setVerifyOverlay('success');
      setTimeout(() => setVerifyOverlay(null), 1800);
    } finally {
      setVerifying(null);
    }
  };

  // Galeriden FOTO seç + yükle (JPEG'e çevrilir). Pasaport dışı belgeler için.
  const uploadFromUri = async (docKey, uri) => {
    try {
      setUploading(docKey);
      const base64 = await readableJpeg(uri);
      const row = await uploadDocument(userId, docKey, base64, 'image/jpeg');
      setDocs((m) => ({ ...m, [docKey]: row }));
      setUploading(null);
      setJustUploaded(true); setTimeout(() => setJustUploaded(false), 1500);
    } catch (e) {
      const msg = e?.message === 'contract_payment_required' || String(e?.message || '').includes('contract_payment_required')
        ? t('contract_payment_required')
        : t('doc_upload_error');
      Alert.alert(t('docs_title'), msg);
      setUploading(null);
    }
  };

  // Galeriden FOTO seç + yükle (JPEG'e çevrilir).
  const pickImage = async (docKey) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1,
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      await uploadFromUri(docKey, res.assets[0].uri);
    } catch (e) {
      Alert.alert(t('docs_title'), t('doc_upload_error'));
    }
  };

  // PDF seç + yükle. Pasaport ve çoğu resmi belge yalnızca PDF.
  const pickPdf = async (docKey) => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const { File } = await import('expo-file-system');
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { Alert.alert(t('docs_title'), t('doc_pdf_only')); return; }
      setUploading(docKey);
      const base64 = await new File(a.uri).base64();
      const row = await uploadDocument(userId, docKey, base64, 'application/pdf');
      setDocs((m) => ({ ...m, [docKey]: row }));
      setUploading(null);
      setJustUploaded(true); setTimeout(() => setJustUploaded(false), 1500);
      if (docKey === 'passport') await runPassportVerify(row);
    } catch (e) {
      const msg = e?.message === 'contract_payment_required' || String(e?.message || '').includes('contract_payment_required')
        ? t('contract_payment_required')
        : t('doc_upload_error');
      Alert.alert(t('docs_title'), msg);
      setUploading(null);
    }
  };

  // Pasaport: yalnızca PDF. Sağlık raporu vb.: foto VEYA PDF. Diğerleri: yalnızca PDF.
  const startUpload = (docKey) => {
    if (docKey === 'passport') { pickPdf('passport'); return; }
    // Sağlık raporu + konsolosluk ref (ekran görüntüsü) + çalışma izni (fiziksel kart): foto VEYA PDF.
    if (docKey === 'health_report' || docKey === 'consulate_ref' || docKey === 'work_permit') {
      Alert.alert(t('doc_choose_title'), undefined, [
        { text: t('doc_choose_photo'), onPress: () => pickImage(docKey) },
        { text: t('doc_choose_pdf'), onPress: () => pickPdf(docKey) },
        { text: t('consent_cancel'), style: 'cancel' },
      ]);
      return;
    }
    pickPdf(docKey);
  };

  // Satır rozeti: yükleme/doğrulama durumuna ve sonuca göre metin + ton.
  const docBadge = (kind) => {
    if (uploading === kind) return { text: t('doc_uploading'), tone: 'neutral' };
    if (verifying === kind) return { text: t('doc_verifying'), tone: 'neutral' };
    const d = docs[kind];
    if (!d) return { text: t('doc_missing'), tone: 'miss' };
    switch (d.status) {
      case 'valid': return { text: `✓ ${t('doc_st_valid')}`, tone: 'ok' };
      case 'invalid':
        if (d.note === 'expiring_soon') return { text: t('doc_st_expiring'), tone: 'err' };
        if (d.note === 'not_passport') return { text: t('doc_st_notpassport'), tone: 'err' };
        return { text: t('doc_st_expired'), tone: 'err' };
      case 'unreadable': return { text: t('doc_st_unreadable'), tone: 'warn' };
      case 'review': return { text: t('doc_st_review'), tone: 'warn' };
      default: return { text: `✓ ${t('doc_uploaded')}`, tone: 'ok' };
    }
  };

  // "Ekle"/"Değiştir": Rızayı fiili yükleme anına bağlı tutuyoruz. Belge henüz
  // yüklenmemişse, geçmişte rıza verilmiş olsa bile HER seferinde yeniden sorulur
  // (kişi onaylayıp yüklemeden çıkabilir). Yüklü belgeyi değiştirirken sorulmaz.
  const handleAdd = (docKey, needsSensitive) => {
    // Ödemesiz imzalı sözleşme yüklenemez (UI + DB kilidi).
    if (docKey === 'contract_signed' && CONTRACT_WEB_PAYMENT_ENABLED && !contract?.isPaid) {
      Alert.alert(t('docs_title'), t('contract_payment_required'));
      return;
    }
    const uploaded = !!docs[docKey];
    const consentOk = canUploadDocs(consent) && (!needsSensitive || hasSensitiveConsent(consent));
    if (uploaded && consentOk) { startUpload(docKey); return; }
    setPendingDoc(docKey);
    setRequireSensitive(needsSensitive);
    setSheetOpen(true);
  };

  // Pasaport: yalnızca PDF; doğrulama sonrası no/doğum yeri OCR ile dolar (gerekirse düzenlenir).
  const startPassport = () => handleAdd('passport', false);

  // Yükledikten sonra düzenleme: no/doğum yeri değiştir ve/veya PDF'i değiştir.
  const editPassport = () => {
    setPNo(cvData?.passportNo || '');
    setPPlace(cvData?.birthPlace || '');
    setPassportMode('edit');
    setPassportSheet(true);
  };

  // withPhoto: bilgileri kaydet + (true ise) görseli de yeniden seç.
  // Pencere Modal DEĞİL (ekran-içi katman); galeri kapatmadan üstüne açılır -> "atma" hissi yok.
  const savePassportInfo = async (withPhoto) => {
    if (!pNo.trim() || !pPlace.trim()) return;
    setSavingInfo(true);
    try {
      const { candidateNo, ...rest } = cvData || {};
      const merged = { ...rest, passportNo: pNo.trim(), birthPlace: pPlace.trim() };
      await saveProfile(userId, merged, lang);
      setCvData(merged);
      setPassportSheet(false);
      if (withPhoto) pickPdf('passport');
    } catch (e) {
      Alert.alert(t('passport_info_title'), t('doc_upload_error'));
    } finally {
      setSavingInfo(false);
    }
  };

  const handleAccept = async (choices) => {
    if (!userId) { Alert.alert(t('docs_title'), t('consent_error')); return; }
    setSaving(true);
    try {
      // Pasaport akışında özel nitelikli kutu gösterilmez; daha önce verilmiş
      // özel nitelikli rızayı yeni satıra taşı ki düşmesin.
      const sensitive = requireSensitive ? choices.sensitive : (consent?.sensitive ?? false);
      const row = await saveConsent(userId, { general: choices.general, crossBorder: choices.crossBorder, sensitive, locale: lang });
      setConsent(row);
      const next = pendingDoc;
      setPendingDoc(null);
      // Galeriyi rıza penceresi TAM kapanınca aç (onDismiss). Yedek olarak zamanlayıcı
      // da kuruyoruz; ref sayesinde ikisinden hangisi önce gelirse bir kez çalışır.
      pendingPick.current = next;
      setSheetOpen(false);
      setTimeout(runPendingPick, 600);
    } catch (e) {
      Alert.alert(t('docs_title'), t('consent_error'));
    } finally {
      setSaving(false);
    }
  };

  const handleView = async (docKey) => {
    try {
      // Sözleşme: ödeme portalı açıkken her zaman web (app içi PDF atlanır — indir/yazdır orada).
      if (docKey === 'contract_unsigned' && CONTRACT_WEB_PAYMENT_ENABLED) {
        setOpeningPortal(true);
        try {
          await openContractPortal(lang);
          await refreshDocs(); // dönüşte ödeme durumunu yenile
        } catch (e) {
          console.warn('portal:', e?.message);
          Alert.alert(t('docs_title'), e?.message || t('doc_upload_error'));
        } finally {
          setOpeningPortal(false);
        }
        return;
      }
      // Flag kapalı: yüklenmiş PDF varsa görüntüle; yoksa app içi önizleme.
      if (docKey === 'contract_unsigned' && !docs[docKey]) {
        setContractPreview(true);
        return;
      }
      const row = docs[docKey];
      if (!row) return;
      const url = await getSignedUrl(row.storage_path, 120);
      setViewerPdf((row.mime_type || '').includes('pdf') || (row.storage_path || '').toLowerCase().endsWith('.pdf'));
      setViewerUrl(url);
    } catch (e) {
      Alert.alert(t('docs_title'), t('doc_upload_error'));
    }
  };

  // Görüntüleyicideki belgeyi indir/paylaş (uzak imzalı URL -> yerel dosya -> paylaş sayfası).
  const shareViewer = async () => {
    if (!viewerUrl || downloading) return;
    setDownloading(true);
    try {
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) { Alert.alert(t('docs_title'), t('doc_upload_error')); return; }
      const ext = viewerPdf ? 'pdf' : 'jpg';
      // Yeni (SDK 54) File API ile uzak dosyayı önbelleğe indir.
      const FS = await import('expo-file-system');
      const dest = new FS.File(FS.Paths.cache, `belge_${Date.now()}.${ext}`);
      try { dest.delete(); } catch (_) { /* yoksa sorun değil */ }
      const out = await FS.File.downloadFileAsync(viewerUrl, dest);
      const localUri = (out && out.uri) || dest.uri;
      await Sharing.shareAsync(localUri, viewerPdf
        ? { mimeType: 'application/pdf', dialogTitle: t('contract_title'), UTI: 'com.adobe.pdf' }
        : { mimeType: 'image/jpeg', dialogTitle: t('doc_view') });
    } catch (e) {
      console.warn('indir/paylaş hatası:', e?.message);
      Alert.alert(t('docs_title'), t('doc_upload_error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = (docKey) => {
    const row = docs[docKey];
    if (!row) return;
    Alert.alert(t('docs_title'), `${t('photo_remove')}?`, [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('photo_remove'), style: 'destructive',
        onPress: async () => {
          setUploading(docKey);
          try {
            await removeDocument(userId, docKey, row.storage_path);
            setDocs((m) => { const n = { ...m }; delete n[docKey]; return n; });
          } catch (e) {
            Alert.alert(t('docs_title'), t('doc_upload_error'));
          } finally {
            setUploading(null);
          }
        },
      },
    ]);
  };

  // "Belgeleri Gönder": adımın tüm (yüklü) belgelerini karşı tarafa ilet. Onay ister;
  // gönderince adım kilitlenir (taslak düzenlenemez) ve acenteye bildirim gider.
  // Tercih edilen başlangıç tarihini cvData'dan doldur.
  useEffect(() => {
    const v = cvData?.preferredStartDate;
    if (v) { const [d, m, y] = String(v).split('.'); setPsDay(d || ''); setPsMonth(m || ''); setPsYear(y || ''); }
  }, [cvData?.preferredStartDate]);

  // Gün/ay/yıl seçilince üçü de doluysa profile'a kaydet (preferredStartDate = "gg.aa.yyyy").
  const setPreferredDate = (which, val) => {
    const cur = { d: psDay, m: psMonth, y: psYear };
    cur[which] = val;
    if (which === 'd') setPsDay(val); else if (which === 'm') setPsMonth(val); else setPsYear(val);
    if (cur.d && cur.m && cur.y && cvData) {
      const merged = { ...cvData, preferredStartDate: `${cur.d}.${cur.m}.${cur.y}` };
      setCvData(merged);
      saveProfile(userId, merged, lang).catch((e) => console.warn('tarih kaydedilemedi:', e?.message));
    }
  };

  const submitStep = (s) => {
    const kinds = s.kinds.filter((k) => k !== 'contract_unsigned' && docs[k]);
    if (!kinds.length) return;
    // Çalışma vizesi adımında tercih edilen başlangıç tarihi zorunlu.
    if (s.kinds.includes('work_permit') && !cvData?.preferredStartDate) {
      Alert.alert(t('docs_title'), t('start_date_required'));
      return;
    }
    Alert.alert(t('docs_send_confirm_title'), t('docs_send_confirm_msg'), [
      { text: t('docs_send_review'), style: 'cancel' },
      {
        text: t('docs_send'),
        onPress: async () => {
          setSending(true);
          try {
            const rows = await submitDocuments(userId, kinds);
            setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
            notifyDocumentSubmit(userId, kinds);
            // Son aday adımı (çalışma vizesi) gönderildiyse tebrik kartına kaydır — yalnızca İLK kez.
            if (kinds.includes('work_permit')) {
              const seenKey = `turquz_congrats_${userId}`;
              const seen = await AsyncStorage.getItem(seenKey).catch(() => null);
              if (!seen) {
                await AsyncStorage.setItem(seenKey, '1').catch(() => {});
                setTimeout(() => listRef.current?.scrollTo({ y: 0, animated: true }), 400);
              }
            }
          } catch (e) {
            Alert.alert(t('docs_title'), t('doc_upload_error'));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  // Sözleşme çıktısı almadan önce: isim pasaportla aynı mı? Onayla ya da düzelt.
  const confirmContractName = () => {
    const full = [latinFirst(cvData), latinLast(cvData)].filter(Boolean).join(' ') || '—';
    Alert.alert(t('name_check_title'), t('name_check_msg', { name: full }), [
      { text: t('name_check_fix'), style: 'destructive', onPress: () => {
          setNFirst(latinFirst(cvData)); setNLast(latinLast(cvData)); setNameSheet(true);
        } },
      { text: t('name_check_ok'), onPress: () => setContractPreview(true) },
    ]);
  };

  // Pasaport (Latin) ad/soyad kaydet, sonra sözleşmeyi aç.
  const saveLatinName = async () => {
    if (!nFirst.trim() || !nLast.trim()) return;
    setSavingName(true);
    try {
      const { candidateNo, ...rest } = cvData || {};
      const merged = { ...rest, passportFirstName: nFirst.trim(), passportLastName: nLast.trim() };
      await saveProfile(userId, merged, lang);
      setCvData(merged);
      setNameSheet(false);
      setContractPreview(true);
    } catch (e) {
      Alert.alert(t('name_sheet_title'), t('doc_upload_error'));
    } finally {
      setSavingName(false);
    }
  };

  const remainMs = deadline?.end ? deadline.end.getTime() - nowTick : 0;

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, fontsReady && styles.titleFont]}>{headerTitle}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        ref={listRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + (PROCESS_CHAT_ENABLED && processChatUnlocked(processStatus, contract) ? 88 : 24) },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2a25a" colors={['#c2a25a']} />}
      >
        {unlocked === null ? (
          <ActivityIndicator color="#c2a25a" style={{ marginTop: 30 }} />
        ) : !unlocked ? (
          <View style={styles.lockCard}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.lockTitle}>{t('docs_locked_title')}</Text>
            <Text style={styles.lockMsg}>{t('docs_locked_msg')}</Text>
          </View>
        ) : (
          <>
            {focusStep ? (
              <View style={styles.focusHero}>
                <View style={styles.focusHeroTop}>
                  <View style={styles.focusNum}>
                    <Text style={styles.focusNumText}>{focusStep}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.focusKicker}>{t('step')} {focusStep} / 7</Text>
                    <Text style={[styles.focusTitle, fontsReady && styles.titleFont]}>{t(`pipe_step_${focusStep}`)}</Text>
                  </View>
                </View>
                {focusHintKey ? (
                  <Text style={styles.focusHint}>{t(focusHintKey)}</Text>
                ) : null}
              </View>
            ) : null}

            {/* Tüm aday adımları bitti (çalışma vizesi gönderildi) -> premium tebrik kartı */}
            {has('work_permit') && (!focusStep || focusStep >= 4) ? (
              <View style={styles.doneCard}>
                <View style={styles.doneFrame} pointerEvents="none" />
                <Image source={require('../assets/turquz-logo.png')} style={styles.doneLogo} resizeMode="contain" />
                <View style={styles.doneOrn}>
                  <View style={styles.doneRule} />
                  <Text style={styles.doneStar}>✦</Text>
                  <View style={styles.doneRule} />
                </View>
                <Text style={styles.doneTitle}>{t('done_congrats_title')}</Text>
                <Text style={styles.doneBody}>{t('done_congrats_body')}</Text>
                <Text style={styles.doneStarBottom}>✦</Text>
              </View>
            ) : null}

            {turnStepKey && (!focusStep || turnAct === focusStep || (focusStep >= 6 && turnAct >= 6)) ? (
              <Animated.View style={turnMine ? { opacity: turnBlink } : null}>
                <View
                  style={[styles.turnBox, turnMine ? styles.turnYou : styles.turnAgency]}
                >
                  {turnMine ? (
                    <View style={styles.turnAlertRow}>
                      <View style={styles.turnBang}><Text style={styles.turnBangText}>!</Text></View>
                      <Text style={[styles.turnKicker, styles.turnKickerYou]}>{t('docs_turn_you')}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.turnKicker, styles.turnKickerAgency]}>{t('docs_turn_agency')}</Text>
                  )}
                  <Text style={styles.turnSub}>{turnMine ? t('docs_turn_you_sub', { step: t(turnStepKey) }) : t('docs_turn_agency_sub', { step: t(turnStepKey) })}</Text>
                </View>
              </Animated.View>
            ) : null}

            <View
              collapsable={false}
              onLayout={(e) => {
                stepsWrapY.current = e.nativeEvent.layout.y;
                scheduleScrollToStep();
              }}
            >
            {PIPELINE.filter((s) => !focusStep || s.step === focusStep).map((s) => {
              const actor = stepActor(s, has);
              const mine = actor === 'candidate';
              const act = activeStep(has);
              const pipelineMode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
              // Acente sırası (örn. uçuş bileti): aday tıklayamaz → diğer kilitli adımlar gibi pasif/renksiz.
              const waitingAgency = pipelineMode === 'active' && !mine;
              const mode = waitingAgency ? 'locked' : pipelineMode;
              const doneN = s.kinds.filter(has).length;
              const totalN = s.kinds.length;
              const tabDone = totalN > 0 && doneN === totalN;
              const cardStyle = mode === 'active'
                ? [styles.stepCard, styles.cardActive]
                : waitingAgency ? [styles.stepCard, styles.cardWait]
                : (tabDone || mode === 'done') ? [styles.stepCard, styles.cardDone]
                  : [styles.stepCard, styles.cardLocked];
              const circleStyle = (tabDone || mode === 'done') ? styles.circleDone
                : mode === 'active' ? styles.circleYou
                  : waitingAgency ? styles.circleWait
                  : styles.circleLocked;
              const expanded = focusStep === s.step
                ? true
                : (mode === 'locked' && !waitingAgency)
                  ? false
                  : (openStep == null ? (mode === 'active' || waitingAgency) : openStep === s.step);
              const canToggle = !focusStep && (mode !== 'locked' || waitingAgency || tabDone || mode === 'done');
              return (
                <View
                  key={s.step}
                  style={cardStyle}
                  collapsable={false}
                  onLayout={(e) => pinStep(s.step, e.nativeEvent.layout.y)}
                >
                  {focusStep === s.step ? (
                    <View style={styles.focusMetaRow}>
                      {pipelineMode !== 'locked' ? (
                        <View style={[styles.ownerChip, waitingAgency || !mine ? styles.ownerOther : styles.ownerYou]}>
                          <Text style={[styles.ownerChipText, waitingAgency || !mine ? styles.ownerOtherText : styles.ownerYouText]}>
                            {mine && !waitingAgency ? t('doc_owner_you') : t('doc_owner_agency')}
                          </Text>
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }} />
                      {mode === 'active' ? (
                        <View style={styles.nowChip}><Text style={styles.nowChipText}>{t('docs_now')}</Text></View>
                      ) : waitingAgency ? (
                        <Text style={styles.waitLabel}>{t('docs_waiting')}</Text>
                      ) : pipelineMode === 'locked' && !tabDone ? (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      ) : (
                        <Text style={[styles.progressLabel, tabDone && styles.progressDone]}>
                          {t('docs_progress', { n: String(doneN), m: String(totalN) })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.stepHead}
                      onPress={() => {
                        if (!canToggle) return;
                        setOpenStep((cur) => (cur === s.step ? null : s.step));
                      }}
                      activeOpacity={canToggle ? 0.85 : 1}
                      disabled={!canToggle}
                    >
                      <View style={[styles.stepNo, circleStyle]}>
                        <Text style={styles.stepNoText}>{(tabDone || mode === 'done') ? '✓' : s.step}</Text>
                      </View>
                      <Text style={[styles.stepTitle, pipelineMode === 'locked' && styles.stepTitleMuted]} numberOfLines={2}>{t(s.titleKey)}</Text>
                      {pipelineMode !== 'locked' ? (
                        <View style={[styles.ownerChip, waitingAgency || !mine ? styles.ownerOther : styles.ownerYou]}>
                          <Text style={[styles.ownerChipText, waitingAgency || !mine ? styles.ownerOtherText : styles.ownerYouText]}>
                            {mine && !waitingAgency ? t('doc_owner_you') : t('doc_owner_agency')}
                          </Text>
                        </View>
                      ) : null}
                      {mode === 'active' ? (
                        <View style={styles.nowChip}><Text style={styles.nowChipText}>{t('docs_now')}</Text></View>
                      ) : waitingAgency ? (
                        <Text style={styles.waitLabel}>{t('docs_waiting')}</Text>
                      ) : pipelineMode === 'locked' && !tabDone ? (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      ) : (
                        <Text style={[styles.progressLabel, tabDone && styles.progressDone]}>
                          {t('docs_progress', { n: String(doneN), m: String(totalN) })}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {s.step === 1 && docsReady && deadline && !s.kinds.every(has) ? (
                    <View style={[styles.deadlineBox, remainMs <= 0 ? styles.deadlineOver : remainMs <= 3 * 24 * 3600 * 1000 ? styles.deadlineWarn : null]}>
                      <Text style={[styles.deadlineClock, remainMs <= 0 && styles.deadlineClockOver]}>
                        {remainMs <= 0 ? t('deadline_overdue_short') : formatDeadlineRemain(remainMs, t)}
                      </Text>
                      <Text style={styles.deadlineText}>
                        {remainMs <= 0 ? t('docs_pkg_overdue') : t('docs_countdown_sub')}
                      </Text>
                      {deadline.extraRequested ? (
                        <Text style={styles.deadlineExtraDone}>{t('docs_extra_done', { n: String(DOCS_EXTRA_DAYS) })}</Text>
                      ) : (
                        <TouchableOpacity
                          style={[styles.deadlineExtraBtn, extraBusy && { opacity: 0.6 }]}
                          onPress={askExtraTime}
                          disabled={extraBusy}
                          activeOpacity={0.88}
                        >
                          {extraBusy
                            ? <ActivityIndicator color="#1b2533" />
                            : <Text style={styles.deadlineExtraText}>{t('docs_extra_btn')}</Text>}
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}

                  {expanded ? (
                    <>
                  {s.kinds.map((kind) => {
                    const kst = kindState(kind, has);
                    // Acente beklerken satırı da kilitli göster (yükle butonu / canlı renk yok).
                    const showState = waitingAgency && kst === 'active' ? 'locked' : kst;
                    const sensitive = kind === 'criminal' || kind === 'health_report';
                    const langNote = kind === 'diploma' || kind === 'criminal' || kind === 'health_report';
                    const busy = uploading === kind || verifying === kind;
                    const draft = mine && isUploaded(kind) && !isSubmitted(kind); // yüklendi, gönderilmedi
                    const muteLabel = mode === 'locked' || (mode === 'done' && mine);
                    return (
                      <View key={kind} style={styles.subRow}>
                        <View style={styles.subMain}>
                          <Text style={[styles.subBullet, (showState === 'done' || draft) && styles.subBulletDone]}>{(showState === 'done' || draft) ? '✓' : '•'}</Text>
                          <Text style={[styles.subLabel, muteLabel && styles.subLabelMuted]}>{t(`doc_${kind}`)}</Text>
                          {draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                          <View style={{ flex: 1 }} />
                          {showState === 'done' && !mine ? (
                            <TouchableOpacity onPress={() => handleView(kind)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={styles.linkAgency}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : showState === 'done' ? (
                            <TouchableOpacity onPress={() => handleView(kind)}><Text style={styles.linkMuted}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : draft ? (
                            <TouchableOpacity onPress={() => handleView(kind)}><Text style={styles.link}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : showState === 'active' && mine && kind === 'contract_signed' ? (
                            null /* sözleşme: indir + yükle butonları aşağıdaki kutuda (sıralı) */
                          ) : showState === 'active' && mine ? (
                            <TouchableOpacity style={styles.addBtnSm} onPress={() => (kind === 'passport' ? startPassport() : handleAdd(kind, sensitive))} disabled={busy} activeOpacity={0.8}>
                              {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.addBtnText}>{t('doc_upload')}</Text>}
                            </TouchableOpacity>
                          ) : showState === 'locked' ? (
                            <Text style={styles.lockedIcon}>🔒</Text>
                          ) : null}
                        </View>
                        {draft ? (
                          <View style={styles.subLinks}>
                            {kind === 'passport' ? (
                              <>
                                <TouchableOpacity style={styles.changeBtn} onPress={editPassport} activeOpacity={0.85}>
                                  <Text style={styles.changeBtnText}>✎ {t('passport_edit_info')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.changeBtn} onPress={() => pickPdf('passport')} activeOpacity={0.85}>
                                  <Text style={styles.changeBtnText}>✎ {t('passport_change_pdf')}</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <TouchableOpacity style={styles.changeBtn} onPress={() => handleAdd(kind, sensitive)} activeOpacity={0.85}>
                                <Text style={styles.changeBtnText}>✎ {t('photo_change')}</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.changeBtn} onPress={() => handleRemove(kind)} activeOpacity={0.85}>
                              <Text style={[styles.changeBtnText, styles.removeText]}>🗑 {t('photo_remove')}</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                        {kind === 'passport' && mine && showState === 'active' && !draft ? (
                          <View style={styles.langNoteBox}>
                            <Text style={styles.langNoteText}>ℹ️ {t('doc_passport_desc')}</Text>
                            <Text style={[styles.langNoteText, styles.langNoteTextGap]}>{t('doc_passport_upload_hint')}</Text>
                          </View>
                        ) : null}
                        {langNote && mode === 'active' && !draft ? (
                          <View style={styles.langNoteBox}><Text style={styles.langNoteText}>⚠ {t('doc_lang_note')}</Text></View>
                        ) : null}
                        {kind === 'consulate_ref' && mine && showState === 'active' && !draft ? (
                          <View style={[styles.page3Note, { marginLeft: 22 }]}><Text style={styles.page3NoteText}>📌 {t('consulate_ref_note')}</Text></View>
                        ) : null}
                        {kind === 'work_permit' && mine && showState === 'active' && !draft ? (
                          <View style={[styles.page3Note, { marginLeft: 22 }]}><Text style={styles.page3NoteText}>📌 {t('doc_work_permit_desc')}</Text></View>
                        ) : null}
                        {/* Çalışma vizesiyle birlikte: başlamayı tercih ettiği en erken tarih */}
                        {kind === 'work_permit' && mine && showState === 'active' ? (
                          <View style={styles.startDateBox}>
                            <Text style={styles.startDateLabel}>{t('start_date_label')}</Text>
                            <View style={styles.startDateRow}>
                              <View style={styles.startDateCol}><Select label={t('f_day')} value={psDay} options={DAYS} onChange={(v) => setPreferredDate('d', v)} /></View>
                              <View style={styles.startDateCol}><Select label={t('f_month')} value={psMonth} options={monthOptions(lang)} onChange={(v) => setPreferredDate('m', v)} /></View>
                              <View style={styles.startDateCol}><Select label={t('f_year')} value={psYear} options={FLIGHT_YEARS} onChange={(v) => setPreferredDate('y', v)} /></View>
                            </View>
                            <Text style={styles.startDateNote}>ℹ️ {t('start_date_note')}</Text>
                          </View>
                        ) : null}
                        {kind === 'work_permit' && mine && showState === 'done' && cvData?.preferredStartDate ? (
                          <View style={styles.startDateBox}>
                            <Text style={styles.startDateLabel}>📅 {t('start_date_label')}: {cvData.preferredStartDate}</Text>
                          </View>
                        ) : null}
                        {kind === 'flight_ticket' && isSubmitted('flight_ticket') && (workStartAt || flightDepartOn || flight?.arriveAt) ? (
                          <View style={styles.startDateBox}>
                            {flight?.arriveAt ? (
                              <Text style={styles.startDateLabel}>{t('flight_arrive_label')}: {flight.arriveAt}</Text>
                            ) : null}
                            {flightDepartOn ? (
                              <Text style={styles.startDateLabel}>✈️ {t('flight_depart_label')}: {fmtDocDate(flightDepartOn)}</Text>
                            ) : null}
                            {workStartAt ? (
                              <Text style={styles.startDateLabel}>📅 {t('work_start_label')}: {fmtDocDate(workStartAt)}</Text>
                            ) : null}
                            {plannedEndOn ? (
                              <Text style={styles.startDateNote}>{t('work_end_label')}: {fmtDocDate(plannedEndOn)}</Text>
                            ) : null}
                          </View>
                        ) : null}
                        {/* İmzalı sözleşme: tek yükleme butonu (ödeme sonrası aktif) */}
                        {kind === 'contract_signed' && mine && showState === 'active' && !draft ? (
                          <View style={styles.signBox}>
                            <Text style={styles.stSub}>{t('contract_upload_sub')}</Text>
                            {CONTRACT_WEB_PAYMENT_ENABLED && !contract?.isPaid ? (
                              <>
                                <View style={[styles.stBtnGold, styles.stBtnDisabled]}>
                                  <Text style={styles.stBtnGoldText}>⬆  {t('contract_btn_upload')}</Text>
                                </View>
                                <Text style={styles.payGate}>{t('contract_pay_gate')}</Text>
                              </>
                            ) : (
                              <TouchableOpacity
                                style={[styles.stBtnGold, busy && { opacity: 0.6 }]}
                                onPress={() => handleAdd('contract_signed', false)}
                                disabled={busy}
                                activeOpacity={0.85}
                              >
                                {busy
                                  ? <ActivityIndicator color="#1b2533" />
                                  : <Text style={styles.stBtnGoldText}>⬆  {t('contract_btn_upload')}</Text>}
                              </TouchableOpacity>
                            )}
                            <View style={styles.page3Note}>
                              <Text style={styles.page3NoteText}>{t('contract_page3_note')}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {/* Belgeleri Gönder: adayın bu adımdaki belgeleri yüklü (taslak) */}
                  {mode === 'active' && mine && s.kinds.filter((k) => kindOwner(k) === 'candidate').every((k) => isUploaded(k)) ? (
                    <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={() => submitStep(s)} disabled={sending} activeOpacity={0.9}>
                      {sending ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sendBtnText}>{t('docs_send')}  →</Text>}
                    </TouchableOpacity>
                  ) : null}

                  {waitingAgency ? (
                    <View style={styles.waitBanner}><Text style={styles.waitBannerText}>⏳ {t('doc_agency_turn')}</Text></View>
                  ) : null}
                    </>
                  ) : null}
                </View>
              );
            })}

            {/* 6) Havaalanı transfer — bilet gelmeden kilitli */}
            {(!focusStep || focusStep === 6) ? (() => {
              const pickupOpen = has('flight_ticket') || flight?.pickupSent;
              return (
                <View
                  style={[styles.stepCard, pickupOpen ? styles.cardDone : styles.cardLocked]}
                  collapsable={false}
                  onLayout={(e) => pinStep(6, e.nativeEvent.layout.y)}
                >
                  {focusStep === 6 ? (
                    <View style={styles.focusMetaRow}>
                      <View style={[styles.ownerChip, pickupOpen ? styles.ownerOther : styles.ownerMuted]}>
                        <Text style={[styles.ownerChipText, pickupOpen ? styles.ownerOtherText : styles.ownerMutedText]}>{t('doc_owner_agency')}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      {pickupOpen ? (
                        <Text style={[styles.progressLabel, styles.progressDone]}>{t('docs_progress', { n: '1', m: '1' })}</Text>
                      ) : (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.stepHead}>
                      <View style={[styles.stepNo, pickupOpen ? styles.circleDone : styles.circleLocked]}>
                        <Text style={styles.stepNoText}>{pickupOpen ? '✓' : '6'}</Text>
                      </View>
                      <Text style={[styles.stepTitle, !pickupOpen && styles.stepTitleMuted]}>{t('pipe_step_6')}</Text>
                      <View style={[styles.ownerChip, pickupOpen ? styles.ownerOther : styles.ownerMuted]}>
                        <Text style={[styles.ownerChipText, pickupOpen ? styles.ownerOtherText : styles.ownerMutedText]}>{t('doc_owner_agency')}</Text>
                      </View>
                      {pickupOpen ? (
                        <Text style={[styles.progressLabel, styles.progressDone]}>{t('docs_progress', { n: '1', m: '1' })}</Text>
                      ) : (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      )}
                    </View>
                  )}
                  {pickupOpen ? (
                    <>
                      {flight?.arriveAt && msUntilArrival(flight.arriveAt, nowTick) > 0 ? (
                        <CountdownBanner
                          variant="muted"
                          titleKey="arrive_countdown_title"
                          subKey="arrive_countdown_sub"
                          leftMs={msUntilArrival(flight.arriveAt, nowTick)}
                        />
                      ) : null}
                      <PickupCard
                      embedded
                      userId={userId}
                      role="candidate"
                      flight={flight}
                      label={[cvData?.firstName, cvData?.lastName].filter(Boolean).join(' ')}
                    />
                    </>
                  ) : (
                    <Text style={styles.pickupLockText}>🔒 {t('pickup_lock')}</Text>
                  )}
                </View>
              );
            })() : null}

            {/* 7) Turquz başarı sertifikası — admin yükler */}
            {(!focusStep || focusStep === 7) ? (() => {
              const certOpen = has('success_certificate');
              return (
                <View
                  style={[styles.stepCard, certOpen ? styles.cardDone : styles.cardLocked]}
                  collapsable={false}
                  onLayout={(e) => pinStep(7, e.nativeEvent.layout.y)}
                >
                  {focusStep === 7 ? (
                    <View style={styles.focusMetaRow}>
                      <View style={[styles.ownerChip, certOpen ? styles.ownerOther : styles.ownerMuted]}>
                        <Text style={[styles.ownerChipText, certOpen ? styles.ownerOtherText : styles.ownerMutedText]}>{t('doc_owner_turquz')}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      {certOpen ? (
                        <Text style={[styles.progressLabel, styles.progressDone]}>{t('docs_progress', { n: '1', m: '1' })}</Text>
                      ) : (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.stepHead}>
                      <View style={[styles.stepNo, certOpen ? styles.circleDone : styles.circleLocked]}>
                        <Text style={styles.stepNoText}>{certOpen ? '✓' : '7'}</Text>
                      </View>
                      <Text style={[styles.stepTitle, !certOpen && styles.stepTitleMuted]}>{t('pipe_step_7')}</Text>
                      <View style={[styles.ownerChip, certOpen ? styles.ownerOther : styles.ownerMuted]}>
                        <Text style={[styles.ownerChipText, certOpen ? styles.ownerOtherText : styles.ownerMutedText]}>{t('doc_owner_turquz')}</Text>
                      </View>
                      {certOpen ? (
                        <Text style={[styles.progressLabel, styles.progressDone]}>{t('docs_progress', { n: '1', m: '1' })}</Text>
                      ) : (
                        <Text style={styles.lockedIcon}>🔒</Text>
                      )}
                    </View>
                  )}
                  {certOpen ? (
                    <>
                      <Text style={styles.certCongrats}>🎉 {t('pipe_step_7_desc')}</Text>
                      <View style={styles.subRow}>
                        <View style={styles.subMain}>
                          <Text style={[styles.subBullet, styles.subBulletDone]}>✓</Text>
                          <Text style={styles.subLabel}>{t('doc_success_certificate')}</Text>
                          <View style={{ flex: 1 }} />
                          <TouchableOpacity onPress={() => handleView('success_certificate')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.linkAgency}>{t('doc_view')}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.pickupLockText}>🔒 {t('pipe_step_7_wait')}</Text>
                  )}
                </View>
              );
            })() : null}
            </View>
          </>
        )}
      </ScrollView>

      <ConsentSheet
        visible={sheetOpen}
        requireSensitive={requireSensitive}
        busy={saving}
        onAccept={handleAccept}
        onCancel={() => { if (!saving) { pendingPick.current = null; setSheetOpen(false); setPendingDoc(null); } }}
        onClosed={runPendingPick}
      />

      <Modal visible={!!viewerUrl} animationType="slide" onRequestClose={() => setViewerUrl(null)}>
        <View style={styles.viewerWrap}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.viewerTitle}>{t('doc_view')}</Text>
            <TouchableOpacity onPress={() => setViewerUrl(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.viewerX}>✕</Text></TouchableOpacity>
          </View>
          {viewerPdf ? (
            viewerUrl ? <WebView source={{ uri: viewerUrl }} style={styles.viewerBody} originWhitelist={['*']} /> : null
          ) : (
            <ScrollView
              style={styles.viewerBody}
              contentContainerStyle={styles.viewerScroll}
              maximumZoomScale={5}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              {viewerUrl ? <Image source={{ uri: viewerUrl }} style={{ width: winW, height: winH }} resizeMode="contain" /> : null}
            </ScrollView>
          )}
          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={[styles.viewerDl, downloading && { opacity: 0.6 }]} onPress={shareViewer} disabled={downloading} activeOpacity={0.85}>
              {downloading ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.viewerDlText}>{t('pdf_download')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {passportSheet ? (
        <View style={styles.sheetAbs}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setPassportSheet(false); }} />
          <KeyboardAvoidingView style={styles.sheetCenter} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
            <View style={styles.sheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.sheetTitle}>{t('passport_info_title')}</Text>
            <Text style={styles.sheetHint}>{t('passport_info_hint')}</Text>
            <Text style={styles.sheetLabel}>{t('passport_info_no')}</Text>
            <TextInput style={styles.sheetInput} value={pNo} onChangeText={setPNo} placeholder="N18869131" placeholderTextColor="#9aa1ac" autoCapitalize="characters" autoCorrect={false} />
            <Text style={styles.sheetLabel}>{t('passport_info_place')}</Text>
            <TextInput style={styles.sheetInput} value={pPlace} onChangeText={setPPlace} placeholder="Semey / Kazakistan" placeholderTextColor="#9aa1ac" />
            <View style={styles.sheetRow}>
              <TouchableOpacity onPress={() => setPassportSheet(false)} style={styles.sheetCancel}><Text style={styles.sheetCancelText}>{t('consent_cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => savePassportInfo(passportMode === 'upload')} disabled={!pNo.trim() || !pPlace.trim() || savingInfo} style={[styles.sheetSave, (!pNo.trim() || !pPlace.trim() || savingInfo) && { opacity: 0.5 }]} activeOpacity={0.9}>
                {savingInfo ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sheetSaveText}>{passportMode === 'upload' ? t('passport_info_save') : t('passport_save_edit')}</Text>}
              </TouchableOpacity>
            </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      {nameSheet ? (
        <View style={styles.sheetAbs}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setNameSheet(false); }} />
          <KeyboardAvoidingView style={styles.sheetCenter} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
            <View style={styles.sheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.sheetTitle}>{t('name_sheet_title')}</Text>
              <Text style={styles.sheetHint}>{t('name_sheet_hint')}</Text>
              <Text style={styles.sheetLabel}>{t('f_firstName')}</Text>
              <TextInput style={styles.sheetInput} value={nFirst} onChangeText={setNFirst} placeholder="AIGERIM" placeholderTextColor="#9aa1ac" autoCapitalize="characters" autoCorrect={false} />
              <Text style={styles.sheetLabel}>{t('f_lastName')}</Text>
              <TextInput style={styles.sheetInput} value={nLast} onChangeText={setNLast} placeholder="NURLANOVA" placeholderTextColor="#9aa1ac" autoCapitalize="characters" autoCorrect={false} />
              <View style={styles.sheetRow}>
                <TouchableOpacity onPress={() => setNameSheet(false)} style={styles.sheetCancel}><Text style={styles.sheetCancelText}>{t('consent_cancel')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveLatinName} disabled={!nFirst.trim() || !nLast.trim() || savingName} style={[styles.sheetSave, (!nFirst.trim() || !nLast.trim() || savingName) && { opacity: 0.5 }]} activeOpacity={0.9}>
                  {savingName ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sheetSaveText}>{t('name_save')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}

      {(uploading || justUploaded) ? (
        <View style={styles.busyOverlay} pointerEvents={uploading ? 'auto' : 'none'}>
          <View style={styles.busyCard}>
            {uploading ? (
              <>
                <ActivityIndicator size="large" color="#c2a25a" />
                <Text style={styles.busyText}>{t('doc_uploading')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.busyCheck}>✓</Text>
                <Text style={styles.busyText}>{t('doc_uploaded')}</Text>
              </>
            )}
          </View>
        </View>
      ) : null}

      <ContractPreview
        visible={contractPreview}
        data={cvData}
        contract={contract}
        onClose={() => setContractPreview(false)}
      />

      <ProcessChatFab
        visible={PROCESS_CHAT_ENABLED && processChatUnlocked(processStatus, contract) && !chatOpen}
        onPress={() => setChatOpen(true)}
      />
      <ProcessChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        candidateId={userId}
        peerLabel={t('chat_title')}
      />

      <VerifyingOverlay status={verifyOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff',
  },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: '#1b2533', fontWeight: '700', marginTop: -4 },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2533' },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  content: { padding: 16 },
  focusHero: {
    backgroundColor: '#0e141c',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(194,162,90,0.4)',
  },
  focusHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  focusNum: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(194,162,90,0.18)', borderWidth: 1.5, borderColor: '#c2a25a',
    alignItems: 'center', justifyContent: 'center',
  },
  focusNumText: { color: '#e7dcc4', fontSize: 20, fontWeight: '900' },
  focusKicker: {
    color: '#c2a25a', fontSize: 11, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', marginBottom: 4,
  },
  focusTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 26 },
  focusHint: { color: '#a8b6c8', fontSize: 13.5, fontWeight: '500', lineHeight: 20, marginTop: 14 },
  focusMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  seg: {
    flexDirection: 'row', backgroundColor: '#f3efe4', borderRadius: 14, padding: 4, marginBottom: 16, gap: 4,
  },
  segBtn: { flex: 1, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  segBtnOn: { backgroundColor: '#c2a25a' },
  segText: { fontSize: 12.5, fontWeight: '800', color: '#6b6457', textAlign: 'center', lineHeight: 16 },
  segTextOn: { color: '#1b2533' },
  progressLabel: { fontSize: 12, fontWeight: '800', color: '#9a7b1f', flexShrink: 0, marginLeft: 6 },
  progressDone: { color: '#1f8a4c' },
  cardActive: { borderColor: '#c2a25a', backgroundColor: '#fffdf6' },
  cardWait: { borderColor: '#c5dbe2', backgroundColor: '#f4fafb' },
  turnBox: { borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 14 },
  turnYou: { backgroundColor: '#fff3cc', borderWidth: 1.5, borderColor: '#c2a25a' },
  turnAgency: { backgroundColor: '#e8f3f6' },
  turnKicker: { fontSize: 15, fontWeight: '900', letterSpacing: 0.2, marginBottom: 4 },
  turnKickerYou: { color: '#8a6a1f', marginBottom: 0 },
  turnKickerAgency: { color: '#1f7d96' },
  turnSub: { fontSize: 13.5, fontWeight: '600', color: '#3d4450', lineHeight: 19, marginTop: 6 },
  turnAlertRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  turnBang: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#c2a25a',
    alignItems: 'center', justifyContent: 'center',
  },
  turnBangText: { color: '#1b2533', fontSize: 16, fontWeight: '900', marginTop: -1 },
  nowChip: { backgroundColor: '#c2a25a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  nowChipText: { color: '#1b2533', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  waitLabel: { fontSize: 12, fontWeight: '800', color: '#1f7d96', flexShrink: 0, marginLeft: 6 },
  circleWait: { backgroundColor: '#2a9db8' },
  intro: { fontSize: 13, color: '#6b6457', lineHeight: 19, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12, marginBottom: 14 },
  // Süreç tamamlandı — premium tebrik kartı (açık kâğıt + altın; logo çerçevesiz net dursun)
  doneCard: {
    backgroundColor: '#fffdf7', borderRadius: 22, paddingVertical: 26, paddingHorizontal: 22, marginBottom: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(194,162,90,0.6)',
    shadowColor: '#1b2533', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  // İç ince altın çerçeve (süs)
  doneFrame: {
    position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 17,
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
  },
  doneLogo: { width: 180, height: 123, marginTop: 2, marginBottom: 6 },
  doneOrn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  doneRule: { flex: 1, height: 1, backgroundColor: 'rgba(194,162,90,0.5)' },
  doneStar: { color: '#c2a25a', fontSize: 12 },
  doneStarBottom: { color: 'rgba(194,162,90,0.8)', fontSize: 12, marginTop: 16 },
  doneTitle: { color: '#16202e', fontSize: 22, fontWeight: '900', marginBottom: 14, textAlign: 'center', letterSpacing: 0.3 },
  doneBody: { color: '#5b5444', fontSize: 13.5, lineHeight: 21, textAlign: 'center' },

  lockCard: { alignItems: 'center', backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec', borderRadius: 14, padding: 26, marginTop: 16 },
  lockIcon: { fontSize: 40, marginBottom: 10 },
  lockTitle: { fontSize: 17, fontWeight: '800', color: '#1b2533', marginBottom: 8, textAlign: 'center' },
  lockMsg: { fontSize: 13.5, color: '#737373', lineHeight: 20, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  rowIcon: { fontSize: 22, marginRight: 12 },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: 15, color: '#1b2533', fontWeight: '700' },
  rowDesc: { fontSize: 12, color: '#9aa1ac', marginTop: 2 },
  rowNote: { fontSize: 11.5, color: '#9a6b16', fontWeight: '700', marginTop: 4, backgroundColor: '#fcf2e2', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badge: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, marginTop: 7 },
  badgeMiss: { backgroundColor: '#fbeaea' },
  badgeOk: { backgroundColor: '#e6f4ec' },
  badgeWarn: { backgroundColor: '#fcf2e2' },
  badgeNeutral: { backgroundColor: '#eef0f2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextMiss: { color: '#a32d2d' },
  badgeTextOk: { color: '#1f8a4c' },
  badgeTextWarn: { color: '#9a6b16' },
  badgeTextNeutral: { color: '#737373' },
  linkRow: { flexDirection: 'row', gap: 16, marginTop: 9 },
  link: { fontSize: 13, color: '#c2a25a', fontWeight: '700' },
  linkDanger: { color: '#a32d2d' },

  addBtn: { backgroundColor: '#c2a25a', borderRadius: 9, paddingVertical: 9, paddingHorizontal: 16, marginLeft: 10, minWidth: 64, alignItems: 'center' },
  addBtnText: { color: '#1b2533', fontWeight: '800', fontSize: 14 },

  legend: { gap: 8, marginBottom: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#e6e8ec', padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 12.5, color: '#737373', fontWeight: '600', flexShrink: 1 },

  prowYou: { borderLeftColor: '#c2a25a' },
  prowOther: { borderLeftColor: '#2a9db8' },
  ownerChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  ownerYou: { backgroundColor: '#f6efdd' },
  ownerOther: { backgroundColor: '#e4f1f5' },
  ownerChipText: { fontSize: 11, fontWeight: '800' },
  ownerYouText: { color: '#9a7b1f' },
  ownerOtherText: { color: '#1f7d96' },

  deadlineBox: {
    backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#f0d79a', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14, marginTop: 14, alignItems: 'center',
  },
  deadlineWarn: { backgroundColor: '#fbeede', borderColor: '#e8b15a' },
  deadlineOver: { backgroundColor: '#fbeaea', borderColor: '#e8b5b0' },
  deadlineClock: {
    color: '#1b2533', fontSize: 16, fontWeight: '800', letterSpacing: 0.2,
    textAlign: 'center', lineHeight: 24, marginBottom: 8, paddingHorizontal: 4,
  },
  deadlineClockOver: { color: '#b5413a' },
  deadlineText: { fontSize: 13, color: '#6b5a2a', fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  deadlineExtraBtn: {
    marginTop: 12, backgroundColor: '#c2a25a', borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 18, minWidth: 180, alignItems: 'center',
  },
  deadlineExtraText: { color: '#1b2533', fontSize: 14.5, fontWeight: '800' },
  deadlineExtraDone: { marginTop: 10, color: '#9a7b1f', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  stepCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee8dc', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardDone: { backgroundColor: '#f7faf8', borderColor: '#dce8e0' },
  cardLocked: { backgroundColor: '#f7f7f8', borderColor: '#ececec' },
  circleYou: { backgroundColor: '#c2a25a' },
  circleAgency: { backgroundColor: '#c2a25a' },
  circleDone: { backgroundColor: '#1f8a4c' },
  circleLocked: { backgroundColor: '#cfd3da' },
  doneLabel: { fontSize: 12.5, fontWeight: '800', color: '#6f8a78', letterSpacing: 0.3 },
  ownerMuted: { backgroundColor: '#eceef1' },
  ownerMutedText: { color: '#9aa1ac' },
  subLabelMuted: { color: '#9aa1ac', fontWeight: '600' },
  linkMuted: { fontSize: 13, color: '#9aa1ac', fontWeight: '700' },
  linkMutedSm: { fontSize: 12.5, color: '#aeb4bd', fontWeight: '700' },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  stepTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1b2533', lineHeight: 19 },
  stepTitleMuted: { color: '#9aa1ac' },
  subRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#f0f1f3' },
  subMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subBullet: { fontSize: 15, color: '#c9ccd2', fontWeight: '800', width: 14, textAlign: 'center' },
  subBulletDone: { color: '#1f8a4c' },
  subLabel: { fontSize: 14.5, fontWeight: '700', color: '#1b2533', flexShrink: 1 },
  subLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginLeft: 22 },
  changeBtn: { backgroundColor: '#f6efdd', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  changeBtnText: { color: '#9a7b1f', fontWeight: '800', fontSize: 13 },
  removeText: { color: '#a32d2d' },
  linkAgency: { fontSize: 13, color: '#2a9db8', fontWeight: '800', marginLeft: 10 },
  viewLinks: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftBadge: { backgroundColor: '#fcf2e2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  draftText: { color: '#9a6b16', fontSize: 10.5, fontWeight: '800' },
  sendBtn: { backgroundColor: '#c2a25a', borderRadius: 11, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  sendBtnText: { color: '#1b2533', fontSize: 15, fontWeight: '800' },
  signBox: { marginTop: 10, marginLeft: 22, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12 },
  signHelp: { fontSize: 12.5, color: '#6b6457', lineHeight: 18, marginBottom: 10 },
  signRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Dikey adım çizelgesi (stepper)
  stRow: { flexDirection: 'row' },
  stRail: { width: 30, alignItems: 'center' },
  stDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1b2533', alignItems: 'center', justifyContent: 'center' },
  stDotText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stLine: { width: 2, flex: 1, backgroundColor: '#e0cfa0', marginTop: 4, minHeight: 18 },
  stBody: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  stTitle: { fontSize: 14.5, fontWeight: '900', color: '#1b2533' },
  stSub: { fontSize: 12.5, color: '#6b6457', fontWeight: '600', lineHeight: 18, marginTop: 2, marginBottom: 10 },
  stBtnDark: { backgroundColor: '#1b2533', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  stBtnDarkText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  stBtnGold: { backgroundColor: '#c2a25a', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  stBtnGoldText: { color: '#1b2533', fontWeight: '800', fontSize: 13.5 },
  stBtnDisabled: { opacity: 0.4 },
  payGate: { fontSize: 12.5, color: '#6b6457', fontWeight: '600', lineHeight: 18, marginTop: 8 },
  page3Note: { flexDirection: 'row', gap: 8, backgroundColor: '#eef4f6', borderWidth: 1, borderColor: '#cfe0e6', borderRadius: 9, padding: 10, marginTop: 10 },
  page3NoteText: { flex: 1, fontSize: 12, color: '#2a5560', fontWeight: '600', lineHeight: 17 },
  startDateBox: { marginTop: 12, marginLeft: 22, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12 },
  startDateLabel: { fontSize: 13, fontWeight: '800', color: '#1b2533', marginBottom: 10 },
  startDateRow: { flexDirection: 'row', gap: 8 },
  startDateCol: { flex: 1 },
  startDateNote: { fontSize: 11.5, color: '#7c6f4a', fontWeight: '600', lineHeight: 16, marginTop: 10 },
  addBtnSm: { backgroundColor: '#c2a25a', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 14, minWidth: 60, alignItems: 'center' },
  linkSm: { fontSize: 12.5, color: '#c2a25a', fontWeight: '700' },
  langNoteBox: { backgroundColor: '#fbeaea', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, marginLeft: 22, marginRight: 0, alignSelf: 'stretch' },
  langNoteText: { color: '#a32d2d', fontSize: 11.5, fontWeight: '700', lineHeight: 17, flexShrink: 1 },
  langNoteTextGap: { marginTop: 6 },
  waitBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e4f1f5', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  waitBannerText: { color: '#1f7d96', fontSize: 13, fontWeight: '700' },
  stepNo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  stepDone: { backgroundColor: '#1f8a4c' },
  stepActive: { backgroundColor: '#c2a25a' },
  stepLocked: { backgroundColor: '#c9ccd2' },
  lockedText: { color: '#9aa1ac' },
  waitText: { fontSize: 12.5, color: '#9a6b16', fontWeight: '700', marginTop: 4 },
  lockedIcon: { fontSize: 15, marginLeft: 10 },

  busyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 80, elevation: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  busyCard: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 26, paddingHorizontal: 34, alignItems: 'center', minWidth: 180 },
  busyText: { marginTop: 12, fontSize: 14.5, fontWeight: '700', color: '#1b2533' },
  busyCheck: { fontSize: 40, fontWeight: '900', color: '#1f8a4c' },

  sheetAbs: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetCenter: { flex: 1, justifyContent: 'center', padding: 24 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1b2533', marginBottom: 4 },
  sheetHint: { fontSize: 12.5, color: '#737373', marginBottom: 14, lineHeight: 18 },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: '#1b2533', marginBottom: 6, marginTop: 8 },
  sheetInput: { backgroundColor: '#f4f5f7', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1b2533' },
  sheetRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  sheetCancel: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#eef0f2', alignItems: 'center', justifyContent: 'center' },
  sheetCancelText: { color: '#737373', fontWeight: '800', fontSize: 14 },
  sheetSave: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#c2a25a', alignItems: 'center', justifyContent: 'center' },
  sheetSaveText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },
  sheetPhotoFull: { paddingVertical: 14, borderRadius: 12, backgroundColor: '#eef0f2', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 10 },
  sheetPhotoText: { color: '#1b2533', fontWeight: '800', fontSize: 14.5 },

  viewerWrap: { flex: 1, backgroundColor: '#111' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, backgroundColor: '#1b2533' },
  viewerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  viewerX: { color: '#fff', fontSize: 20, fontWeight: '700' },
  viewerBody: { flex: 1 },
  viewerScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerFooter: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#1b2533' },
  viewerDl: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  viewerDlText: { color: '#1b2533', fontWeight: '800', fontSize: 15.5 },

  pickupLock: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eadfc2', borderRadius: 16, padding: 16, marginTop: 14 },
  pickupLockTitle: { fontSize: 16, fontWeight: '800', color: '#1b2533' },
  pickupLockText: { fontSize: 13, color: '#9a6b16', marginTop: 8, lineHeight: 19, fontWeight: '600' },
  certCongrats: { fontSize: 13.5, color: '#6a5418', marginTop: 8, marginBottom: 6, lineHeight: 20, fontWeight: '700' },
});
