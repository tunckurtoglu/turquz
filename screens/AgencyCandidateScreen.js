// screens/AgencyCandidateScreen.js
// Acente — aday detayı. İki sekme:
//  CV: 3 fotoğraf + maskeli CV önizleme (+ Teklif Gönder).
//  Belgeler: adayın yüklediği belgeleri gör/indir + acenta belgesi (sözleşme/bilet) yükle + aşama.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, RefreshControl, Dimensions, Animated, Platform, Keyboard } from 'react-native';
import * as Print from 'expo-print';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLanguage } from '../i18n/LanguageContext';
import CVPreview from './CVPreview';
import ContractForm from '../components/ContractForm';
import ContractPreview from '../components/ContractPreview';
import StampSetupSheet from '../components/StampSetupSheet';
import EmployerPickerSheet from '../components/EmployerPickerSheet';
import { mergeEmployerIntoContract, getEmployer, employerStampInfo, employerReadyForContract, employerContractBlockReason } from '../lib/employers';
import PickupCard from '../components/PickupCard';
import InterviewModal from '../components/InterviewModal';
import TranscriptModal from '../components/TranscriptModal';
import { WebView } from 'react-native-webview';
import PhotoWatermark from '../components/PhotoWatermark';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import {
  requestEmploymentEnd, undoEmploymentEnd, contestEmploymentEnd, acceptEmploymentEnd, answerEmploymentTerm, getCandidateEmploymentEpisode, setWorkStartAt,
  confirmHire, deferWorkStart, agencyAnswerBoarding,
} from '../lib/employment';
import FlightTicketSheet from '../components/FlightTicketSheet';
import { getCandidateStatus, passportDeadline, formatDeadlineRemain } from '../lib/candidate';
import { offerCandidate, withdrawCandidate, getCandidateById, getCandidateContractFields } from '../lib/roles';
import { translateCvFields, applyCvTranslation, extractCvFields, hasCvFreeText } from '../lib/cvTranslate';
import { candidateCode, maskedName } from '../lib/candidateCode';
import { listDocuments, uploadDocument, getSignedUrl, removeAllDocuments, removeDocument, submitDocuments, requestReupload, retractAgencyDoc, replaceSubmittedDocument } from '../lib/documents';
import { getContract, saveContract, deleteContract } from '../lib/contracts';
import { deleteFlight, getFlight, saveArrival, msUntilArrival, msUntilYmdGate } from '../lib/flights';
import CountdownBanner from '../components/CountdownBanner';
import { supabase } from '../lib/supabase';
import { notifyDocument, notifyDocumentSubmit, notifyOffer } from '../lib/push';
import { PIPELINE, kindState, activeStep, stepActor, DOCS_EXTRA_DAYS } from '../lib/pipeline';
import { getInterview, cancelInterview, markInterviewDone, slotMs, slotDateKey, slotTime, weekdayOf, formatCountdown } from '../lib/interviews';
import { callWindow, JOIN_PERIOD_MIN, getCallWindowOpts } from '../lib/livekitCall';
import { getIntroVideoUrl } from '../lib/introVideo';
import { withLatinName } from '../lib/translit';
import { buildContractHtml } from '../cv/buildContractHtml';
import { stampMakeTransparentSafe } from '../lib/stampProcess';
import { logContractSignature, sha256Hex, buildAuditLine } from '../lib/esign';
import CvOverrideSheet from '../components/CvOverrideSheet';
import ProcessChatSheet from '../components/ProcessChatSheet';
import AgencyNoticeSheet from '../components/AgencyNoticeSheet';
import ProcessChatFab from '../components/ProcessChatFab';
import { loadOverride, saveOverride, clearOverride, normalizePoolCvData, applyCvOverrides } from '../lib/cvOverride';
import { PROCESS_CHAT_ENABLED, processChatUnlocked } from '../lib/features';
import CandidateRateSheet from '../components/CandidateRateSheet';
import RatingBadge from '../components/RatingBadge';
import RatingBreakdown from '../components/RatingBreakdown';
import { canRateCandidate, getMyRating, listRatingStats } from '../lib/ratings';
import { isFavorited, toggleFavorite } from '../lib/favorites';

// Tanzim/teklif tarihi: bugünün "gg/aa/yyyy" hali
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

async function readableJpeg(uri) {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return out.base64;
}

