// screens/DocumentsScreen.js
// "Belgelerim": pasaport + adli sicil gibi hassas belgeler.
// Akış: "Ekle" -> (gerekli açık rıza yoksa) ConsentSheet -> rıza Supabase'e yazılır ->
// galeriden belge seç -> private 'documents' bucket'a güvenli yükleme -> "Yüklendi" durumu.
// Doğrulama (son kullanma < 1 yıl / okunaklılık) Adım 4'te Edge Function ile eklenecek.
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Modal, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, Keyboard, RefreshControl, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';
import { useLanguage } from '../i18n/LanguageContext';
// NOT: expo-document-picker / expo-file-system NATIVE'dir; statik import açılışta çöker
// (yeni build'de yokken). pickPdf içinde DİNAMİK import edilir.
import ConsentSheet from '../components/ConsentSheet';
import { getLatestConsent, saveConsent, canUploadDocs, hasSensitiveConsent } from '../lib/consent';
import { listDocuments, uploadDocument, verifyDocument, getSignedUrl, removeDocument, submitDocuments } from '../lib/documents';
import { getCandidateStatus, docsUnlocked, passportDeadline } from '../lib/candidate';
import { supabase } from '../lib/supabase';
import { latinFirst, latinLast } from '../lib/translit';
import { PIPELINE, kindState, activeStep } from '../lib/pipeline';
import { notifyDocument } from '../lib/push';
import { getContract } from '../lib/contracts';
import { getFlight } from '../lib/flights';
import { loadProfile, saveProfile } from '../lib/profile';
import ContractPreview from '../components/ContractPreview';
import FlightPreview from '../components/FlightPreview';
import VerifyingOverlay from '../components/VerifyingOverlay';

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

// Native (expo-camera) — yalnız açılınca yüklenir.
const PassportCamera = React.lazy(() => import('../components/PassportCamera'));