export default function AgencyCandidateScreen({ candidate, agencyUserId, accepted, offered: offeredProp, hired: hiredProp, inTransit: inTransitProp, openIvJoin, openChat, openWorkStart, openHireConfirm, openRate, onBack, onAccepted, fontsReady }) {
  const { t, dir, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const docsScrollRef = useRef(null);
  const [kbH, setKbH] = useState(0);
  const [busy, setBusy] = useState(false);
  const [isAccepted, setIsAccepted] = useState(!!accepted);
  const [offered, setOffered] = useState(!!offeredProp); // teklif gitti, aday cevabı bekleniyor
  const [isHired, setIsHired] = useState(!!hiredProp);
  const [isTransit, setIsTransit] = useState(!!inTransitProp || (!hiredProp && !!openHireConfirm));
  const [iv, setIv] = useState(null); // mülakat satırı (proposed/scheduled)
  const [nowTick, setNowTick] = useState(Date.now());
  const [hasInterview, setHasInterview] = useState(false); // bu adayla mülakat YAPILDI mı (transcript butonu için)
  const offerBlink = useRef(new Animated.Value(1)).current;
  const [viewer, setViewer] = useState(null);
  const [viewerPdf, setViewerPdf] = useState(false);
  const [viewerKind, setViewerKind] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false); // belge açılırken yüklenme göstergesi
  const [downloading, setDownloading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null); // foto galeri (kaydırmalı) açık indeks
  const [introVideoUrl, setIntroVideoUrl] = useState(''); // adayın tanıtım videosu (imzalı url)
  const [videoPlay, setVideoPlay] = useState(false);      // tam ekran video oynatıcı
  const [tab, setTab] = useState('cv');
  const [docs, setDocs] = useState({});
  const [uploading, setUploading] = useState(null);
  const [contract, setContract] = useState(null); // sözleşme verisi (acentenin doldurduğu)
  const [formVisible, setFormVisible] = useState(false);
  const [employerPickerVisible, setEmployerPickerVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [stampInfo, setStampInfo] = useState(null);
  const [stampEmployer, setStampEmployer] = useState(null);
  const [sending, setSending] = useState(false);  // "Belgeleri Gönder" sırasında
  const [refreshing, setRefreshing] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [cvOverrides, setCvOverrides] = useState({});
  const [cvEditorOpen, setCvEditorOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(!!openChat);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const chatReturnHome = useRef(!!openChat);
  const [rateOpen, setRateOpen] = useState(false);
  const [episode, setEpisode] = useState(null);
  const [workStartAt, setWorkStartAtState] = useState(null);
  const [plannedEndOn, setPlannedEndOn] = useState(null);
  const [flightDepartOn, setFlightDepartOn] = useState(null);
  const [arriveAt, setArriveAt] = useState('');
  const [boardingStatus, setBoardingStatus] = useState(null);
  const [flightSheet, setFlightSheet] = useState(null); // 'upload' | 'edit' | null
  const [flightSheetBusy, setFlightSheetBusy] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [hasMyRating, setHasMyRating] = useState(false);
  const [ratingSummary, setRatingSummary] = useState(null); // { avg, count }
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [docsReady, setDocsReady] = useState(false);
  const [openStep, setOpenStep] = useState(null);
  const turnBlink = useRef(new Animated.Value(1)).current;
  const overrideSaveTimer = useRef(null);
  // Tüm adımlar (sözleşme dâhil) DOSYA ile tamamlanır. isUploaded: satır var (taslak da olabilir).
  // isSubmitted: gönderilmiş (karşı tarafa geçmiş). İmzalı sözleşme de bir belgedir artık.
  const isUploaded = (k) => !!docs[k];
  const isSubmitted = (k) => !!docs[k]?.submitted_at;
  // Akış GÖNDERİLEN belgeyle ilerler; karşı taraf taslağı görmez.
  const has = isSubmitted;
  const turnAct = activeStep(has);
  const turnDef = PIPELINE.find((s) => s.step === turnAct);
  const turnMine = turnAct > 5
    ? !has('success_certificate')
    : !!(turnDef && stepActor(turnDef, has) === 'agency');
  const turnStepKey = turnDef?.titleKey
    || (turnAct > 5 && !has('success_certificate') ? 'pipe_step_6' : null);
  const remainMs = deadline?.end ? deadline.end.getTime() - nowTick : 0;
  const workStartYmd = workStartAt ? String(workStartAt).slice(0, 10) : null;
  const arriveCountdownLeft = arriveAt ? msUntilArrival(arriveAt, nowTick) : 0;
  const workStartCountdownLeft = isTransit ? msUntilYmdGate(workStartYmd, nowTick) : 0;
  const workStartDue = isTransit && workStartYmd && workStartCountdownLeft === 0;
  const chatOn = processChatUnlocked(
    isTransit ? 'in_transit' : isHired ? 'hired' : isAccepted ? 'accepted' : null,
    contract,
  );
  // Kabul edilmeden Belgeler sekmesi yok; her zaman CV göster.
  const activeTab = isAccepted ? tab : 'cv';

  // Mülakat durumu (seçilen slot / planlandı) — ana şeritte gösterilir.
  const [callOpts, setCallOpts] = useState({ minutes: JOIN_PERIOD_MIN, extraSecs: 0 });
  const refreshIv = useCallback(async () => {
    let row = await getInterview(candidate?.user_id);
    let opts = { minutes: JOIN_PERIOD_MIN, extraSecs: 0 };
    if (row?.status === 'scheduled' && row.selectedSlot) {
      opts = await getCallWindowOpts(row);
      setCallOpts(opts);
    } else setCallOpts(opts);
    // Görüşme penceresi bittiyse aktif scheduled kalmasın → "Mülakat planla" görünsün.
    if (row?.status === 'scheduled' && row.selectedSlot && callWindow(row.selectedSlot, opts).ended) {
      try { await markInterviewDone(candidate.user_id); } catch (e) { /* yoksay */ }
      row = await getInterview(candidate?.user_id);
    }
    setIv(row);
    const chosen = row?.selectedSlot;
    const ms = chosen ? slotMs(chosen) : NaN;
    const periodMs = (opts.minutes || JOIN_PERIOD_MIN) * 60 * 1000 + (opts.extraSecs || 0) * 1000;
    setHasInterview(!!(chosen && !isNaN(ms) && ms + periodMs < Date.now()) || row?.status === 'done');
  }, [candidate?.user_id]);

  useEffect(() => { refreshIv(); }, [refreshIv]);

  useEffect(() => {
    if (!candidate?.user_id) return undefined;
    const ch = supabase
      .channel(`iv-agency-cand-${candidate.user_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${candidate.user_id}` }, () => refreshIv())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [candidate?.user_id, refreshIv]);

  // Geri sayım (mülakat + belge süresi) için saniyelik tick.
  useEffect(() => {
    const pkgOpen = docsReady && deadline?.end && !['passport', 'diploma', 'criminal', 'health_report'].every(has);
    const showDlBanner = !!(deadline?.end && isAccepted && !isHired && !isTransit);
    const needTick = (iv?.status === 'scheduled' && !!iv?.selectedSlot)
      || (activeTab === 'docs' && pkgOpen)
      || showDlBanner
      || (isTransit && (arriveCountdownLeft > 0 || workStartCountdownLeft > 0))
      || !!arriveAt;
    if (!needTick) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iv?.status, iv?.selectedSlot, activeTab, docsReady, deadline?.end, docs, isAccepted, isHired, isTransit, arriveAt, workStartAt, arriveCountdownLeft, workStartCountdownLeft]);

  // Listeden "Katıl" ile gelindiyse mülakat modalını (ve uygunsa görüşmeyi) aç.
  useEffect(() => {
    if (openIvJoin) setInterviewOpen(true);
  }, [openIvJoin]);

  // Bildirimden / mesaj listesinden gelince süreç sohbetini aç.
  useEffect(() => {
    if (openChat) {
      chatReturnHome.current = true;
      setChatOpen(true);
    }
  }, [openChat, candidate?.user_id]);

  useEffect(() => {
    if (openWorkStart) setFlightSheet('edit');
  }, [openWorkStart, candidate?.user_id]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKbH(Math.max(0, e?.endCoordinates?.height || 0));
    const onHide = () => setKbH(0);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const scrollPickupIntoView = useCallback(() => {
    const delay = Platform.OS === 'ios' ? 80 : 160;
    setTimeout(() => {
      docsScrollRef.current?.scrollToEnd?.({ animated: true });
    }, delay);
  }, []);

  const refreshEpisode = useCallback(async () => {
    if (!candidate?.user_id) {
      setEpisode(null);
      setWorkStartAtState(null);
      setPlannedEndOn(null);
      setFlightDepartOn(null);
      setArriveAt('');
      setBoardingStatus(null);
      return;
    }
    const [ep, st, fl] = await Promise.all([
      getCandidateEmploymentEpisode(candidate.user_id),
      getCandidateStatus(candidate.user_id),
      getFlight(candidate.user_id),
    ]);
    setEpisode(ep);
    setWorkStartAtState(st?.work_start_at || ep?.work_start_at || null);
    setPlannedEndOn(
      st?.planned_end_on
      || (ep?.planned_end_at ? String(ep.planned_end_at).slice(0, 10) : null)
      || null,
    );
    setFlightDepartOn(st?.flight_depart_on || null);
    setArriveAt(fl?.arriveAt || '');
    setBoardingStatus(st?.boarding_status || null);
    setDeadline(passportDeadline(st));
    if (st?.status === 'in_transit') {
      setIsTransit(true);
      setIsHired(false);
      setIsAccepted(true);
      setOffered(false);
    } else if (st?.status === 'hired') {
      setIsTransit(false);
      setIsHired(true);
      setIsAccepted(true);
    } else if (st?.status === 'accepted') {
      setIsTransit(false);
      setIsHired(false);
      setIsAccepted(true);
      setOffered(false);
    }
  }, [candidate?.user_id]);
  useEffect(() => { refreshEpisode(); }, [refreshEpisode]);

  // Teklif beklerken kutu yanıp sönsün (cevap gelene kadar).
  useEffect(() => {
    if (!offered) { offerBlink.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(offerBlink, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      Animated.timing(offerBlink, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [offered, offerBlink]);

  useEffect(() => {
    if (!(activeTab === 'docs' && turnMine)) {
      turnBlink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(turnBlink, { toValue: 0.38, duration: 620, useNativeDriver: true }),
      Animated.timing(turnBlink, { toValue: 1, duration: 620, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [activeTab, turnMine, turnBlink]);

  // Aday profili: gelen veriyle başlar, ekran açılınca GÜNCEL hali çekilir
  // (ör. aday sonradan pasaport no girdiyse sözleşmeye otomatik düşsün).
  const [data, setData] = useState(() => normalizePoolCvData(candidate));
  useEffect(() => {
    let alive = true;
    (async () => {
      // 1) güncel havuz verisi (PII gizli) + 2) süreçteyse sözleşme için özel alanlar (passportNo, aile, adres)
      const [fresh, priv] = await Promise.all([
        getCandidateById(candidate?.user_id),
        getCandidateContractFields(candidate?.user_id),
      ]);
      if (!alive) return;
      const base = normalizePoolCvData(fresh || candidate);
      const merged = priv ? { ...base, ...priv } : base; // özel alanlar havuz verisinin üzerine
      // Ünvan: priv/data boşsa kolondaki title'ı koru
      if (!String(merged.title || '').trim()) {
        merged.title = fresh?.title || candidate?.title || '';
      }
      setData(merged);
    })();
    return () => { alive = false; };
  }, [candidate?.user_id]);
  const code = candidateCode(data.nationality, candidate?.reg_no);

  // Adayın serbest CV metinlerini (özet, ünvan, iş deneyimi, eğitim) ACENTENİN diline
  // yapay zekâ ile çevir (translate-cv; DB'de önbellekli). Orijinal/çeviri arası geçilebilir.
  const [cvTr, setCvTr] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => {
    let alive = true;
    setShowOriginal(false);
    const hasFree = hasCvFreeText(extractCvFields(data));
    if (!candidate?.user_id || !hasFree) { setCvTr(null); return undefined; }
    translateCvFields(candidate.user_id, lang, data).then((tr) => { if (alive) setCvTr(tr); });
    return () => { alive = false; };
  }, [candidate?.user_id, lang, data]);

  // Gösterilecek CV: çeviri + acente overlay (yalnız bu acente görür).
  const cvTranslated = (!showOriginal && cvTr) ? applyCvTranslation(data, cvTr) : data;
  const cvData = applyCvOverrides(cvTranslated, cvOverrides);
  const hasCvOverrides = Object.keys(cvOverrides).length > 0;
  // WebView önizleme anahtarı: override (özellikle title) değişince kesin remount.
  const cvPreviewKey = `${lang}|${cvData.title || ''}|${JSON.stringify(cvOverrides)}`;

  useEffect(() => {
    let alive = true;
    setCvOverrides({});
    if (!agencyUserId || !candidate?.user_id) return undefined;
    loadOverride(agencyUserId, candidate.user_id).then((o) => { if (alive) setCvOverrides(o); });
    return () => { alive = false; };
  }, [agencyUserId, candidate?.user_id]);

  // Puan: havuz özeti + bu acente puanlayabilir mi
  useEffect(() => {
    let alive = true;
    const uid = candidate?.user_id;
    if (!uid) return undefined;
    setCanRate(false);
    setHasMyRating(false);
    setRatingSummary(null);
    Promise.all([
      listRatingStats([uid]),
      canRateCandidate(uid),
      agencyUserId ? getMyRating(agencyUserId, uid) : Promise.resolve(null),
    ]).then(([stats, can, mine]) => {
      if (!alive) return;
      setRatingSummary(stats[uid] || null);
      setCanRate(!!can);
      setHasMyRating(!!mine);
      if (can && openRate && !mine) setRateOpen(true);
    });
    return () => { alive = false; };
  }, [candidate?.user_id, agencyUserId, isHired, openRate]);

  // Favori: bu aday yıldızlı mı
  useEffect(() => {
    let alive = true;
    const uid = candidate?.user_id;
    if (!agencyUserId || !uid) { setIsFav(false); return undefined; }
    setIsFav(false);
    isFavorited(agencyUserId, uid).then((on) => {
      if (alive) setIsFav(!!on);
    });
    return () => { alive = false; };
  }, [agencyUserId, candidate?.user_id]);

  const onToggleFav = async () => {
    if (!agencyUserId || !candidate?.user_id || favBusy) return;
    setFavBusy(true);
    try {
      const nowOn = await toggleFavorite(agencyUserId, candidate.user_id);
      setIsFav(nowOn);
    } catch (e) {
      Alert.alert(t('fav_btn'), e?.message || t('doc_upload_error'));
    } finally {
      setFavBusy(false);
    }
  };

  const handleOverrideChange = (next) => {
    setCvOverrides(next);
    clearTimeout(overrideSaveTimer.current);
    overrideSaveTimer.current = setTimeout(() => {
      saveOverride(agencyUserId, candidate.user_id, next).catch((e) => console.warn('CV override kaydedilemedi:', e?.message));
    }, 800);
  };

  const handleClearOverride = () => {
    Alert.alert(t('cv_edit_reset'), t('cv_edit_reset_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('cv_edit_reset'),
        style: 'destructive',
        onPress: async () => {
          setCvOverrides({});
          try { await clearOverride(agencyUserId, candidate.user_id); }
          catch (e) { Alert.alert(t('cv_edit_title'), e?.message || 'error'); }
        },
      },
    ]);
  };

  const photos = [
    { uri: data.photoClose, cap: t('photo_cap_close') },
    { uri: data.photoFull, cap: t('photo_cap_full') },
    { uri: data.photo, cap: t('photo_cap_id') },
  ].filter((p) => p.uri);

  // Tanıtım videosu: storage yolundan imzalı oynatma URL'i çöz (galeride göster).
  useEffect(() => {
    let alive = true;
    const path = data?.introVideo;
    if (!path) { setIntroVideoUrl(''); return undefined; }
    getIntroVideoUrl(path).then((u) => { if (alive) setIntroVideoUrl(u || ''); });
    return () => { alive = false; };
  }, [data?.introVideo]);

  const refreshDocs = useCallback(async () => {
    const uid = candidate?.user_id;
    if (!uid) return;
    const [rows, con, fresh] = await Promise.all([
      listDocuments(uid),
      getContract(uid),
      getCandidateById(uid),
    ]);
    const map = {};
    rows.forEach((r) => { map[r.kind] = r; });
    setDocs(map);
    setContract(con);
    setDocsReady(true);
    const pref = fresh?.data?.preferredStartDate;
    if (pref) {
      setData((prev) => (prev?.preferredStartDate === pref ? prev : { ...prev, preferredStartDate: pref }));
    }
    await refreshEpisode();
  }, [candidate?.user_id, refreshEpisode]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  // Sözleşmedeki işletmenin kaşesini yükle
  useEffect(() => {
    let alive = true;
    (async () => {
      const eid = contract?.employerId;
      if (!eid || !agencyUserId) { if (alive) { setStampInfo(null); setStampEmployer(null); } return; }
      const emp = await getEmployer(agencyUserId, eid);
      if (!alive) return;
      setStampEmployer(emp);
      setStampInfo(employerStampInfo(emp));
    })();
    return () => { alive = false; };
  }, [contract?.employerId, agencyUserId]);

  // Elle yenile (aşağı çek).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshDocs(); } finally { setRefreshing(false); }
  }, [refreshDocs]);

  // ANLIK yansıma: adayın belge/sözleşme/uçuş değişikliklerini realtime dinle.
  // (Supabase'de realtime açık olmalı — bkz. 0020_realtime.sql. Değilse aşağı çekerek yenile.)
  useEffect(() => {
    const uid = candidate?.user_id;
    if (!uid) return undefined;
    const ch = supabase
      .channel(`cand-docs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [candidate?.user_id, refreshDocs]);

  // "Teklif Gönder" -> adaya TEKLİF gider. Belgeler/sözleşme AÇILMAZ; aday kabul edene kadar bekler.
  const acceptOffer = () => {
    Alert.alert(t('agency_offer'), `${t('agency_offer')}?`, [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('agency_offer'),
        onPress: async () => {
          setBusy(true);
          try {
            await offerCandidate(candidate.user_id);
            notifyOffer(candidate.user_id, 'offer');
            setOffered(true);
            onAccepted?.(); // listeleri tazele (durum 'offered' oldu)
          } catch (e) {
            Alert.alert(t('agency_offer'), e?.message || 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openEmployerPicker = () => setEmployerPickerVisible(true);

  const onEmployerPicked = async (employer) => {
    const reason = employerContractBlockReason(employer);
    if (reason || !employerReadyForContract(employer)) {
      const msg = reason === 'tax' ? t('employer_need_tax')
        : reason === 'stamp' ? t('employer_need_stamp')
          : t('employer_need_both');
      Alert.alert(t('employer_pick_title'), msg);
      return;
    }
    const merged = mergeEmployerIntoContract(contract, employer);
    const full = { ...merged, issueDate: merged.issueDate || todayStr() };
    try {
      await saveContract(candidate.user_id, full, agencyUserId);
      setContract(full);
      setStampEmployer(employer);
      setStampInfo(employerStampInfo(employer));
      setEmployerPickerVisible(false);
      // Eski taslak PDF yeni işletmeye ait olmasın
      const draft = docs.contract_unsigned;
      if (draft?.storage_path && !draft.submitted_at) {
        try {
          await removeDocument(candidate.user_id, 'contract_unsigned', draft.storage_path);
          setDocs((m) => {
            const n = { ...m };
            delete n.contract_unsigned;
            return n;
          });
        } catch { /* yok say */ }
      }
      setFormVisible(true);
    } catch (e) {
      Alert.alert(t('employer_pick_title'), e?.message || 'error');
    }
  };

  // Form: sözleşme BİLGİLERİNİ kaydet (KABUL ETMEZ). İmza+gönderim Belgeler adımında.
  const saveContractData = async (fields) => {
    try {
      const issueDate = contract?.issueDate || todayStr();
      const full = { ...fields, issueDate };
      await saveContract(candidate.user_id, full, agencyUserId);
      setContract(full);
    } catch (e) {
      Alert.alert(t('contract_form_title'), e?.message || 'error');
    }
  };

  // Sözleşmeyi GÖNDER: işletme kaşesini bas → PDF yükle → adaya ilet.
  const sendStampedContract = (stamp) => new Promise((resolve, reject) => {
    Alert.alert(
      t('contract_send'),
      t('contract_send_confirm'),
      [
        { text: t('docs_send_review'), style: 'cancel', onPress: () => reject(new Error('cancelled')) },
        {
          text: t('docs_send'),
          onPress: async () => {
            setBusy(true);
            try {
              await prepareStampedContract(stamp);
              const rows = await submitDocuments(candidate.user_id, ['contract_unsigned']);
              setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
              setIsAccepted(true);
              notifyDocument(candidate.user_id, 'contract_unsigned');
              onAccepted?.();
              resolve();
            } catch (e) {
              Alert.alert(t('contract_form_title'), e?.message || 'error');
              reject(e);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  });

  // Sözleşme önizlemesini aç (WebView + PDF paylaş).
  const viewContractPdf = () => setPreviewVisible(true);

  // Kayıtlı işletme kaşesi ile doldurulmuş PDF üret → contract_unsigned taslak.
  const prepareStampedContract = async (stamp) => {
    const eid = contract?.employerId;
    if (!eid) throw new Error(t('stamp_need_employer'));
    const emp = stampEmployer?.id === eid
      ? stampEmployer
      : await getEmployer(agencyUserId, eid);
    if (!employerReadyForContract(emp)) {
      const reason = employerContractBlockReason(emp);
      throw new Error(
        reason === 'tax' ? t('employer_need_tax')
          : reason === 'stamp' ? t('employer_need_stamp')
            : t('employer_need_both'),
      );
    }
    const sig = stamp || employerStampInfo(emp);
    if (!sig?.image) throw new Error(t('stamp_need_setup'));
    if (!contract?.title?.trim() || !contract?.position?.trim()) {
      throw new Error(t('contract_required'));
    }
    const cleanedImage = await stampMakeTransparentSafe(sig.image);
    const latin = withLatinName(data || {});
    const baseHtml = buildContractHtml(latin, contract || {});
    const docHash = (await sha256Hex(baseHtml)).slice(0, 16);
    const log = await logContractSignature({
      candidateUserId: candidate.user_id,
      signerName: sig.name,
      signerTitle: sig.subtitle,
      docNo: code,
      docHash,
      platform: Platform.OS,
    });
    const auditLine = buildAuditLine(log);
    const sigInfo = { image: cleanedImage, name: sig.name, subtitle: sig.subtitle, auditLine };
    const stampedHtml = buildContractHtml(latin, contract || {}, { signature: sigInfo });
    const { base64 } = await Print.printToFileAsync({ html: stampedHtml, base64: true });
    const row = await uploadDocument(candidate.user_id, 'contract_unsigned', base64, 'application/pdf');
    setDocs((m) => ({ ...m, contract_unsigned: row }));
    setStampInfo(sigInfo);
    setStampEmployer(emp);
    return row;
  };

  const openStampForContract = async () => {
    const eid = contract?.employerId;
    if (!eid) {
      Alert.alert(t('stamp_title'), t('stamp_need_employer'));
      setEmployerPickerVisible(true);
      return;
    }
    const emp = await getEmployer(agencyUserId, eid);
    setStampEmployer(emp);
    setStampOpen(true);
  };

  const withdrawOffer = () => {
    if (isHired) {
      if (episode?.outcome === 'early_exit_pending' || episode?.outcome === 'disputed' || episode?.outcome === 'completion_pending') {
        Alert.alert(
          t('staff_end'),
          episode.outcome === 'disputed'
            ? t('emp_disputed')
            : episode.outcome === 'completion_pending'
              ? t('emp_term_body')
              : t('emp_pending_agency'),
        );
        return;
      }
      Alert.alert(t('staff_end'), t('staff_end_confirm'), [
        { text: t('consent_cancel'), style: 'cancel' },
        {
          text: t('staff_end'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await requestEmploymentEnd(candidate.user_id);
              await refreshEpisode();
            } catch (e) {
              Alert.alert(t('staff_end'), e?.message || 'error');
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
      return;
    }
    Alert.alert(
      isAccepted ? t('process_end') : t('agency_withdraw'),
      isAccepted ? t('process_end_confirm') : t('agency_withdraw_confirm'),
      [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: isAccepted ? t('process_end') : t('agency_withdraw'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeAllDocuments(candidate.user_id);
            await deleteContract(candidate.user_id);
            await deleteFlight(candidate.user_id);
            try { await cancelInterview(candidate.user_id); } catch (_) { /* yoksa sorun değil */ }
            await withdrawCandidate(candidate.user_id);
            setDocs({});
            setContract(null);
            setIsAccepted(false);
            setOffered(false);
            onAccepted?.(); // havuz/durumları tazele
          } catch (e) {
            Alert.alert(isAccepted ? t('process_end') : t('agency_withdraw'), e?.message || 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const viewDoc = async (kind) => {
    const row = docs[kind];
    if (!row) return;
    try {
      setViewerLoading(true);
      const url = await getSignedUrl(row.storage_path, 120);
      setViewerPdf((row.mime_type || '').includes('pdf') || (row.storage_path || '').toLowerCase().endsWith('.pdf'));
      setViewerKind(kind);
      setViewer(url);
    } catch (e) {
      setViewerLoading(false);
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    }
  };
  const closeViewer = () => { setViewer(null); setViewerKind(null); setViewerLoading(false); };

  // Görüntülenen (veya listedeki) belgeyi indir / paylaş.
  const downloadDoc = async (kind) => {
    if (downloading) return;
    const row = kind ? docs[kind] : null;
    let url = viewer;
    let isPdf = viewerPdf;
    if (kind && row?.storage_path) {
      try {
        url = await getSignedUrl(row.storage_path, 120);
        isPdf = (row.mime_type || '').includes('pdf') || (row.storage_path || '').toLowerCase().endsWith('.pdf');
      } catch (e) {
        Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
        return;
      }
    }
    if (!url) return;
    setDownloading(true);
    try {
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
        return;
      }
      const ext = isPdf ? 'pdf' : 'jpg';
      const FS = await import('expo-file-system');
      const label = kind ? String(t(`doc_${kind}`) || kind).replace(/[^\w\-]+/g, '_') : 'belge';
      const dest = new FS.File(FS.Paths.cache, `${label}_${Date.now()}.${ext}`);
      try { dest.delete(); } catch (_) { /* yoksa sorun değil */ }
      const out = await FS.File.downloadFileAsync(url, dest);
      const localUri = (out && out.uri) || dest.uri;
      await Sharing.shareAsync(localUri, isPdf
        ? { mimeType: 'application/pdf', dialogTitle: t('doc_download'), UTI: 'com.adobe.pdf' }
        : { mimeType: 'image/jpeg', dialogTitle: t('doc_download') });
    } catch (e) {
      console.warn('indir hatası:', e?.message);
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    } finally {
      setDownloading(false);
    }
  };

  const uploadAgencyDoc = async (kind) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
      if (res.canceled || !res.assets || !res.assets.length) return;
      setUploading(kind);
      const base64 = await readableJpeg(res.assets[0].uri);
      const row = await uploadDocument(candidate.user_id, kind, base64, 'image/jpeg');
      setDocs((m) => ({ ...m, [kind]: row }));
      // Not: adaya bildirim YÜKLEMEDE değil, "Belgeleri Gönder"de gider (submitStep).
    } catch (e) {
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    } finally {
      setUploading(null);
    }
  };

  // Taslak acente belgesini kaldır (gönderilmeden önce).
  const removeAgencyDoc = async (kind) => {
    const row = docs[kind];
    if (!row) return;
    setUploading(kind);
    try {
      await removeDocument(candidate.user_id, kind, row.storage_path);
      setDocs((m) => { const n = { ...m }; delete n[kind]; return n; });
    } catch (e) {
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    } finally {
      setUploading(null);
    }
  };

  // Uçak bileti — PDF + zorunlu işe başlama tarihi (aynı pencere).
  const uploadFlightTicketPdf = () => setFlightSheet('upload');

  const onFlightSheetConfirm = async ({ startYmd, flightYmd, endYmd, arriveAt: nextArrive, pickPdf }) => {
    setFlightSheetBusy(true);
    try {
      if (!nextArrive) {
        Alert.alert(t('flight_arrive_notice_title'), t('flight_arrive_required'));
        return;
      }
      await setWorkStartAt(candidate.user_id, startYmd, flightYmd, endYmd);
      await saveArrival(candidate.user_id, nextArrive, agencyUserId);
      setWorkStartAtState(startYmd);
      setPlannedEndOn(endYmd);
      setArriveAt(nextArrive);
      if (pickPdf) {
        const DocumentPicker = await import('expo-document-picker');
        const { File } = await import('expo-file-system');
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
        if (res.canceled || !res.assets || !res.assets.length) {
          setFlightSheet(null);
          return;
        }
        const a = res.assets[0];
        const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) { Alert.alert(t('doc_flight_ticket'), t('doc_pdf_only')); return; }
        setUploading('flight_ticket');
        const base64 = await new File(a.uri).base64();
        const row = await uploadDocument(candidate.user_id, 'flight_ticket', base64, 'application/pdf');
        setDocs((m) => ({ ...m, flight_ticket: row }));
      } else {
        await refreshEpisode();
      }
      setFlightSheet(null);
    } catch (e) {
      Alert.alert(t('doc_flight_ticket'), e?.message || t('doc_upload_error'));
    } finally {
      setFlightSheetBusy(false);
      setUploading(null);
    }
  };

  // "Belgeleri Gönder": adımın yüklü belgelerini adaya ilet (onaylı). Gönderince adım kilitlenir.
  // Acente: adayın gönderdiği belgeyi beğenmedi -> tekrar iste (silinir + adaya bildirim).
  const doRequestReupload = (kind) => {
    Alert.alert(t('reupload_btn'), t('reupload_confirm'), [
      { text: t('agency_cancel'), style: 'cancel' },
      { text: t('reupload_btn'), style: 'destructive', onPress: async () => {
          try { await requestReupload(candidate.user_id, kind); await refreshDocs(); }
          catch (e) { Alert.alert(t('reupload_btn'), e?.message || 'error'); }
        } },
    ]);
  };

  const retractErrMsg = (e) => {
    const msg = String(e?.message || e?.code || '');
    if (msg.includes('already_hired')) return t('agency_retract_blocked_hired');
    if (msg.includes('flight_already_sent') || msg.includes('in_transit')) return t('agency_retract_blocked_flight');
    return e?.message || 'error';
  };

  const doRetractAgencyDoc = (kind) => {
    const title = t('agency_retract_btn');
    const confirm = kind === 'flight_ticket' ? t('agency_retract_flight_confirm') : t('agency_retract_contract_confirm');
    Alert.alert(title, confirm, [
      { text: t('agency_cancel'), style: 'cancel' },
      {
        text: t('agency_retract_btn'),
        style: 'destructive',
        onPress: async () => {
          setUploading(kind);
          try {
            await retractAgencyDoc(candidate.user_id, kind);
            notifyDocument(candidate.user_id, 'agency_doc_retracted');
            await refreshDocs();
            if (kind === 'flight_ticket') await refreshEpisode();
            if (kind === 'contract_unsigned') {
              setDocs((m) => {
                const n = { ...m };
                delete n.contract_unsigned;
                delete n.contract_signed;
                return n;
              });
            }
          } catch (e) {
            Alert.alert(title, retractErrMsg(e));
          } finally {
            setUploading(null);
          }
        },
      },
    ]);
  };

  const replaceFlightTicketPdf = () => {
    Alert.alert(t('flight_change_ticket'), t('agency_replace_flight_confirm'), [
      { text: t('agency_cancel'), style: 'cancel' },
      {
        text: t('flight_change_ticket'),
        onPress: async () => {
          try {
            const DocumentPicker = await import('expo-document-picker');
            const { File } = await import('expo-file-system');
            const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
            if (res.canceled || !res.assets?.length) return;
            const a = res.assets[0];
            const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
            if (!isPdf) { Alert.alert(t('doc_flight_ticket'), t('doc_pdf_only')); return; }
            setUploading('flight_ticket');
            const base64 = await new File(a.uri).base64();
            const row = await replaceSubmittedDocument(candidate.user_id, 'flight_ticket', base64, 'application/pdf');
            setDocs((m) => ({ ...m, flight_ticket: row }));
            notifyDocument(candidate.user_id, 'flight_ticket_updated');
          } catch (e) {
            Alert.alert(t('flight_change_ticket'), e?.message || t('doc_upload_error'));
          } finally {
            setUploading(null);
          }
        },
      },
    ]);
  };

  const submitStep = (s) => {
    const kinds = s.kinds.filter((k) => k !== 'contract_unsigned' && docs[k]);
    if (!kinds.length) return;
    if (kinds.includes('flight_ticket') && !workStartAt) {
      Alert.alert(t('work_start_title'), t('work_start_required_before_send'), [
        { text: t('consent_cancel'), style: 'cancel' },
        { text: t('work_start_pick'), onPress: () => setFlightSheet('upload') },
      ]);
      return;
    }
    if (kinds.includes('flight_ticket') && !arriveAt) {
      Alert.alert(t('flight_arrive_notice_title'), t('flight_arrive_required_before_send'), [
        { text: t('consent_cancel'), style: 'cancel' },
        { text: t('work_start_pick'), onPress: () => setFlightSheet('upload') },
      ]);
      return;
    }
    Alert.alert(t('docs_send_confirm_title'), t('docs_send_confirm_msg'), [
      { text: t('docs_send_review'), style: 'cancel' },
      {
        text: t('docs_send'),
        onPress: async () => {
          setSending(true);
          try {
            const rows = await submitDocuments(candidate.user_id, kinds);
            setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
            notifyDocumentSubmit(candidate.user_id, kinds);
            if (kinds.includes('flight_ticket')) {
              setIsHired(true);
              await refreshEpisode();
            }
          } catch (e) {
            const msg = String(e?.message || '');
            if (msg.includes('work_start_required')) {
              Alert.alert(t('work_start_title'), t('work_start_required_before_send'), [
                { text: t('work_start_pick'), onPress: () => setFlightSheet('upload') },
              ]);
            } else {
              Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
            }
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  // Aday belgeler ekranı ile aynı kart dili. Perspektif acente: "mine" = acentenin yükleyeceği adım.
  const StepCard = ({ s }) => {
    const actor = stepActor(s, has);
    const mine = actor === 'agency';
    const act = activeStep(has);
    const pipelineMode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
    const waitingCand = pipelineMode === 'active' && !mine;
    const mode = pipelineMode;
    const doneN = s.kinds.filter(has).length;
    const totalN = s.kinds.length;
    const tabDone = totalN > 0 && doneN === totalN;
    const cardStyle = (pipelineMode === 'active' && mine)
      ? [styles.stepCard, styles.cardActive]
      : waitingCand ? [styles.stepCard, styles.cardWait]
        : (tabDone || pipelineMode === 'done') ? [styles.stepCard, styles.cardDone]
          : [styles.stepCard, styles.cardLocked];
    const circleStyle = (tabDone || pipelineMode === 'done') ? styles.circleDone
      : (pipelineMode === 'active' && mine) ? styles.circleYou
        : waitingCand ? styles.circleWait
          : styles.circleLocked;
    const expanded = (pipelineMode === 'locked' && !waitingCand)
      ? false
      : (openStep == null ? (pipelineMode === 'active' || waitingCand) : openStep === s.step);
    const canToggle = pipelineMode !== 'locked' || waitingCand || tabDone || pipelineMode === 'done';
    return (
      <View style={cardStyle}>
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
            <Text style={styles.stepNoText}>{(tabDone || pipelineMode === 'done') ? '✓' : s.step}</Text>
          </View>
          <Text style={[styles.stepTitle, pipelineMode === 'locked' && styles.stepTitleMuted]} numberOfLines={2}>{t(s.titleKey)}</Text>
          {pipelineMode !== 'locked' ? (
            <View style={[styles.ownerChip, waitingCand || !mine ? styles.ownerOther : styles.ownerYou]}>
              <Text style={[styles.ownerChipText, waitingCand || !mine ? styles.ownerOtherText : styles.ownerYouText]}>
                {mine && !waitingCand ? t('doc_owner_agency') : t('doc_owner_candidate')}
              </Text>
            </View>
          ) : null}
          {pipelineMode === 'active' && mine ? (
            <View style={styles.nowChip}><Text style={styles.nowChipText}>{t('docs_now')}</Text></View>
          ) : waitingCand ? (
            <Text style={styles.waitLabel}>{t('docs_waiting')}</Text>
          ) : pipelineMode === 'locked' && !tabDone ? (
            <Text style={styles.lockedIcon}>🔒</Text>
          ) : (
            <Text style={[styles.progressLabel, tabDone && styles.progressDone]}>
              {t('docs_progress', { n: String(doneN), m: String(totalN) })}
            </Text>
          )}
        </TouchableOpacity>

        {s.step === 1 && docsReady && deadline && !s.kinds.every(has) ? (
          <View style={[styles.deadlineBox, remainMs <= 0 ? styles.deadlineOver : remainMs <= 3 * 24 * 3600 * 1000 ? styles.deadlineWarn : null]}>
            <Text style={[styles.deadlineClock, remainMs <= 0 && styles.deadlineClockOver]}>
              {remainMs <= 0 ? t('deadline_overdue_short') : formatDeadlineRemain(remainMs, t)}
            </Text>
            <Text style={styles.deadlineText}>
              {remainMs <= 0 ? t('docs_pkg_overdue_ag') : t('docs_countdown_sub_ag')}
            </Text>
            {deadline.extraRequested ? (
              <Text style={styles.deadlineExtraDone}>{t('docs_extra_done', { n: String(DOCS_EXTRA_DAYS) })}</Text>
            ) : null}
          </View>
        ) : null}

        {expanded ? (
          <>
        {s.kinds.map((kind) => {
          if (kind === 'contract_signed') return null;

          // Hizmet Sözleşmesi (acente): bilgileri doldur → kaşe otomatik → Gönder.
          if (kind === 'contract_unsigned') {
            // Kilitli (aday henüz pasaportunu göndermedi): sözleşme açılmaz.
            if (mode === 'locked') {
              return (
                <View key={kind} style={styles.subRow}>
                  <View style={styles.subLocked}>
                    <View style={styles.subMain}>
                      <Text style={styles.subBullet}>🔒</Text>
                      <Text style={[styles.subLabel, styles.subLabelMuted, styles.subLabelFull]}>{t('doc_contract_unsigned')}</Text>
                    </View>
                    <Text style={styles.lockedHintBlock}>{t('doc_wait_passport')}</Text>
                  </View>
                </View>
              );
            }
            const up2 = isUploaded('contract_unsigned');
            const sent = isSubmitted('contract_unsigned');
            const cbusy = uploading === 'contract_unsigned';
            return (
              <View key={kind} style={styles.subRow}>
                <View style={styles.subMain}>
                  <Text style={[styles.subBullet, (sent || up2) && styles.subBulletDone]}>{(sent || up2) ? '✓' : '•'}</Text>
                  <Text style={[styles.subLabel, mode === 'locked' && styles.subLabelMuted]}>{t('doc_contract_unsigned')}</Text>
                  {up2 && !sent ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                  <View style={{ flex: 1 }} />
                  {sent ? (
                    <View style={styles.viewLinks}>
                      <TouchableOpacity onPress={() => viewDoc('contract_unsigned')}><Text style={styles.linkView}>{t('doc_view')}</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => downloadDoc('contract_unsigned')} disabled={downloading}>
                        <Text style={styles.linkView}>{t('doc_download')}</Text>
                      </TouchableOpacity>
                      {!isHired ? (
                        <TouchableOpacity onPress={() => doRetractAgencyDoc('contract_unsigned')}>
                          <Text style={styles.linkReject}>{t('agency_retract_btn')}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : !contract?.title ? (
                    <TouchableOpacity style={styles.addBtnSm} onPress={openEmployerPicker} activeOpacity={0.8}>
                      <Text style={styles.addBtnText}>{t('contract_create')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {!sent && contract?.title ? (
                  <View style={styles.subLinks}>
                    {(stampEmployer?.name || contract?.title) ? (
                      <Text style={styles.contractEmpName} numberOfLines={2}>
                        {stampEmployer?.name || contract.title}
                      </Text>
                    ) : null}
                    <Text style={styles.contractHelp}>
                      {stampInfo?.image ? t('stamp_contract_ready_hint') : t('stamp_contract_need_hint')}
                    </Text>
                    <TouchableOpacity style={styles.changeBtn} onPress={openEmployerPicker} activeOpacity={0.85}>
                      <Text style={styles.changeBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        {t('employer_reselect')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.changeBtn}
                      onPress={() => setFormVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.changeBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        {t('contract_edit_fields') || t('contract_form_title')}
                      </Text>
                    </TouchableOpacity>
                    {!stampInfo?.image ? (
                      <TouchableOpacity style={styles.changeBtn} onPress={openStampForContract} activeOpacity={0.85}>
                        <Text style={styles.changeBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                          {t('stamp_capture')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.changeBtn}
                      onPress={() => setPreviewVisible(true)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.changeBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                        {t('contract_view')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sendBtn, (busy || cbusy) && { opacity: 0.6 }]}
                      onPress={async () => {
                        if (!employerReadyForContract(stampEmployer) && contract?.employerId) {
                          const emp = stampEmployer?.id === contract.employerId
                            ? stampEmployer
                            : await getEmployer(agencyUserId, contract.employerId);
                          const reason = employerContractBlockReason(emp);
                          Alert.alert(
                            t('contract_send'),
                            reason === 'tax' ? t('employer_need_tax')
                              : reason === 'stamp' ? t('employer_need_stamp')
                                : t('employer_need_both'),
                          );
                          return;
                        }
                        if (!stampInfo?.image) {
                          Alert.alert(t('stamp_title'), t('stamp_need_setup'));
                          openStampForContract();
                          return;
                        }
                        setUploading('contract_unsigned');
                        try {
                          await sendStampedContract();
                        } catch (e) {
                          if (e?.message !== 'cancelled') Alert.alert(t('stamp_title'), e?.message || 'error');
                        } finally {
                          setUploading(null);
                        }
                      }}
                      disabled={busy || cbusy}
                      activeOpacity={0.9}
                    >
                      {(busy || cbusy)
                        ? <ActivityIndicator color="#1b2533" />
                        : (
                          <Text style={styles.sendBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                            {t('contract_send')}  →
                          </Text>
                        )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }
          const kst = kindState(kind, has);
          const busy = uploading === kind;
          const draft = mine && isUploaded(kind) && !isSubmitted(kind);
          const muteLabel = mode === 'locked' || (mode === 'done' && mine);
          return (
            <View key={kind} style={styles.subRow}>
              <View style={styles.subMain}>
                <Text style={[styles.subBullet, (kst === 'done' || draft) && styles.subBulletDone]}>{(kst === 'done' || draft) ? '✓' : '•'}</Text>
                <Text style={[styles.subLabel, muteLabel && styles.subLabelMuted]}>{t(`doc_${kind}`)}</Text>
                {draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                <View style={{ flex: 1 }} />
                {kst === 'done' ? (
                  <View style={styles.viewLinks}>
                    <TouchableOpacity onPress={() => (kind === 'contract_unsigned' ? viewContractPdf() : viewDoc(kind))}>
                      <Text style={styles.linkView}>{t('doc_view')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadDoc(kind)} disabled={downloading}>
                      <Text style={styles.linkView}>{t('doc_download')}</Text>
                    </TouchableOpacity>
                    {!mine ? (
                      <TouchableOpacity onPress={() => doRequestReupload(kind)}>
                        <Text style={styles.linkReject}>{t('reupload_btn')}</Text>
                      </TouchableOpacity>
                    ) : kind === 'flight_ticket' && !isHired ? (
                      <>
                        <TouchableOpacity onPress={replaceFlightTicketPdf} disabled={busy}>
                          <Text style={styles.linkView}>{t('flight_change_ticket')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => doRetractAgencyDoc('flight_ticket')} disabled={busy}>
                          <Text style={styles.linkReject}>{t('agency_retract_btn')}</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                ) : draft ? (
                  <View style={styles.viewLinks}>
                    <TouchableOpacity onPress={() => viewDoc(kind)}>
                      <Text style={styles.linkView}>{t('doc_view')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => downloadDoc(kind)} disabled={downloading}>
                      <Text style={styles.linkView}>{t('doc_download')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : kst === 'active' && mine ? (
                  <TouchableOpacity
                    style={styles.addBtnSm}
                    onPress={() => (kind === 'contract_unsigned' ? openEmployerPicker() : kind === 'flight_ticket' ? uploadFlightTicketPdf() : uploadAgencyDoc(kind))}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    {busy ? <ActivityIndicator color="#1b2533" /> : (
                      <Text style={styles.addBtnText}>{kind === 'flight_ticket' ? t('flight_add_ticket') : t('doc_upload')}</Text>
                    )}
                  </TouchableOpacity>
                ) : kst === 'locked' ? (
                  <Text style={styles.lockedIcon}>🔒</Text>
                ) : null}
              </View>
              {draft ? (
                <View style={styles.subLinks}>
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => (kind === 'flight_ticket' ? uploadFlightTicketPdf() : uploadAgencyDoc(kind))}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.changeBtnText}>✎ {kind === 'flight_ticket' ? t('flight_change_ticket') : t('photo_change')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changeBtn} onPress={() => removeAgencyDoc(kind)} activeOpacity={0.85}>
                    <Text style={[styles.changeBtnText, styles.removeText]}>🗑 {t('photo_remove')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {kind === 'flight_ticket' && mine && kst === 'active' && !draft ? (
                <Text style={styles.lockedHintBlock}>ℹ️ {t('doc_pdf_only')}</Text>
              ) : null}
              {(kind === 'work_permit' || kind === 'flight_ticket') && cvData?.preferredStartDate ? (
                <Text style={styles.prefDateHint}>📅 {t('start_date_agency')}: {cvData.preferredStartDate}</Text>
              ) : null}
              {kind === 'flight_ticket' && workStartAt ? (
                <TouchableOpacity onPress={() => setFlightSheet(isHired || draft || isUploaded(kind) ? 'edit' : 'upload')} activeOpacity={0.85}>
                  <Text style={styles.lockedHintBlock}>
                    📅 {t('work_start_label')}: {String(workStartAt).slice(0, 10)}
                    {plannedEndOn ? ` → ${String(plannedEndOn).slice(0, 10)}` : ''}
                    {arriveAt ? ` · ${t('flight_arrive_label')}: ${arriveAt}` : ''}
                    {' · '}{t('work_start_edit')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {kind === 'flight_ticket' && mine && !workStartAt && (draft || kst === 'active') ? (
                <TouchableOpacity onPress={() => setFlightSheet('upload')} activeOpacity={0.85}>
                  <Text style={[styles.lockedHintBlock, { color: '#a32d2d' }]}>⚠️ {t('work_start_required')}</Text>
                </TouchableOpacity>
              ) : null}
              {kind === 'flight_ticket' && mine && workStartAt && !arriveAt && (draft || kst === 'active') ? (
                <TouchableOpacity onPress={() => setFlightSheet('upload')} activeOpacity={0.85}>
                  <Text style={[styles.lockedHintBlock, { color: '#a32d2d' }]}>{t('flight_arrive_required')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {/* Belgeleri Gönder: sıra acentede + adımın tüm (dosya) belgeleri yüklü (taslak).
            Sözleşme kendi formuyla gönderildiği için bu genel butonun dışında. */}
        {mode === 'active' && mine && !s.kinds.includes('contract_unsigned') && s.kinds.every((k) => isUploaded(k)) ? (
          <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={() => submitStep(s)} disabled={sending} activeOpacity={0.9}>
            {sending ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sendBtnText}>{t('docs_send')}  →</Text>}
          </TouchableOpacity>
        ) : null}

        {mode === 'active' && !mine ? (
          <View style={styles.waitBanner}><Text style={styles.waitBannerText}>⏳ {t('doc_candidate_turn')}</Text></View>
        ) : null}
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={[styles.title, fontsReady && styles.titleFont]} numberOfLines={1}>{maskedName(data) || code}</Text>
          <Text style={styles.titleCode} numberOfLines={1}>{code}</Text>
          {ratingSummary ? (
            <RatingBadge avg={ratingSummary.avg} count={ratingSummary.count} compact />
          ) : null}
        </View>
        {isAccepted ? (
          <TouchableOpacity style={[styles.withdrawBtn, busy && styles.dim]} onPress={withdrawOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#a32d2d" /> : <Text style={styles.withdrawText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{isHired ? t('staff_end') : t('process_end')}</Text>}
          </TouchableOpacity>
        ) : offered ? (
          <TouchableOpacity style={[styles.withdrawBtn, busy && styles.dim]} onPress={withdrawOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#a32d2d" /> : <Text style={styles.withdrawText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('offer_withdraw_btn')}</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.offerBtn, busy && styles.dim]} onPress={acceptOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.offerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('agency_offer')}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {(offered || isAccepted || isHired || isTransit) ? (
        <TouchableOpacity style={styles.noticeBtn} onPress={() => setNoticeOpen(true)} activeOpacity={0.85}>
          <Text style={styles.noticeBtnText}>{t('agency_notice')}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Teklif bekleniyor: tam genişlik, yanıp sönen bilgi şeridi (cevap gelene kadar) */}
      {offered ? (
        <Animated.View style={[styles.offerBanner, { opacity: offerBlink }]}>
          <Text style={styles.offerBannerText}>⏳ {t('offer_sent_note')}</Text>
        </Animated.View>
      ) : null}

      {(isAccepted || isHired || isTransit) && (contract || flightDepartOn || deadline || boardingStatus) ? (
        <View style={styles.opsSignals}>
          {isTransit ? (
            <View style={[styles.opsSignal, styles.opsSignalWarn]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                {workStartDue
                  ? (t('ops_start_confirm_hint') || 'İşe başlama onayı bekleniyor')
                  : `${t('ops_transit_signal') || 'Yolda / başlangıç bekliyor'}${workStartAt ? ` · ${String(workStartAt).slice(0, 10)}` : ''}`}
              </Text>
              {arriveCountdownLeft > 0 ? (
                <Text style={styles.opsSignalClock} numberOfLines={1}>
                  ⏱ {t('arrive_countdown_title')}: {formatCountdown(arriveCountdownLeft)}
                </Text>
              ) : null}
              {workStartCountdownLeft > 0 ? (
                <Text style={styles.opsSignalClock} numberOfLines={1}>
                  ⏱ {t('work_start_countdown_title')}: {formatCountdown(workStartCountdownLeft)}
                </Text>
              ) : null}
            </View>
          ) : null}
          {contract ? (
            <View style={[styles.opsSignal, contract.isPaid ? styles.opsSignalOk : styles.opsSignalWarn]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                {contract.isPaid
                  ? 'Sözleşme adımı açık'
                  : (chatOn ? 'Sözleşme ödemesi bekleniyor' : 'Aday sözleşme adımında (Turquz) — sohbet henüz kapalı')}
              </Text>
            </View>
          ) : null}
          {boardingStatus ? (
            <View style={[
              styles.opsSignal,
              boardingStatus === 'confirmed' ? styles.opsSignalOk
                : boardingStatus === 'missed' ? styles.opsSignalHot
                : styles.opsSignalWarn,
            ]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                Uçuş: {{
                  pending: 'teyit bekleniyor',
                  confirmed: 'onaylandı',
                  missed: 'kaçırıldı',
                  no_response: 'cevap yok',
                }[boardingStatus] || boardingStatus}
                {flightDepartOn ? ` · ${String(flightDepartOn).slice(0, 10)}` : ''}
              </Text>
            </View>
          ) : null}
          {deadline?.end && isAccepted && !isHired && !isTransit ? (
            <View style={[styles.opsSignal, remainMs < 0 ? styles.opsSignalHot : styles.opsSignalMuted]}>
              <Text style={styles.opsSignalText} numberOfLines={1}>
                {t('docs_deadline_signal') || 'İlk belge paketi süresi'}
              </Text>
              <Text style={[styles.opsSignalClock, remainMs < 0 && styles.opsSignalClockHot]} numberOfLines={1}>
                {remainMs < 0
                  ? (t('deadline_overdue_short') || 'Süre doldu')
                  : formatDeadlineRemain(remainMs, t)}
              </Text>
              <Text style={styles.opsSignalSub} numberOfLines={1}>
                {t('docs_deadline_until', {
                  when: deadline.end.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  }),
                }) || `Son tarih: ${deadline.end.toLocaleString('tr-TR')}`}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {isTransit && (boardingStatus === 'pending' || boardingStatus === 'no_response') ? (
        <View style={styles.hireConfirmBox}>
          <Text style={styles.hireConfirmTitle}>{t('boarding_agency_title')}</Text>
          <Text style={styles.hireConfirmLead}>
            {boardingStatus === 'no_response' ? t('boarding_agency_lead_silent') : t('boarding_agency_lead_pending')}
          </Text>
          <TouchableOpacity
            style={[styles.hireConfirmYes, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await agencyAnswerBoarding(candidate.user_id, 'confirmed');
                await refreshEpisode();
                Alert.alert(t('boarding_agency_title'), t('boarding_agency_yes_ok'));
              } catch (e) {
                Alert.alert(t('boarding_agency_title'), e?.message || 'error');
              } finally { setBusy(false); }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.hireConfirmYesText}>{t('boarding_agency_yes')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hireConfirmNo, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await agencyAnswerBoarding(candidate.user_id, 'missed');
                await refreshEpisode();
                Alert.alert(t('boarding_agency_title'), t('boarding_missed_next'));
              } catch (e) {
                Alert.alert(t('boarding_agency_title'), e?.message || 'error');
              } finally { setBusy(false); }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.hireConfirmNoText}>{t('boarding_agency_no')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isTransit && boardingStatus === 'missed' ? (
        <View style={styles.hireConfirmBox}>
          <Text style={styles.hireConfirmTitle}>{t('notif_boarding_missed')}</Text>
          <Text style={styles.hireConfirmLead}>{t('boarding_missed_next')}</Text>
          <TouchableOpacity
            style={[styles.hireConfirmYes, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => setFlightSheet('edit')}
            activeOpacity={0.85}
          >
          <Text style={styles.hireConfirmYesText}>{t('boarding_missed_dates_cta')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isTransit && boardingStatus !== 'pending' && boardingStatus !== 'no_response' && boardingStatus !== 'missed' && (workStartDue || workStartCountdownLeft > 0) ? (
        workStartDue ? (
        <View style={styles.hireConfirmBox}>
          <Text style={styles.hireConfirmTitle}>{t('ops_start_confirm')}</Text>
          <Text style={styles.hireConfirmLead}>{t('ops_start_lead')}</Text>
          <TouchableOpacity
            style={[styles.hireConfirmYes, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => {
              Alert.alert('Personel kaydet', 'Aday işe başladı olarak işaretlensin mi?', [
                { text: t('consent_cancel'), style: 'cancel' },
                { text: 'Evet — kaydet', onPress: async () => {
                  setBusy(true);
                  try {
                    await confirmHire(candidate.user_id);
                    setIsTransit(false);
                    setIsHired(true);
                    await refreshEpisode();
                    Alert.alert('Personel', 'Personel olarak kaydedildi.');
                  } catch (e) {
                    Alert.alert('Personel', e?.message || 'error');
                  } finally { setBusy(false); }
                } },
              ]);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.hireConfirmYesText}>Evet — Personel kaydet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.hireConfirmNo, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Alert.prompt(
                  'Yeni başlangıç tarihi',
                  'YYYY-MM-DD',
                  async (v) => {
                    if (!v) return;
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                      Alert.alert('Tarih', 'Format YYYY-MM-DD olmalı');
                      return;
                    }
                    setBusy(true);
                    try {
                      await deferWorkStart(candidate.user_id, v);
                      await refreshEpisode();
                      Alert.alert('Ertelendi', `Başlangıç ${v}`);
                    } catch (e) {
                      Alert.alert('Erteleme', e?.message || 'error');
                    } finally { setBusy(false); }
                  },
                  'plain-text',
                  workStartAt ? String(workStartAt).slice(0, 10) : '',
                );
              } else {
                setFlightSheet('edit');
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.hireConfirmNoText}>{t('ops_start_no')}</Text>
          </TouchableOpacity>
        </View>
        ) : (
        <View style={styles.hireConfirmBox}>
          <Text style={styles.hireConfirmTitle}>{t('ops_start_confirm')}</Text>
          <CountdownBanner
            variant="muted"
            titleKey="work_start_countdown_title"
            subKey="work_start_countdown_sub_ag"
            leftMs={workStartCountdownLeft}
          />
        </View>
        )
      ) : null}

      {isHired && episode?.outcome === 'early_exit_pending' ? (
        <View style={[styles.offerBanner, styles.empBanner]}>
          <Text style={styles.offerBannerText}>
            ⏳ {episode.end_requested_by === agencyUserId ? t('emp_pending_mine') : t('emp_pending_theirs')}
          </Text>
          <View style={styles.empBannerBtns}>
            {episode.end_requested_by === agencyUserId ? (
              <TouchableOpacity
                style={styles.empBannerBtnGhost}
                onPress={() => {
                  Alert.alert(t('emp_undo'), t('emp_undo_confirm'), [
                    { text: t('consent_cancel'), style: 'cancel' },
                    { text: t('emp_undo'), onPress: async () => {
                        try { await undoEmploymentEnd(episode.id); await refreshEpisode(); }
                        catch (e) { Alert.alert(t('emp_undo'), e?.message || 'error'); }
                      } },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.empBannerBtnGhostText} numberOfLines={1}>{t('emp_undo')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.empBannerBtn}
                  onPress={() => {
                    Alert.alert(t('emp_accept'), t('emp_accept_confirm'), [
                      { text: t('consent_cancel'), style: 'cancel' },
                      { text: t('emp_accept'), onPress: async () => {
                          try {
                            await acceptEmploymentEnd(episode.id);
                            onAccepted?.();
                          } catch (e) {
                            Alert.alert(t('emp_accept'), e?.message || 'error');
                          }
                        } },
                    ]);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.empBannerBtnText} numberOfLines={1}>{t('emp_accept')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.empBannerBtnGhost}
                  onPress={async () => {
                    try { await contestEmploymentEnd(episode.id); await refreshEpisode(); }
                    catch (e) { Alert.alert(t('emp_contest'), e?.message || 'error'); }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.empBannerBtnGhostText} numberOfLines={1}>{t('emp_contest')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      ) : null}

      {isHired && episode?.outcome === 'disputed' ? (
        <View style={styles.offerBanner}>
          <Text style={styles.offerBannerText}>⚖️ {t('emp_disputed')}</Text>
        </View>
      ) : null}

      {isHired && episode?.outcome === 'completion_pending' ? (
        <View style={[styles.offerBanner, styles.empBanner]}>
          <Text style={styles.offerBannerText}>{t('emp_term_body')}</Text>
          {episode.term_vote_agency === 'ok' ? (
            <Text style={[styles.offerBannerText, { marginTop: 8 }]}>{t('emp_term_waiting')}</Text>
          ) : (
            <View style={styles.empBannerBtns}>
              <TouchableOpacity
                style={styles.empBannerBtn}
                onPress={() => {
                  Alert.alert(t('emp_term_ok'), t('emp_term_ok_confirm'), [
                    { text: t('consent_cancel'), style: 'cancel' },
                    { text: t('emp_term_ok'), onPress: async () => {
                        try { await answerEmploymentTerm(episode.id, 'ok'); await refreshEpisode(); }
                        catch (e) { Alert.alert(t('emp_term_ok'), e?.message || 'error'); }
                      } },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.empBannerBtnText} numberOfLines={1}>{t('emp_term_ok')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.empBannerBtnGhost}
                onPress={() => {
                  Alert.alert(t('emp_term_problem'), t('emp_term_problem_confirm'), [
                    { text: t('consent_cancel'), style: 'cancel' },
                    { text: t('emp_term_problem'), style: 'destructive', onPress: async () => {
                        try { await answerEmploymentTerm(episode.id, 'problem'); await refreshEpisode(); }
                        catch (e) { Alert.alert(t('emp_term_problem'), e?.message || 'error'); }
                      } },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.empBannerBtnGhostText} numberOfLines={1}>{t('emp_term_problem')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {/* Mülakat: süreç öncesi planlama + planlandıysa slot/geri sayım/katıl. Biten → yalnızca planla. */}
      {((!offered && !isAccepted) || hasInterview || iv?.status === 'proposed' || iv?.status === 'scheduled') ? (
        <View style={styles.interviewBarCol}>
          {(!offered && !isAccepted) && iv?.status === 'scheduled' && iv.selectedSlot && !callWindow(iv.selectedSlot, callOpts).ended ? (() => {
            const win = callWindow(iv.selectedSlot, callOpts);
            const left = (win.base || 0) - nowTick;
            return (
              <View style={styles.ivSchedBar}>
                <TouchableOpacity style={styles.ivSchedInfo} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
                  <Text style={styles.ivSchedTitle}>✓ {t('iv_scheduled')}</Text>
                  <Text style={styles.ivSchedSlot} numberOfLines={1}>
                    {weekdayOf(iv.selectedSlot, lang)} · {slotDateKey(iv.selectedSlot)} · 🕒 {slotTime(iv.selectedSlot)}
                  </Text>
                  {left > 0 ? (
                    <Text style={styles.ivCountdown}>⏱ {t('iv_countdown')}: {formatCountdown(left)}</Text>
                  ) : null}
                </TouchableOpacity>
                {win.joinable ? (
                  <TouchableOpacity style={styles.ivJoinBtn} onPress={() => setInterviewOpen(true)} activeOpacity={0.9}>
                    <Text style={styles.ivJoinBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>🎥 {t('call_join')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.ivDetailBtn} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
                    <Text style={styles.ivDetailBtnText}>›</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })() : null}
          {(!offered && !isAccepted) && iv?.status === 'proposed' ? (
            <TouchableOpacity style={styles.ivProposedBar} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
              <Text style={styles.ivProposedText} numberOfLines={2}>⏳ {t('iv_proposed_status')}</Text>
              <Text style={styles.ivProposedChev}>›</Text>
            </TouchableOpacity>
          ) : null}
          {(!offered && !isAccepted) && (
            !iv
            || iv.status === 'done'
            || iv.status === 'cancelled'
            || (iv.status === 'scheduled' && iv.selectedSlot && callWindow(iv.selectedSlot, callOpts).ended)
            || (iv.status !== 'proposed' && iv.status !== 'scheduled')
          ) ? (
            <TouchableOpacity style={styles.interviewBtn} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
              <Text style={styles.interviewBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>🎥 {t('iv_propose_title')}</Text>
            </TouchableOpacity>
          ) : null}
          {hasInterview ? (
            <TouchableOpacity style={styles.transcriptBtn} onPress={() => setTranscriptOpen(true)} activeOpacity={0.85}>
              <Text style={styles.transcriptBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>📝 {t('transcript_btn')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Sekmeler — yalnızca teklif gönderildikten sonra (CV ve Belgeler birlikte) */}
      {isAccepted ? (
        <View style={styles.tabs}>
          {['cv', 'docs'].map((tk) => (
            <TouchableOpacity key={tk} style={[styles.tab, activeTab === tk && styles.tabOn]} onPress={() => { setTab(tk); if (tk === 'docs') refreshDocs(); }} activeOpacity={0.8}>
              <Text style={[styles.tabText, activeTab === tk && styles.tabTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tk === 'cv' ? t('agency_tab_cv') : t('agency_tab_docs')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {activeTab === 'cv' ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.cvScrollContent, { paddingBottom: insets.bottom + (PROCESS_CHAT_ENABLED && chatOn ? 92 : 28) }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2a25a" colors={['#c2a25a']} />}
        >
          {(photos.length || data.introVideo) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent} nestedScrollEnabled>
              {data.introVideo ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => introVideoUrl && setVideoPlay(true)} style={styles.thumbBox}>
                  <View style={styles.thumbWrap}>
                    {introVideoUrl ? (
                      <View pointerEvents="none" style={styles.thumb}>
                        <WebView
                          source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;overflow:hidden"><video src="${introVideoUrl}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;background:#000"></video></body></html>` }}
                          style={styles.thumb}
                          originWhitelist={['*']}
                          allowsInlineMediaPlayback
                          scrollEnabled={false}
                        />
                      </View>
                    ) : (
                      <View style={[styles.thumb, styles.thumbVideoLoading]}><ActivityIndicator color="#c2a25a" /></View>
                    )}
                    <View style={styles.thumbVideoOverlay} pointerEvents="none">
                      <View style={styles.thumbVideoBadge}><Text style={styles.thumbVideoPlay}>▶</Text></View>
                    </View>
                  </View>
                  <Text style={styles.thumbCap}>{t('intro_video_cap')}</Text>
                </TouchableOpacity>
              ) : null}
              {photos.map((p, i) => (
                <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setGalleryIndex(i)} style={styles.thumbBox}>
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
                    <PhotoWatermark size={24} margin={6} />
                  </View>
                  <Text style={styles.thumbCap}>{p.cap}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {ratingSummary ? <RatingBreakdown stats={ratingSummary} /> : null}
          <View style={styles.cvToolbar}>
            <TouchableOpacity
              style={[styles.cvEditBtn, hasCvOverrides && styles.cvEditBtnOn]}
              onPress={() => setCvEditorOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.cvEditBtnText, hasCvOverrides && styles.cvEditBtnTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                ✏ {hasCvOverrides ? t('cv_edit_edited') : t('cv_edit_btn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cvEditBtn, isFav && styles.cvEditBtnOn]}
              onPress={onToggleFav}
              disabled={favBusy}
              activeOpacity={0.85}
            >
              <Text style={[styles.cvEditBtnText, isFav && styles.cvEditBtnTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {isFav ? '★' : '☆'} {t('fav_btn')}
              </Text>
            </TouchableOpacity>
            {canRate ? (
              <TouchableOpacity
                style={[styles.cvEditBtn, hasMyRating && styles.cvEditBtnOn]}
                onPress={() => setRateOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.cvEditBtnText, hasMyRating && styles.cvEditBtnTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  ★ {hasMyRating ? t('rate_btn_edit') : t('rate_btn')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {cvTr ? (
            <View style={[styles.trBar, styles.cvPadH]}>
              <Text style={styles.trBadge}>🌐 {showOriginal ? t('cv_show_original') : t('cv_ai_translated')}</Text>
              <TouchableOpacity onPress={() => setShowOriginal((o) => !o)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.trToggle}>{showOriginal ? t('cv_show_translation') : t('cv_show_original')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {/* Sabit yükseklik: üstteki puan/foto alanı CV'yi ezmesin; sayfa dikey kaydırılsın */}
          <View style={[styles.cv, { height: Math.round(SCREEN_H * 0.78) }]}>
            <CVPreview data={cvData} masked candidateNo={code} contentKey={cvPreviewKey} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          ref={docsScrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.docsContent, {
            paddingBottom: insets.bottom + (PROCESS_CHAT_ENABLED && chatOn ? 88 : 24) + (kbH > 0 ? kbH + 16 : 0),
          }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2a25a" colors={['#c2a25a']} />}
        >
          {turnStepKey ? (
            <Animated.View style={turnMine ? { opacity: turnBlink } : null}>
              <TouchableOpacity
                style={[styles.turnBox, turnMine ? styles.turnYou : styles.turnAgency]}
                onPress={() => setOpenStep(turnAct || null)}
                activeOpacity={0.9}
              >
                {turnMine ? (
                  <View style={styles.turnAlertRow}>
                    <View style={styles.turnBang}><Text style={styles.turnBangText}>!</Text></View>
                    <Text style={[styles.turnKicker, styles.turnKickerYou]}>{t('docs_turn_you')}</Text>
                  </View>
                ) : (
                  <Text style={[styles.turnKicker, styles.turnKickerAgency]}>{t('docs_turn_candidate')}</Text>
                )}
                <Text style={styles.turnSub}>
                  {turnMine
                    ? t('docs_turn_you_sub_ag', { step: t(turnStepKey) })
                    : t('docs_turn_candidate_sub', { step: t(turnStepKey) })}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {PIPELINE.map((s) => <StepCard key={s.step} s={s} />)}

          {/* 6) Havaalanı transfer — uçak bileti gönderilince açılır */}
          {(() => {
            const pickupOpen = isSubmitted('flight_ticket');
            return (
              <View style={[styles.stepCard, pickupOpen ? styles.cardActive : styles.cardLocked]}>
                <View style={styles.stepHead}>
                  <View style={[styles.stepNo, pickupOpen ? styles.circleYou : styles.circleLocked]}>
                    <Text style={styles.stepNoText}>{pickupOpen ? '✓' : '6'}</Text>
                  </View>
                  <Text style={[styles.stepTitle, !pickupOpen && styles.stepTitleMuted]}>{t('pipe_step_6')}</Text>
                  {pickupOpen ? (
                    <View style={[styles.ownerChip, styles.ownerYou]}>
                      <Text style={[styles.ownerChipText, styles.ownerYouText]}>{t('doc_owner_agency')}</Text>
                    </View>
                  ) : null}
                  {pickupOpen ? (
                    <View style={styles.nowChip}><Text style={styles.nowChipText}>{t('docs_now')}</Text></View>
                  ) : (
                    <Text style={styles.lockedIcon}>🔒</Text>
                  )}
                </View>
                {pickupOpen ? (
                  <>
                    {arriveCountdownLeft > 0 ? (
                      <CountdownBanner
                        variant="muted"
                        titleKey="arrive_countdown_title"
                        subKey="arrive_countdown_sub_ag"
                        leftMs={arriveCountdownLeft}
                      />
                    ) : null}
                    <PickupCard
                    embedded
                    userId={candidate.user_id}
                    role="agency"
                    agencyId={agencyUserId}
                    onInputFocus={scrollPickupIntoView}
                  />
                  </>
                ) : (
                  <Text style={styles.pickupLockText}>🔒 {t('pickup_lock_agency')}</Text>
                )}
              </View>
            );
          })()}

          {/* 7) Turquz başarı sertifikası — admin yükler */}
          {(() => {
            const certOpen = has('success_certificate');
            return (
              <View style={[styles.stepCard, certOpen ? styles.cardDone : styles.cardLocked]}>
                <View style={styles.stepHead}>
                  <View style={[styles.stepNo, certOpen ? styles.circleDone : styles.circleLocked]}>
                    <Text style={styles.stepNoText}>{certOpen ? '✓' : '7'}</Text>
                  </View>
                  <Text style={[styles.stepTitle, !certOpen && styles.stepTitleMuted]}>{t('pipe_step_7')}</Text>
                  {certOpen ? (
                    <View style={[styles.ownerChip, styles.ownerOther]}>
                      <Text style={[styles.ownerChipText, styles.ownerOtherText]}>{t('doc_from_turquz')}</Text>
                    </View>
                  ) : null}
                  {certOpen ? (
                    <Text style={[styles.progressLabel, styles.progressDone]}>{t('docs_progress', { n: '1', m: '1' })}</Text>
                  ) : (
                    <Text style={styles.lockedIcon}>🔒</Text>
                  )}
                </View>
                {certOpen ? (
                  <>
                    <Text style={styles.certCongrats}>🎉 {t('pipe_step_7_desc')}</Text>
                    <View style={styles.subRow}>
                      <View style={styles.subMain}>
                        <Text style={[styles.subBullet, styles.subBulletDone]}>✓</Text>
                        <Text style={styles.subLabel}>{t('doc_success_certificate')}</Text>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity onPress={() => viewDoc('success_certificate')}>
                          <Text style={styles.linkView}>{t('doc_view')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => downloadDoc('success_certificate')} disabled={downloading}>
                          <Text style={styles.linkView}>{t('doc_download')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.pickupLockText}>🔒 {t('pipe_step_7_wait_agency')}</Text>
                )}
              </View>
            );
          })()}
        </ScrollView>
      )}

      <Modal visible={!!viewer} animationType="slide" onRequestClose={closeViewer}>
        <View style={styles.viewerWrap}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.viewerTitle}>{t('doc_view')}</Text>
            <TouchableOpacity onPress={closeViewer} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.viewerX}>✕</Text></TouchableOpacity>
          </View>
          {viewerPdf ? (
            viewer ? <WebView source={{ uri: viewer }} style={styles.viewerBody} originWhitelist={['*']} onLoadEnd={() => setViewerLoading(false)} /> : null
          ) : (
            <ScrollView
              style={styles.viewerBody}
              contentContainerStyle={styles.viewerZoom}
              maximumZoomScale={5}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              {viewer ? <Image source={{ uri: viewer }} style={{ width: SCREEN_W, height: SCREEN_H }} resizeMode="contain" onLoadEnd={() => setViewerLoading(false)} /> : null}
            </ScrollView>
          )}
          {viewerLoading ? (
            <View style={styles.viewerLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#c2a25a" />
              <Text style={styles.viewerLoadingText}>{t('doc_opening')}</Text>
            </View>
          ) : null}
          <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[styles.viewerDl, downloading && { opacity: 0.6 }]}
              onPress={() => downloadDoc(viewerKind)}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.viewerDlText}>{t('doc_download')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PhotoGalleryModal
        visible={galleryIndex !== null}
        photos={photos}
        index={galleryIndex ?? 0}
        onClose={() => setGalleryIndex(null)}
      />

      {/* Tanıtım videosu — tam ekran oynatıcı (WebView + HTML5 video) */}
      <Modal visible={videoPlay} animationType="fade" onRequestClose={() => setVideoPlay(false)}>
        <View style={styles.galWrap}>
          {introVideoUrl ? (
            <WebView
              source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video src="${introVideoUrl}" controls autoplay playsinline style="max-width:100%;max-height:100vh;background:#000"></video></body></html>` }}
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              scrollEnabled={false}
            />
          ) : null}
          <TouchableOpacity style={[styles.galClose, { top: insets.top + 8 }]} onPress={() => setVideoPlay(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.viewerX}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <CvOverrideSheet
        visible={cvEditorOpen}
        base={cvTranslated}
        overrides={cvOverrides}
        onChange={handleOverrideChange}
        onClear={handleClearOverride}
        onClose={() => setCvEditorOpen(false)}
        hasOverrides={hasCvOverrides}
      />

      <CandidateRateSheet
        visible={rateOpen}
        agencyId={agencyUserId}
        candidateId={candidate?.user_id}
        peerLabel={code}
        onClose={() => setRateOpen(false)}
        onSaved={async () => {
          setHasMyRating(true);
          const stats = await listRatingStats([candidate?.user_id]);
          setRatingSummary(stats[candidate?.user_id] || null);
        }}
      />

      <EmployerPickerSheet
        visible={employerPickerVisible}
        agencyId={agencyUserId}
        onSelect={onEmployerPicked}
        onClose={() => setEmployerPickerVisible(false)}
      />

      <ContractForm
        visible={formVisible}
        initial={contract}
        data={data}
        onSaveData={saveContractData}
        onChangeEmployer={() => {
          setFormVisible(false);
          setEmployerPickerVisible(true);
        }}
        onClose={() => setFormVisible(false)}
      />

      <ContractPreview
        visible={previewVisible}
        data={data}
        contract={contract}
        stampInfo={stampInfo}
        onSaveContract={saveContractData}
        onOpenStampSetup={openStampForContract}
        onClose={() => setPreviewVisible(false)}
      />

      <StampSetupSheet
        visible={stampOpen}
        agencyId={agencyUserId}
        employer={stampEmployer}
        onClose={() => setStampOpen(false)}
        onSaved={(emp) => {
          setStampEmployer(emp);
          setStampInfo(employerStampInfo(emp));
        }}
      />

      <InterviewModal
        visible={interviewOpen}
        role="agency"
        userId={candidate.user_id}
        agencyId={agencyUserId}
        fontsReady={fontsReady}
        candidateLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
        autoJoin={!!openIvJoin}
        onClose={() => { setInterviewOpen(false); refreshIv(); }}
      />

      <TranscriptModal
        visible={transcriptOpen}
        candidateUserId={candidate.user_id}
        candidateLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
        onClose={() => setTranscriptOpen(false)}
      />

      <ProcessChatFab
        visible={PROCESS_CHAT_ENABLED && chatOn && !chatOpen}
        onPress={() => setChatOpen(true)}
      />
      <ProcessChatSheet
        visible={chatOpen}
        onClose={() => {
          setChatOpen(false);
          if (chatReturnHome.current) {
            chatReturnHome.current = false;
            onBack?.();
          }
        }}
        candidateId={candidate.user_id}
        peerLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
      />
      <AgencyNoticeSheet
        visible={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={[candidate.user_id]}
        peerLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
      />

      <FlightTicketSheet
        visible={!!flightSheet}
        mode={flightSheet === 'edit' ? 'edit' : 'upload'}
        initialStart={workStartAt}
        initialFlight={flightDepartOn || workStartAt}
        initialEnd={plannedEndOn}
        initialArrive={arriveAt}
        preferredStartDate={cvData?.preferredStartDate}
        busy={flightSheetBusy}
        onClose={() => !flightSheetBusy && setFlightSheet(null)}
        onConfirm={onFlightSheetConfirm}
      />
    </View>
  );
}

const INK = '#1b2533';
const GOLD = '#c2a25a';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fffdf9', borderBottomWidth: 0.5, borderBottomColor: '#ece7db' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  titleBox: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  titleCode: { fontSize: 12.5, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1, marginTop: 1 },
  offerBtn: { backgroundColor: GOLD, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  dim: { opacity: 0.6 },
  offerText: { color: INK, fontWeight: '800', fontSize: 14 },
  sentBadge: { backgroundColor: '#e6f4ec', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  sentText: { color: '#1f8a4c', fontWeight: '800', fontSize: 12.5 },
  withdrawBtn: { backgroundColor: '#fbeaea', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8b5b0' },
  withdrawText: { color: '#a32d2d', fontWeight: '800', fontSize: 13 },
  noticeBtn: {
    marginHorizontal: 14, marginBottom: 10, backgroundColor: '#142033',
    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
  },
  noticeBtnText: { color: '#f5ecda', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  offerBanner: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#e7ecf3', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  opsSignals: { marginHorizontal: 14, marginBottom: 10, gap: 6 },
  opsSignal: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#f4f1ea' },
  opsSignalOk: { backgroundColor: '#e6f4ec' },
  opsSignalWarn: { backgroundColor: '#fbf0db' },
  opsSignalHot: { backgroundColor: '#fde8e6' },
  opsSignalMuted: { backgroundColor: '#eef0f3' },
  opsSignalText: { fontSize: 12.5, fontWeight: '700', color: '#142033', lineHeight: 17 },
  opsSignalClock: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#8f7130', letterSpacing: 0.2 },
  opsSignalClockHot: { color: '#b42318' },
  opsSignalSub: { marginTop: 2, fontSize: 11.5, fontWeight: '600', color: '#6e7684' },
  hireConfirmBox: {
    marginHorizontal: 14, marginBottom: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#fbf0db', borderWidth: 1, borderColor: 'rgba(184,149,74,0.35)',
  },
  hireConfirmTitle: { fontSize: 15, fontWeight: '800', color: '#142033' },
  hireConfirmLead: { marginTop: 6, marginBottom: 12, fontSize: 13, fontWeight: '600', color: '#6e7684', lineHeight: 18 },
  hireConfirmYes: { backgroundColor: '#1f7a4d', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  hireConfirmYesText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hireConfirmNo: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd6c8' },
  hireConfirmNoText: { color: '#142033', fontWeight: '700', fontSize: 14 },
  offerBannerText: { color: '#1f3a63', fontWeight: '800', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  empBanner: { alignItems: 'stretch' },
  empBannerBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  empBannerBtn: {
    flex: 1, minHeight: 44, backgroundColor: '#1b2533', borderRadius: 11,
    paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
  },
  empBannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  empBannerBtnGhost: {
    flex: 1, minHeight: 44, backgroundColor: '#fff', borderRadius: 11,
    paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#c5ced9',
  },
  empBannerBtnGhostText: { color: '#1f3a63', fontWeight: '800', fontSize: 14, textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: '#ebe4d5' },
  tabOn: { backgroundColor: '#16202e', shadowColor: '#0c1320', shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '800', color: '#737373' },
  tabTextOn: { color: '#fff' },

  body: { flex: 1 },
  cvScrollContent: { flexGrow: 1 },
  cvPadH: { marginHorizontal: 16 },
  strip: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  stripContent: { padding: 12, gap: 10 },
  thumbBox: { width: 96 },
  thumbWrap: { width: 96, height: 124, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e9ebee' },
  thumb: { width: '100%', height: '100%' },
  thumbCap: { fontSize: 11, color: '#737373', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  thumbVideoLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  thumbVideoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  thumbVideoBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbVideoPlay: { color: '#fff', fontSize: 15, marginLeft: 2 },
  cv: { width: '100%' },
  interviewBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  interviewBarCol: { gap: 8, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  interviewBtn: { backgroundColor: '#243042', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  interviewBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  ivSchedBar: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  ivSchedInfo: { flex: 1, backgroundColor: '#1b2533', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  ivSchedTitle: { color: GOLD, fontWeight: '800', fontSize: 12, letterSpacing: 0.4, marginBottom: 4 },
  ivSchedSlot: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  ivCountdown: { color: '#dcc187', fontWeight: '700', fontSize: 12.5, marginTop: 6 },
  ivCountdownMuted: { color: '#9aa4b1', fontWeight: '600', fontSize: 11.5, marginTop: 6 },
  ivJoinBtn: { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 14, minWidth: 110, alignItems: 'center', justifyContent: 'center' },
  ivJoinBtnText: { color: INK, fontWeight: '900', fontSize: 13 },
  ivDetailBtn: { width: 42, borderRadius: 12, backgroundColor: '#e7eaef', alignItems: 'center', justifyContent: 'center' },
  ivDetailBtnText: { color: INK, fontSize: 22, fontWeight: '800' },
  ivProposedBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff8e8', borderWidth: 1, borderColor: '#e8d7a8', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14 },
  ivProposedText: { flex: 1, color: '#9a6b16', fontWeight: '800', fontSize: 13.5 },
  ivProposedChev: { color: '#9a6b16', fontSize: 20, fontWeight: '800', marginLeft: 8 },
  transcriptBtn: { backgroundColor: '#eef0f2', borderWidth: 1, borderColor: '#d3d8df', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  transcriptBtnText: { color: INK, fontWeight: '800', fontSize: 13.5 },
  subLocked: { gap: 6 },
  subLabelFull: { flex: 1, flexShrink: 0 },
  lockedHintBlock: { color: '#9aa1ac', fontWeight: '700', fontSize: 12, lineHeight: 17, paddingLeft: 22 },
  contractHelp: { color: '#5a6575', fontWeight: '600', fontSize: 12.5, lineHeight: 17, flexBasis: '100%', marginBottom: 2 },
  contractEmpName: { color: INK, fontWeight: '800', fontSize: 13.5, lineHeight: 18, flexBasis: '100%', marginBottom: 2 },
  prefDateHint: {
    color: '#2a5560', fontWeight: '800', fontSize: 12.5, lineHeight: 18, marginTop: 6,
    backgroundColor: '#eef4f6', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginLeft: 22,
  },
  pickupLock: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eadfc2', borderRadius: 16, padding: 16, marginTop: 14, opacity: 0.95 },
  pickupLockTitle: { fontSize: 16, fontWeight: '800', color: '#1b2533' },
  pickupLockText: { fontSize: 13, color: '#9a6b16', marginTop: 8, lineHeight: 19, fontWeight: '600' },
  certCongrats: { fontSize: 13.5, color: '#6a5418', marginTop: 8, marginBottom: 6, lineHeight: 20, fontWeight: '700' },
  trBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f3ecdc', borderWidth: 1, borderColor: '#eadfc2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  trBadge: { fontSize: 12.5, fontWeight: '800', color: '#9a7b1f', flexShrink: 1 },
  trToggle: { fontSize: 12.5, fontWeight: '800', color: '#1b2533', textDecorationLine: 'underline' },
  cvToolbar: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'nowrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  cvEditBtn: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe2e7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 9,
  },
  cvEditBtnOn: { borderColor: '#c2a25a', backgroundColor: '#f6efdd' },
  cvEditBtnText: { fontSize: 12, fontWeight: '800', color: '#1b2533', textAlign: 'center' },
  cvEditBtnTextOn: { color: '#8a6a1f' },

  docsContent: { padding: 16 },

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
  progressLabel: { fontSize: 12, fontWeight: '800', color: '#9a7b1f', flexShrink: 0, marginLeft: 6 },
  progressDone: { color: '#1f8a4c' },
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
  deadlineExtraDone: { marginTop: 10, color: '#9a7b1f', fontSize: 13, fontWeight: '800', textAlign: 'center' },

  legend: { gap: 8, marginBottom: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#e6e8ec', padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 12.5, color: '#737373', fontWeight: '600', flexShrink: 1 },

  stepCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee8dc', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardActive: { borderColor: '#c2a25a', backgroundColor: '#fffdf6' },
  cardWait: { borderColor: '#c5dbe2', backgroundColor: '#f4fafb' },
  cardDone: { backgroundColor: '#f7faf8', borderColor: '#dce8e0' },
  cardLocked: { backgroundColor: '#f7f7f8', borderColor: '#ececec' },

  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  stepTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1b2533', lineHeight: 19 },
  stepTitleMuted: { color: '#9aa1ac' },
  stepNo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  circleYou: { backgroundColor: '#c2a25a' },
  circleOther: { backgroundColor: '#2a9db8' },
  circleWait: { backgroundColor: '#2a9db8' },
  circleDone: { backgroundColor: '#1f8a4c' },
  circleLocked: { backgroundColor: '#cfd3da' },
  doneLabel: { fontSize: 12.5, fontWeight: '800', color: '#6f8a78', letterSpacing: 0.3 },

  ownerChip: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  ownerYou: { backgroundColor: '#f6efdd' },
  ownerOther: { backgroundColor: '#e4f1f5' },
  ownerMuted: { backgroundColor: '#eceef1' },
  ownerChipText: { fontSize: 11, fontWeight: '800' },
  ownerYouText: { color: '#9a7b1f' },
  ownerOtherText: { color: '#1f7d96' },
  ownerMutedText: { color: '#9aa1ac' },

  subRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#f0f1f3' },
  subMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subBullet: { fontSize: 15, color: '#c9ccd2', fontWeight: '800', width: 14, textAlign: 'center' },
  subBulletDone: { color: '#1f8a4c' },
  subLabel: { fontSize: 14.5, fontWeight: '700', color: INK, flexShrink: 1 },
  subLabelMuted: { color: '#9aa1ac', fontWeight: '600' },
  linkView: { fontSize: 13, color: '#2a9db8', fontWeight: '700', marginLeft: 10 },
  linkReject: { fontSize: 13, color: '#a32d2d', fontWeight: '700', marginLeft: 10 },
  addBtnSm: {
    backgroundColor: GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: INK, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  lockedIcon: { fontSize: 15, marginLeft: 10 },
  waitBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e4f1f5', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  waitBannerText: { color: '#1f7d96', fontSize: 13, fontWeight: '700' },
  subLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginLeft: 22 },
  viewLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  changeBtn: {
    backgroundColor: '#f6efdd', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, minHeight: 44, flexGrow: 1, flexBasis: '42%',
    alignItems: 'center', justifyContent: 'center',
  },
  changeBtnText: { color: '#9a7b1f', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  removeText: { color: '#a32d2d' },
  draftBadge: { backgroundColor: '#fcf2e2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  draftText: { color: '#9a6b16', fontSize: 10.5, fontWeight: '800' },
  sendBtn: {
    backgroundColor: GOLD, borderRadius: 11, paddingVertical: 12, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 4, minHeight: 48,
    flexBasis: '100%', width: '100%',
  },
  sendBtnText: { color: INK, fontSize: 14, fontWeight: '800', textAlign: 'center' },

  viewerWrap: { flex: 1, backgroundColor: '#111' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, backgroundColor: '#1b2533' },
  viewerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  viewerX: { color: '#fff', fontSize: 20, fontWeight: '700' },
  viewerBody: { flex: 1 },
  viewerFooter: { paddingHorizontal: 18, paddingTop: 12, backgroundColor: '#1b2533' },
  viewerDl: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  viewerDlText: { color: '#1b2533', fontWeight: '800', fontSize: 15.5 },
  viewerLoadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  viewerLoadingText: { color: '#c2a25a', fontWeight: '700', fontSize: 14 },
  viewerImg: { width: '100%', height: '100%' },

  galWrap: { flex: 1, backgroundColor: '#000' },
  viewerZoom: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  galClose: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