export default function DocumentsScreen({ userId, onBack, fontsReady }) {
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
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerPdf, setViewerPdf] = useState(false);
  const [unlocked, setUnlocked] = useState(null);     // null = henüz bilinmiyor, true/false
  const [deadline, setDeadline] = useState(null);     // pasaport 14 gün son tarihi
  const [contract, setContract] = useState(null);     // acentenin doldurduğu sözleşme verisi
  const [flight, setFlight] = useState(null);         // acentenin doldurduğu uçuş bilgisi
  const [flightPrev, setFlightPrev] = useState(false);
  const [nameSheet, setNameSheet] = useState(false);  // pasaport (Latin) isim düzeltme
  const [nFirst, setNFirst] = useState('');
  const [nLast, setNLast] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [cvData, setCvData] = useState(null);         // PDF üretmek için adayın CV'si
  const [contractPreview, setContractPreview] = useState(false);
  const [passportSheet, setPassportSheet] = useState(false);
  const [passportCamOpen, setPassportCamOpen] = useState(false);
  const [passportMode, setPassportMode] = useState('upload'); // 'upload' | 'edit'
  const [pNo, setPNo] = useState('');
  const [pPlace, setPPlace] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false); // kısa "✓ Güncellendi" göstergesi
  const [sending, setSending] = useState(false);           // "Belgeleri Gönder" sırasında
  const [refreshing, setRefreshing] = useState(false);     // aşağı çekerek yenile
  // Tüm adımlar dosya ile tamamlanır (imzalı sözleşme dâhil). isUploaded: satır var (taslak da
  // olabilir). isSubmitted: gönderilmiş (karşı tarafa geçmiş).
  const isUploaded = (k) => !!docs[k];
  const isSubmitted = (k) => !!docs[k]?.submitted_at;
  // Akış (kindState/activeStep) GÖNDERİLEN belgeyle ilerler; taslak adımı ilerletmez.
  const has = isSubmitted;

  // Rıza penceresi tam kapandığında galeriyi aç (modal çakışmasını önler). Tek sefer çalışır.
  const runPendingPick = () => {
    const k = pendingPick.current;
    if (!k) return;
    pendingPick.current = null;
    startUpload(k);
  };


  const refreshDocs = useCallback(async () => {
    const [rows, con, fl] = await Promise.all([listDocuments(userId), getContract(userId), getFlight(userId)]);
    const map = {};
    rows.forEach((r) => { map[r.kind] = r; });
    setDocs(map);
    setContract(con);
    setFlight(fl);
  }, [userId]);

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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refreshDocs]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const status = await getCandidateStatus(userId);
      if (!alive) return;
      const open = docsUnlocked(status);
      setUnlocked(open);
      setDeadline(passportDeadline(status));
      if (!open) return; // kilitliyse rıza/belge çekmeye gerek yok
      const [row, prof] = await Promise.all([getLatestConsent(userId), loadProfile(userId)]);
      if (!alive) return;
      setConsent(row);
      setCvData(prof || {});
      await refreshDocs();
    })();
    return () => { alive = false; };
  }, [userId, refreshDocs]);

  // Ret nedenini kullanıcıya gösterilecek metne çevir.
  const rejectReason = (note) => {
    switch (note) {
      case 'expired': return t('doc_st_expired');
      case 'expiring_soon': return t('doc_st_expiring');
      case 'not_passport': return t('doc_st_notpassport');
      default: return t('doc_st_unreadable'); // unreadable / bad_date / diğer
    }
  };

  // Galeriden seç + private bucket'a yükle, ardından (pasaportsa) doğrula.
  // Verilen görsel URI'sini yükle + (pasaportsa) doğrula. Hem galeri hem kamera bunu kullanır.
  const uploadFromUri = async (docKey, uri) => {
    try {
      setUploading(docKey);
      const base64 = await readableJpeg(uri);
      const row = await uploadDocument(userId, docKey, base64, 'image/jpeg');
      setDocs((m) => ({ ...m, [docKey]: row }));
      setUploading(null);
      setJustUploaded(true); setTimeout(() => setJustUploaded(false), 1500); // kısa "✓ Güncellendi"
      // Not: acenteye bildirim YÜKLEMEDE değil, "Belgeleri Gönder"de gider (submitStep).

      // Pasaportu otomatik doğrula. Yalnızca GEÇERLİ (veya insan incelemesi) ise kalsın.
      if (PASSPORT_VERIFY_ENABLED && docKey === 'passport') {
        setVerifying('passport');
        setVerifyOverlay('verifying');
        try {
          // AI anlık yoğunsa (503) GERÇEK karar alana kadar tekrar dener — animasyon sürer.
          let v = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            v = await verifyDocument('passport');
            // valid / invalid / düşük-güven incelemesi = gerçek sonuç -> dur. Sadece AI yoğunluğunda yeniden dene.
            if (!(v && v.status === 'review' && v.note === 'ai_unavailable')) break;
            if (attempt < 3) await new Promise((r) => setTimeout(r, 2500));
          }
          const realVerdict = v && (v.status === 'valid' || (v.status === 'review' && v.note !== 'ai_unavailable'));
          if (realVerdict) {
            setDocs((m) => ({ ...m, passport: { ...(m.passport || {}), status: v.status, note: v.note, expiry_date: v.expiryDate } }));
            setVerifyOverlay('success'); // ✓ başarı animasyonu
            setTimeout(() => setVerifyOverlay(null), 1800);
          } else if (v && v.status === 'invalid') {
            setVerifyOverlay(null);
            await removeDocument(userId, 'passport', row.storage_path).catch(() => {});
            setDocs((m) => { const n = { ...m }; delete n.passport; return n; });
            Alert.alert(t('doc_rejected_title'), rejectReason(v.note));
          } else {
            // 4 denemede de AI'ya ulaşılamadı (gerçek/uzun kesinti — billing açıkken pratikte olmaz):
            // adayı bloklama, belge yüklü kalır; acente panelinde görünür.
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
      }
    } catch (e) {
      Alert.alert(t('docs_title'), t('doc_upload_error'));
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

  // PDF (ya da dosyadan resim) seç + yükle. PDF olduğu gibi, resim JPEG'e çevrilerek.
  const pickPdf = async (docKey) => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const { File } = await import('expo-file-system');
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { await uploadFromUri(docKey, a.uri); return; } // dosyadaki resim -> JPEG yolu
      setUploading(docKey);
      const base64 = await new File(a.uri).base64();
      const row = await uploadDocument(userId, docKey, base64, 'application/pdf');
      setDocs((m) => ({ ...m, [docKey]: row }));
      setUploading(null);
      setJustUploaded(true); setTimeout(() => setJustUploaded(false), 1500);
    } catch (e) {
      Alert.alert(t('docs_title'), t('doc_upload_error'));
      setUploading(null);
    }
  };

  // Pasaport için çerçeveli KAMERA; diğer belgelerde Foto/PDF seçimi.
  const startUpload = (docKey) => {
    if (docKey === 'passport') { setPassportCamOpen(true); return; }
    Alert.alert(t('doc_choose_title'), undefined, [
      { text: t('doc_choose_photo'), onPress: () => pickImage(docKey) },
      { text: t('doc_choose_pdf'), onPress: () => pickPdf(docKey) },
      { text: t('consent_cancel'), style: 'cancel' },
    ]);
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
    const uploaded = !!docs[docKey];
    const consentOk = canUploadDocs(consent) && (!needsSensitive || hasSensitiveConsent(consent));
    if (uploaded && consentOk) { startUpload(docKey); return; }
    setPendingDoc(docKey);
    setRequireSensitive(needsSensitive);
    setSheetOpen(true);
  };

  // Pasaport: bilgi formu YOK — doğrudan çerçeveli kamera; AI no/isim/doğum bilgisini çıkarır.
  const startPassport = () => handleAdd('passport', false);

  // Yükledikten sonra düzenleme: no/doğum yeri değiştir ve/veya fotoğrafı değiştir.
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
      if (withPhoto) setPassportCamOpen(true); // çerçeveli kamera
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
      // Sözleşme: yüklü dosya değil; önizleme (WebView + PDF) aç.
      if (docKey === 'contract_unsigned' && contract && !docs[docKey]) {
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
  const submitStep = (s) => {
    const kinds = s.kinds.filter((k) => k !== 'contract_unsigned' && docs[k]);
    if (!kinds.length) return;
    Alert.alert(t('docs_send_confirm_title'), t('docs_send_confirm_msg'), [
      { text: t('docs_send_review'), style: 'cancel' },
      {
        text: t('docs_send'),
        onPress: async () => {
          setSending(true);
          try {
            const rows = await submitDocuments(userId, kinds);
            setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
            kinds.forEach((k) => notifyDocument(userId, k)); // acenteye "belge geldi"
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

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, fontsReady && styles.titleFont]}>{t('docs_title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
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
            <Text style={styles.intro}>{t('docs_intro')}</Text>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.ownerChip, styles.ownerYou]}><Text style={[styles.ownerChipText, styles.ownerYouText]}>{t('doc_owner_agency')}</Text></View>
                <Text style={styles.legendText}>{t('doc_legend_agency_does')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.ownerChip, styles.ownerOther]}><Text style={[styles.ownerChipText, styles.ownerOtherText]}>{t('doc_owner_candidate')}</Text></View>
                <Text style={styles.legendText}>{t('doc_legend_candidate_does')}</Text>
              </View>
            </View>

            {!has('passport') && deadline ? (
              <View style={[styles.deadlineBox, deadline.overdue ? styles.deadlineOver : deadline.days <= 3 ? styles.deadlineWarn : null]}>
                <Text style={styles.deadlineIcon}>⏳</Text>
                <Text style={styles.deadlineText}>{deadline.overdue ? t('passport_overdue') : t('passport_deadline', { n: deadline.days })}</Text>
              </View>
            ) : null}

            {PIPELINE.map((s) => {
              const mine = s.owner === 'candidate';
              const act = activeStep(has);
              const mode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
              // Acenteden gelen (agency-owned) tamamlanmış adım: gri "Tamamlandı" değil, belirgin "geldi".
              const agencyDone = mode === 'done' && !mine;
              const cardStyle = mode === 'active' ? [styles.stepCard, mine ? styles.prowYou : styles.prowOther]
                : agencyDone ? [styles.stepCard, styles.prowOther]
                  : mode === 'done' ? [styles.stepCard, styles.cardDone]
                    : [styles.stepCard, styles.cardLocked];
              const circleStyle = agencyDone ? styles.circleAgency : mode === 'done' ? styles.circleDone : mode === 'active' ? (mine ? styles.circleYou : styles.circleAgency) : styles.circleLocked;
              return (
                <View key={s.step} style={cardStyle}>
                  <View style={styles.stepHead}>
                    <View style={[styles.stepNo, circleStyle]}><Text style={styles.stepNoText}>{mode === 'done' && mine ? '✓' : s.step}</Text></View>
                    {agencyDone ? (
                      <View style={[styles.ownerChip, styles.ownerOther]}><Text style={[styles.ownerChipText, styles.ownerOtherText]}>{t('doc_from_agency')}</Text></View>
                    ) : mode === 'done' ? (
                      <Text style={styles.doneLabel}>✓ {t('doc_sent')}</Text>
                    ) : (
                      <View style={[styles.ownerChip, mode === 'locked' ? styles.ownerMuted : mine ? styles.ownerYou : styles.ownerOther]}>
                        <Text style={[styles.ownerChipText, mode === 'locked' ? styles.ownerMutedText : mine ? styles.ownerYouText : styles.ownerOtherText]}>{mine ? t('doc_owner_candidate') : t('doc_owner_agency')}</Text>
                      </View>
                    )}
                  </View>

                  {s.kinds.map((kind) => {
                    const kst = kindState(kind, has);
                    const sensitive = kind === 'criminal';
                    const langNote = kind === 'diploma' || kind === 'criminal';
                    const busy = uploading === kind || verifying === kind;
                    const draft = mine && isUploaded(kind) && !isSubmitted(kind); // yüklendi, gönderilmedi
                    const muteLabel = mode === 'locked' || (mode === 'done' && mine);
                    return (
                      <View key={kind} style={styles.subRow}>
                        <View style={styles.subMain}>
                          <Text style={[styles.subBullet, (kst === 'done' || draft) && styles.subBulletDone]}>{(kst === 'done' || draft) ? '✓' : '•'}</Text>
                          <Text style={[styles.subLabel, muteLabel && styles.subLabelMuted]}>{t(`doc_${kind}`)}</Text>
                          {draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                          <View style={{ flex: 1 }} />
                          {kst === 'done' && !mine && kind === 'flight_ticket' ? (
                            <View style={styles.viewLinks}>
                              <TouchableOpacity onPress={() => setFlightPrev(true)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={styles.linkAgency}>{t('flight_info_title')}</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleView(kind)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={styles.linkAgency}>{t('doc_view')}</Text></TouchableOpacity>
                            </View>
                          ) : kst === 'done' && !mine ? (
                            <TouchableOpacity onPress={() => handleView(kind)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={styles.linkAgency}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : kst === 'done' ? (
                            <TouchableOpacity onPress={() => handleView(kind)}><Text style={styles.linkMuted}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : draft ? (
                            <TouchableOpacity onPress={() => handleView(kind)}><Text style={styles.link}>{t('doc_view')}</Text></TouchableOpacity>
                          ) : kst === 'active' && mine ? (
                            <TouchableOpacity style={styles.addBtnSm} onPress={() => (kind === 'passport' ? startPassport() : handleAdd(kind, sensitive))} disabled={busy} activeOpacity={0.8}>
                              {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.addBtnText}>{t('doc_upload')}</Text>}
                            </TouchableOpacity>
                          ) : kst === 'locked' ? (
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
                                <TouchableOpacity style={styles.changeBtn} onPress={() => setPassportCamOpen(true)} activeOpacity={0.85}>
                                  <Text style={styles.changeBtnText}>📷 {t('passport_change_photo')}</Text>
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
                        {langNote && mode === 'active' && !draft ? (
                          <View style={styles.langNoteBox}><Text style={styles.langNoteText}>⚠ {t('doc_lang_note')}</Text></View>
                        ) : null}
                        {/* İmzalı sözleşme adımı: sözleşmeyi indir/imzala + (yakında) e-imza */}
                        {kind === 'contract_signed' && mine && kst === 'active' && !draft ? (
                          <View style={styles.signBox}>
                            <Text style={styles.signHelp}>{t('contract_sign_help')}</Text>
                            <View style={styles.signRow}>
                              <TouchableOpacity style={styles.signDl} onPress={confirmContractName} activeOpacity={0.85}>
                                <Text style={styles.signDlText}>📄 {t('contract_view_download')}</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {/* Belgeleri Gönder: sıra bende + adımın tüm belgeleri yüklü (taslak) */}
                  {mode === 'active' && mine && s.kinds.every((k) => isUploaded(k)) ? (
                    <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={() => submitStep(s)} disabled={sending} activeOpacity={0.9}>
                      {sending ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sendBtnText}>{t('docs_send')}  →</Text>}
                    </TouchableOpacity>
                  ) : null}

                  {mode === 'active' && !mine ? (
                    <View style={styles.waitBanner}><Text style={styles.waitBannerText}>⏳ {t('doc_agency_turn')}</Text></View>
                  ) : null}
                </View>
              );
            })}
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
            <TextInput style={styles.sheetInput} value={pPlace} onChangeText={setPPlace} placeholder="Almatı, Kazakistan" placeholderTextColor="#9aa1ac" />
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

      <FlightPreview
        visible={flightPrev}
        data={cvData}
        flight={flight}
        onClose={() => setFlightPrev(false)}
      />

      {passportCamOpen ? (
        <Suspense fallback={null}>
          <PassportCamera
            visible={passportCamOpen}
            onCapture={(uri) => { setPassportCamOpen(false); uploadFromUri('passport', uri); }}
            onClose={() => setPassportCamOpen(false)}
          />
        </Suspense>
      ) : null}

      <VerifyingOverlay status={verifyOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec',
  },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: '#1b2533', fontWeight: '700', marginTop: -4 },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2533' },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  content: { padding: 16 },
  intro: { fontSize: 13, color: '#6b6457', lineHeight: 19, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12, marginBottom: 14 },

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

  deadlineBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#f0d79a', borderRadius: 12, padding: 13, marginBottom: 14 },
  deadlineWarn: { backgroundColor: '#fbeede', borderColor: '#e8b15a' },
  deadlineOver: { backgroundColor: '#fbeaea', borderColor: '#e8b5b0' },
  deadlineIcon: { fontSize: 17 },
  deadlineText: { flex: 1, fontSize: 13, color: '#6b5a2a', fontWeight: '700', lineHeight: 18 },
  stepCard: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#e6e8ec' },
  cardDone: { backgroundColor: '#f5f6f8', borderColor: '#eceef1', borderLeftColor: '#cdd4cf' },
  cardLocked: { backgroundColor: '#f7f8f9', borderColor: '#eceef1', borderLeftColor: '#e1e4e9' },
  circleYou: { backgroundColor: '#c2a25a' },
  circleAgency: { backgroundColor: '#2a9db8' },
  circleDone: { backgroundColor: '#9bb8a6' },
  circleLocked: { backgroundColor: '#cfd3da' },
  doneLabel: { fontSize: 12.5, fontWeight: '800', color: '#6f8a78', letterSpacing: 0.3 },
  ownerMuted: { backgroundColor: '#eceef1' },
  ownerMutedText: { color: '#9aa1ac' },
  subLabelMuted: { color: '#9aa1ac', fontWeight: '600' },
  linkMuted: { fontSize: 13, color: '#9aa1ac', fontWeight: '700' },
  linkMutedSm: { fontSize: 12.5, color: '#aeb4bd', fontWeight: '700' },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
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
  signBox: { marginTop: 12, marginLeft: 22, backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12 },
  signHelp: { fontSize: 12.5, color: '#6b6457', lineHeight: 18, marginBottom: 10 },
  signRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signDl: { backgroundColor: '#1b2533', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  signDlText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  addBtnSm: { backgroundColor: '#c2a25a', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 14, minWidth: 60, alignItems: 'center' },
  linkSm: { fontSize: 12.5, color: '#c2a25a', fontWeight: '700' },
  langNoteBox: { backgroundColor: '#fbeaea', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, marginLeft: 22, alignSelf: 'flex-start' },
  langNoteText: { color: '#a32d2d', fontSize: 11.5, fontWeight: '700' },
  waitBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e4f1f5', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  waitBannerText: { color: '#1f7d96', fontSize: 13, fontWeight: '700' },
  stepNo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
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
});
