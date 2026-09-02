// screens/AgencyCandidateScreen.js
// Acente — aday detayı. İki sekme:
//  CV: 3 fotoğraf + maskeli CV önizleme (+ Teklif Gönder).
//  Belgeler: adayın yüklediği belgeleri gör/indir + acenta belgesi (sözleşme/bilet) yükle + aşama.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, RefreshControl, Dimensions, Animated, Platform, Keyboard, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { getCandidateStatus, passportDeadline, consulateDeadline, formatDeadlineRemain, agencyGrantDeadlineExtra } from '../lib/candidate';
import { offerCandidate, withdrawCandidate, getCandidateById, getCandidateContractFields, getCandidateCvReveal } from '../lib/roles';
import { translateCvFields, applyCvTranslation, extractCvFields, hasCvFreeText } from '../lib/cvTranslate';
import { agencyDisplayName, candidateCode } from '../lib/candidateCode';
import { documentDownloadName } from '../lib/documentFileName';
import { listDocuments, uploadDocument, getSignedUrl, removeAllDocuments, removeDocument, submitDocuments, requestReupload, retractAgencyDoc, replaceSubmittedDocument } from '../lib/documents';
import { getContract, saveContract, deleteContract } from '../lib/contracts';
import { deleteFlight, getFlight, saveArrival, msUntilArrival, msUntilYmdGate, isYmdDue, msUntilSeasonEnd } from '../lib/flights';
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
import { C } from '../lib/theme';
import RatingBreakdown from '../components/RatingBreakdown';
import { canRateCandidate, getMyRating, listRatingStats } from '../lib/ratings';
import { listFavoriteSlots, toggleFavorite, removeFavorite, hasFavoriteSlot } from '../lib/favorites';
import FavoriteEmployerSheet from '../components/FavoriteEmployerSheet';
import { formatLastSeen, lastSeenTier } from '../lib/lastSeenFormat';

// Tanzim/teklif tarihi: bugünün "gg/aa/yyyy" hali
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

const PROF_BG = C.bg;
const PROF_CARD = C.card;
const PROF_GOLD = C.goldText;
const PROF_GOLD_D = C.goldDeep;
const PROF_BORDER = C.hair;
const PROF_TEXT = C.ink;
const PROF_TEXT_SEC = C.ink2;
const PROF_CARD_OUTER = 16;
const PROF_CARD_INNER = 14;
const DOCS_LIGHT_BG = C.bg;
const PIPE_STEP_ICON = {
  1: '🛂', 2: '📝', 3: '🏛️', 4: '🛂', 5: '✈️', 6: '🚐', 7: '💼', 8: '💬', 9: '🏆',
};

function docsStepVis(done, active) {
  if (done) return 'done';
  if (active) return 'pending';
  return 'soon';
}

const NATION_FLAG = {
  'Türkiye': require('../assets/flags/tr.png'),
  'Kazakistan': require('../assets/flags/kk.png'),
  'Kırgızistan': require('../assets/flags/ky.png'),
  'Özbekistan': require('../assets/flags/uz.png'),
  'Rusya': require('../assets/flags/ru.png'),
  'Tayland': require('../assets/flags/th.png'),
  'Türkmenistan': require('../assets/flags/tk.png'),
};

function estimateExpYears(data) {
  const items = data?.experience;
  if (!Array.isArray(items) || !items.length) return null;
  const now = new Date();
  let months = 0;
  items.forEach((it) => {
    const raw = String(it?.date || '').trim();
    if (!raw) return;
    const [a, b] = raw.split(/\s*[-–]\s*/);
    const parse = (s) => {
      if (!s || /devam|present|ongoing|продолжа|қазір|жалғас/i.test(s)) {
        return { y: now.getFullYear(), m: now.getMonth() + 1 };
      }
      const p = s.trim().match(/(\d{1,2})\.?(\d{4})/);
      if (!p) {
        const y = s.match(/(\d{4})/);
        return y ? { y: +y[1], m: 1 } : null;
      }
      return { m: +p[1], y: +p[2] };
    };
    const s = parse(a);
    const e = parse(b);
    if (!s || !e) return;
    months += Math.max(0, (e.y - s.y) * 12 + (e.m - s.m));
  });
  if (!months) return items.length;
  return Math.max(1, Math.round(months / 12));
}

async function readableJpeg(uri) {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return out.base64;
}

export default function AgencyCandidateScreen({ candidate, agencyUserId, accepted, offered: offeredProp, hired: hiredProp, inTransit: inTransitProp, openIvJoin, openInterview, openQuickOffer, openChat, openWorkStart, openHireConfirm, openRate, onBack, onAccepted, fontsReady }) {
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
  const [cvFullOpen, setCvFullOpen] = useState(false);
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
  const quickOfferHandled = useRef(false);
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
  const [favSlots, setFavSlots] = useState([]);
  const [favPickOpen, setFavPickOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(candidate?.last_seen_at || null);
  const [deadline, setDeadline] = useState(null);
  const [consulateDl, setConsulateDl] = useState(null);
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
  const showContractSignal = contract && !has('contract_signed');
  const boardingNeedsAction = boardingStatus && ['pending', 'no_response', 'missed'].includes(boardingStatus);
  const turnAct = activeStep(has);
  const turnDef = PIPELINE.find((s) => s.step === turnAct);
  const turnMine = turnAct > 5
    ? false
    : !!(turnDef && stepActor(turnDef, has) === 'agency');
  const turnStepKey = turnDef?.titleKey
    || (turnAct > 5 && !has('flight_ticket') ? 'pipe_step_6' : null);
  const remainMs = deadline?.end ? deadline.end.getTime() - nowTick : 0;
  const consulateRemainMs = consulateDl?.end ? consulateDl.end.getTime() - nowTick : 0;
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

  const handleTopBack = useCallback(() => {
    if (activeTab === 'docs') {
      setTab('cv');
      return;
    }
    onBack?.();
  }, [activeTab, onBack]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeTab === 'docs') {
        setTab('cv');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeTab]);

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
    const consOpen = docsReady && consulateDl?.end && !has('consulate_ref');
    const showDlBanner = !!(deadline?.end && isAccepted && !isHired && !isTransit);
    const needTick = (iv?.status === 'scheduled' && !!iv?.selectedSlot)
      || (activeTab === 'docs' && (pkgOpen || consOpen))
      || showDlBanner
      || (isTransit && (arriveCountdownLeft > 0 || workStartCountdownLeft > 0))
      || !!arriveAt;
    if (!needTick) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iv?.status, iv?.selectedSlot, activeTab, docsReady, deadline?.end, consulateDl?.end, docs, isAccepted, isHired, isTransit, arriveAt, workStartAt, arriveCountdownLeft, workStartCountdownLeft]);

  // Listeden "Katıl" ile gelindiyse mülakat modalını (ve uygunsa görüşmeyi) aç.
  useEffect(() => {
    if (openIvJoin || openInterview) setInterviewOpen(true);
  }, [openIvJoin, openInterview]);

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
    setConsulateDl(consulateDeadline(st));
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
  // Sözleşme ödemesi sonrası iletişim/pasaport/aile açılır (get_candidate_cv_reveal).
  const [data, setData] = useState(() => normalizePoolCvData(candidate));
  const cvUnlocked = !!contract?.isPaid;
  useEffect(() => {
    let alive = true;
    (async () => {
      const [fresh, priv, reveal] = await Promise.all([
        getCandidateById(candidate?.user_id),
        getCandidateContractFields(candidate?.user_id),
        cvUnlocked ? getCandidateCvReveal(candidate?.user_id) : Promise.resolve(null),
      ]);
      if (!alive) return;
      const base = normalizePoolCvData(fresh || candidate);
      const merged = {
        ...base,
        ...(priv || {}),
        ...(reveal || {}),
      };
      if (!String(merged.title || '').trim()) {
        merged.title = fresh?.title || candidate?.title || '';
      }
      setData(merged);
      setLastSeenAt(fresh?.last_seen_at || candidate?.last_seen_at || null);
    })();
    return () => { alive = false; };
  }, [candidate?.user_id, cvUnlocked]);
  const code = candidateCode(data.nationality, candidate?.reg_no);
  const displayName = agencyDisplayName(data, cvUnlocked);

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
  const cvPreviewKey = `${lang}|${cvData.title || ''}|${cvUnlocked ? 'open' : 'mask'}|${JSON.stringify(cvOverrides)}`;

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

  // Favori: hangi işletme+departman slotlarında
  useEffect(() => {
    let alive = true;
    const uid = candidate?.user_id;
    if (!agencyUserId || !uid) {
      setIsFav(false);
      setFavSlots([]);
      return undefined;
    }
    setIsFav(false);
    setFavSlots([]);
    listFavoriteSlots(agencyUserId, uid).then((slots) => {
      if (!alive) return;
      setFavSlots(slots);
      setIsFav(slots.length > 0);
    });
    return () => { alive = false; };
  }, [agencyUserId, candidate?.user_id]);

  const onToggleFav = () => {
    if (!agencyUserId || !candidate?.user_id || favBusy) return;
    if (isFav) {
      setFavBusy(true);
      removeFavorite(agencyUserId, candidate.user_id)
        .then(() => {
          setFavSlots([]);
          setIsFav(false);
        })
        .catch((e) => Alert.alert(t('fav_btn'), e?.message || t('doc_upload_error')))
        .finally(() => setFavBusy(false));
      return;
    }
    setFavPickOpen(true);
  };

  const onFavPick = async ({ employer, department }) => {
    if (!agencyUserId || !candidate?.user_id || !employer?.id || !department || favBusy) return;
    setFavBusy(true);
    try {
      const nowOn = await toggleFavorite(agencyUserId, employer.id, department, candidate.user_id);
      const next = nowOn ? [{ employerId: employer.id, department }] : [];
      setFavSlots(next);
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
    { uri: data.photo, cap: t('photo_cap_id') },
    { uri: data.photoClose, cap: t('photo_cap_close') },
    { uri: data.photoFull, cap: t('photo_cap_full') },
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
  const acceptOffer = async () => {
    const ok = await hasFavoriteSlot(agencyUserId, candidate.user_id);
    if (!ok) {
      Alert.alert(t('offer_fav_required_title'), t('offer_fav_required_body'), [
        { text: t('consent_cancel'), style: 'cancel' },
        { text: t('fav_title_add'), onPress: () => setFavPickOpen(true) },
      ]);
      return;
    }
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
            const msg = (e?.message || '').includes('favorite_required')
              ? t('offer_fav_required_body')
              : (e?.message || '').includes('employer_incomplete')
                ? (t('employer_need_details') || 'Otel bilgilerini tamamlayın.')
              : (e?.message || 'error');
            Alert.alert(t('agency_offer'), msg);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!openQuickOffer || quickOfferHandled.current || offered || isAccepted || !candidate?.user_id) return;
    quickOfferHandled.current = true;
    acceptOffer();
  }, [openQuickOffer, candidate?.user_id, offered, isAccepted]);

  const openEmployerPicker = () => setEmployerPickerVisible(true);

  const onEmployerPicked = async (employer) => {
    const reason = employerContractBlockReason(employer);
    if (reason || !employerReadyForContract(employer)) {
      const msg = reason === 'tax' ? t('employer_need_tax')
        : reason === 'stamp' ? t('employer_need_stamp')
          : reason === 'details' ? t('employer_need_details')
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
            : reason === 'details' ? t('employer_need_details')
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
              ? t('emp_term_body_ag')
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
            await withdrawCandidate(
              candidate.user_id,
              isAccepted ? 'agency_cancel' : 'offer_withdraw',
            );
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
      const fileName = documentDownloadName({
        code,
        name: displayName,
        label: kind ? (t(`doc_${kind}`) || kind) : t('doc_download'),
        extension: ext,
      });
      const dest = new FS.File(FS.Paths.cache, fileName);
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
        const { readFileBase64 } = await import('../lib/readFileBase64');
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
        if (res.canceled || !res.assets || !res.assets.length) {
          setFlightSheet(null);
          return;
        }
        const a = res.assets[0];
        const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
        if (!isPdf) { Alert.alert(t('doc_flight_ticket'), t('doc_pdf_only')); return; }
        setUploading('flight_ticket');
        const base64 = await readFileBase64(a.uri);
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
            const { readFileBase64 } = await import('../lib/readFileBase64');
            const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true, multiple: false });
            if (res.canceled || !res.assets?.length) return;
            const a = res.assets[0];
            const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
            if (!isPdf) { Alert.alert(t('doc_flight_ticket'), t('doc_pdf_only')); return; }
            setUploading('flight_ticket');
            const base64 = await readFileBase64(a.uri);
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

  const renderTimelineShell = ({
    step, titleKey, hintKey, vis, expanded, canToggle, onToggle, cardStyle, isLast, children,
  }) => {
    const dotStyle = vis === 'done' ? styles.timelineDotDone : vis === 'pending' ? styles.timelineDotActive : styles.timelineDotLocked;
    const pillStyle = vis === 'done' ? styles.stepStatusDone : vis === 'pending' ? styles.stepStatusPending : styles.stepStatusSoon;
    const pillTxtStyle = vis === 'done' ? styles.stepStatusDoneTxt : vis === 'pending' ? styles.stepStatusPendingTxt : styles.stepStatusSoonTxt;
    const statusKey = vis === 'done' ? 'doc_done_label' : vis === 'pending' ? 'docs_status_pending' : 'docs_status_soon';
    return (
      <View style={styles.timelineRow}>
        <View style={styles.timelineRail}>
          <View style={[styles.timelineDot, dotStyle]}>
            <Text style={[
              styles.timelineDotTxt,
              vis === 'done' && styles.timelineDotTxtDone,
              vis === 'soon' && styles.timelineDotTxtMuted,
            ]}>{vis === 'done' ? '✓' : step}</Text>
          </View>
          {!isLast ? <View style={styles.timelineLine} /> : null}
        </View>
        <View style={[styles.stepCard, cardStyle, styles.stepCardInTimeline]}>
          <TouchableOpacity style={styles.stepCardTop} onPress={onToggle} activeOpacity={canToggle ? 0.85 : 1} disabled={!canToggle}>
            <View style={styles.stepIconCircle}>
              <Text style={styles.stepIconTxt}>{PIPE_STEP_ICON[step] || '📄'}</Text>
            </View>
            <View style={styles.stepCardMain}>
              <Text style={[styles.stepTitle, vis === 'soon' && styles.stepTitleMuted]} numberOfLines={2}>{t(titleKey)}</Text>
              {hintKey ? <Text style={styles.stepHint} numberOfLines={2}>{t(hintKey)}</Text> : null}
              <View style={[styles.stepStatusPill, pillStyle]}>
                <Text style={[styles.stepStatusTxt, pillTxtStyle]}>{t(statusKey)}</Text>
              </View>
            </View>
            {canToggle ? <Text style={styles.stepChev}>{expanded ? '▾' : '›'}</Text> : null}
          </TouchableOpacity>
          {children}
        </View>
      </View>
    );
  };

  // Aday belgeler ekranı ile aynı kart dili. Perspektif acente: "mine" = acentenin yükleyeceği adım.
  const StepCard = ({ s, isLast = false }) => {
    const actor = stepActor(s, has);
    const mine = actor === 'agency';
    const act = activeStep(has);
    const pipelineMode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
    const waitingCand = pipelineMode === 'active' && !mine;
    const mode = pipelineMode;
    const doneN = s.kinds.filter(has).length;
    const totalN = s.kinds.length;
    const tabDone = totalN > 0 && doneN === totalN;
    const cardOnlyStyle = (pipelineMode === 'active' && mine)
      ? styles.cardActive
      : waitingCand ? styles.cardWait
        : (tabDone || pipelineMode === 'done') ? styles.cardDone
          : styles.cardLocked;
    const expanded = (pipelineMode === 'locked' && !waitingCand)
      ? false
      : (openStep == null ? (pipelineMode === 'active' || waitingCand) : openStep === s.step);
    const canToggle = pipelineMode !== 'locked' || waitingCand || tabDone || pipelineMode === 'done';
    const visibleKinds = s.kinds.filter((k) => k !== 'contract_signed');
    const showDocLabel = visibleKinds.length > 1;
    const vis = docsStepVis(tabDone || pipelineMode === 'done', pipelineMode === 'active');
    return renderTimelineShell({
      step: s.step,
      titleKey: s.titleKey,
      hintKey: `pipe_step_${s.step}_hint_ag`,
      vis,
      expanded,
      canToggle,
      onToggle: () => {
        if (!canToggle) return;
        setOpenStep((cur) => (cur === s.step ? null : s.step));
      },
      cardStyle: cardOnlyStyle,
      isLast,
      children: (
        <>
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
            {deadline.agencyExtra ? (
              <Text style={styles.deadlineExtraDone}>{t('docs_agency_extra_done', { n: String(DOCS_EXTRA_DAYS) })}</Text>
            ) : null}
            {remainMs <= 0 ? (
              <View style={styles.deadlineActs}>
                {!deadline.agencyExtra ? (
                  <TouchableOpacity
                    style={styles.deadlineGrantBtn}
                    disabled={busy}
                    onPress={() => {
                      Alert.alert(
                        t('docs_agency_extra_btn'),
                        t('docs_agency_extra_confirm', { n: String(DOCS_EXTRA_DAYS) }),
                        [
                          { text: t('consent_cancel'), style: 'cancel' },
                          {
                            text: t('docs_agency_extra_btn'),
                            onPress: async () => {
                              setBusy(true);
                              try {
                                await agencyGrantDeadlineExtra(candidate.user_id, 'docs');
                                const st = await getCandidateStatus(candidate.user_id);
                                setDeadline(passportDeadline(st));
                              } catch (e) {
                                Alert.alert(t('docs_agency_extra_btn'), e?.message || t('docs_extra_fail'));
                              } finally { setBusy(false); }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={styles.deadlineGrantText}>{t('docs_agency_extra_btn')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.deadlineEndBtn}
                  disabled={busy}
                  onPress={() => {
                    Alert.alert(
                      t('process_end'),
                      t('docs_deadline_end_confirm'),
                      [
                        { text: t('consent_cancel'), style: 'cancel' },
                        {
                          text: t('process_end'),
                          style: 'destructive',
                          onPress: async () => {
                            setBusy(true);
                            try {
                              await removeAllDocuments(candidate.user_id);
                              await deleteContract(candidate.user_id);
                              await deleteFlight(candidate.user_id);
                              try { await cancelInterview(candidate.user_id); } catch (_) { /* */ }
                              await withdrawCandidate(candidate.user_id, 'docs_deadline');
                              setDocs({});
                              setContract(null);
                              setIsAccepted(false);
                              setOffered(false);
                              onAccepted?.();
                              onBack?.();
                            } catch (e) {
                              Alert.alert(t('process_end'), e?.message || 'error');
                            } finally { setBusy(false); }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.deadlineEndText}>{t('process_end')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {s.step === 3 && docsReady && consulateDl && !has('consulate_ref') ? (
          <View style={[styles.deadlineBox, consulateRemainMs <= 0 ? styles.deadlineOver : consulateRemainMs <= 2 * 24 * 3600 * 1000 ? styles.deadlineWarn : null]}>
            <Text style={[styles.deadlineClock, consulateRemainMs <= 0 && styles.deadlineClockOver]}>
              {consulateRemainMs <= 0 ? t('deadline_overdue_short') : formatDeadlineRemain(consulateRemainMs, t)}
            </Text>
            <Text style={styles.deadlineText}>
              {consulateRemainMs <= 0 ? t('consulate_pkg_overdue_ag') : t('consulate_countdown_sub_ag')}
            </Text>
            {consulateDl.agencyExtra ? (
              <Text style={styles.deadlineExtraDone}>{t('docs_agency_extra_done', { n: String(DOCS_EXTRA_DAYS) })}</Text>
            ) : null}
            {consulateRemainMs <= 0 ? (
              <View style={styles.deadlineActs}>
                {!consulateDl.agencyExtra ? (
                  <TouchableOpacity
                    style={styles.deadlineGrantBtn}
                    disabled={busy}
                    onPress={() => {
                      Alert.alert(
                        t('docs_agency_extra_btn'),
                        t('docs_agency_extra_confirm', { n: String(DOCS_EXTRA_DAYS) }),
                        [
                          { text: t('consent_cancel'), style: 'cancel' },
                          {
                            text: t('docs_agency_extra_btn'),
                            onPress: async () => {
                              setBusy(true);
                              try {
                                await agencyGrantDeadlineExtra(candidate.user_id, 'consulate');
                                const st = await getCandidateStatus(candidate.user_id);
                                setConsulateDl(consulateDeadline(st));
                              } catch (e) {
                                Alert.alert(t('docs_agency_extra_btn'), e?.message || t('docs_extra_fail'));
                              } finally { setBusy(false); }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Text style={styles.deadlineGrantText}>{t('docs_agency_extra_btn')}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.deadlineEndBtn}
                  disabled={busy}
                  onPress={() => {
                    Alert.alert(
                      t('process_end'),
                      t('consulate_deadline_end_confirm'),
                      [
                        { text: t('consent_cancel'), style: 'cancel' },
                        {
                          text: t('process_end'),
                          style: 'destructive',
                          onPress: async () => {
                            setBusy(true);
                            try {
                              await removeAllDocuments(candidate.user_id);
                              await deleteContract(candidate.user_id);
                              await deleteFlight(candidate.user_id);
                              try { await cancelInterview(candidate.user_id); } catch (_) { /* */ }
                              await withdrawCandidate(candidate.user_id, 'consulate_deadline');
                              setDocs({});
                              setContract(null);
                              setIsAccepted(false);
                              setOffered(false);
                              onAccepted?.();
                              onBack?.();
                            } catch (e) {
                              Alert.alert(t('process_end'), e?.message || 'error');
                            } finally { setBusy(false); }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.deadlineEndText}>{t('process_end')}</Text>
                </TouchableOpacity>
              </View>
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
                      <Text style={styles.subBullet}>⌑</Text>
                      {!showDocLabel ? null : (
                        <Text style={[styles.subLabel, styles.subLabelMuted, styles.subLabelFull]}>{t('doc_contract_unsigned')}</Text>
                      )}
                      <View style={{ flex: 1 }} />
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
                  {showDocLabel ? (
                    <Text style={[styles.subLabel, mode === 'locked' && styles.subLabelMuted]}>{t('doc_contract_unsigned')}</Text>
                  ) : null}
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
              {showDocLabel ? (
                <View style={styles.subTitleRow}>
                  <Text style={[styles.subBullet, (kst === 'done' || draft) && styles.subBulletDone]}>{(kst === 'done' || draft) ? '✓' : '•'}</Text>
                  <Text style={[styles.subLabel, styles.subLabelLine, muteLabel && styles.subLabelMuted]} numberOfLines={2}>
                    {t(`doc_${kind}`)}
                  </Text>
                  {draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                </View>
              ) : null}
              <View style={showDocLabel ? styles.subActionsRow : styles.subMain}>
                {!showDocLabel ? (
                  <Text style={[styles.subBullet, (kst === 'done' || draft) && styles.subBulletDone]}>{(kst === 'done' || draft) ? '✓' : '•'}</Text>
                ) : null}
                {!showDocLabel && draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                {!showDocLabel ? <View style={{ flex: 1 }} /> : null}
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
                  <Text style={styles.lockedIcon}>⌑</Text>
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
                <Text style={styles.lockedHintBlock}>i · {t('doc_pdf_only')}</Text>
              ) : null}
              {(kind === 'work_permit' || kind === 'flight_ticket') && cvData?.preferredStartDate ? (
                <Text style={styles.prefDateHint}>· {t('start_date_agency')}: {cvData.preferredStartDate}</Text>
              ) : null}
              {kind === 'flight_ticket' && workStartAt ? (
                <TouchableOpacity
                  style={styles.dateEditBtn}
                  onPress={() => setFlightSheet(isHired || draft || isUploaded(kind) ? 'edit' : 'upload')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateEditLabel}>{t('work_start_label')}</Text>
                  <View style={styles.dateEditRow}>
                    <Text style={styles.dateEditValue} numberOfLines={2}>
                      {String(workStartAt).slice(0, 10)}
                      {plannedEndOn ? ` → ${String(plannedEndOn).slice(0, 10)}` : ''}
                      {arriveAt ? ` · ${t('flight_arrive_label')}: ${arriveAt}` : ''}
                    </Text>
                    <Text style={styles.dateEditAction}>✎ {t('work_start_edit')}</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {kind === 'flight_ticket' && mine && !workStartAt && (draft || kst === 'active') ? (
                <TouchableOpacity style={[styles.dateEditBtn, styles.dateEditBtnWarn]} onPress={() => setFlightSheet('upload')} activeOpacity={0.85}>
                  <Text style={styles.dateEditLabel}>{t('work_start_label')}</Text>
                  <Text style={styles.dateEditWarn}>! {t('work_start_required')}</Text>
                </TouchableOpacity>
              ) : null}
              {kind === 'flight_ticket' && mine && workStartAt && !arriveAt && (draft || kst === 'active') ? (
                <TouchableOpacity style={[styles.dateEditBtn, styles.dateEditBtnWarn]} onPress={() => setFlightSheet('upload')} activeOpacity={0.85}>
                  <Text style={styles.dateEditLabel}>{t('flight_arrive_label')}</Text>
                  <Text style={styles.dateEditWarn}>{t('flight_arrive_required')}</Text>
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
        </>
      ),
    });
  };

  const heroUri = data.photo || data.photoClose || data.photoFull || null;
  const avatarUri = data.photo || data.photoClose || data.photoFull || null;
  const nationality = data.nationality || candidate?.nationality;
  const flag = NATION_FLAG[nationality];
  const expY = estimateExpYears(cvData);
  const seenTier = lastSeenTier(lastSeenAt);
  const seenOnline = seenTier === 'fresh' || seenTier === 'recent';
  const statusStep = isHired || isTransit ? 4 : isAccepted ? Math.min(Math.max(turnAct || 2, 2), 4) : offered ? 1 : 0;
  const statusLabel = offered
    ? t('offer_sent_note')
    : isTransit
      ? (t('ops_transit_signal') || 'Yolda')
      : isHired
        ? t('staff_active')
        : isAccepted && turnStepKey
          ? t(turnStepKey)
          : isAccepted
            ? t('agency_tab_docs')
            : t('agency_cand_status_pool');
  const showBottomCta = activeTab === 'cv';
  const showIvQuick = (!offered && !isAccepted) || hasInterview || iv?.status === 'proposed' || iv?.status === 'scheduled';
  const ivScheduledLive = iv?.status === 'scheduled' && iv.selectedSlot && !callWindow(iv.selectedSlot, callOpts).ended;
  const ivWin = ivScheduledLive ? callWindow(iv.selectedSlot, callOpts) : null;
  const ivLeft = ivWin ? (ivWin.base || 0) - nowTick : 0;
  const photoGap = 8;
  const bentoInnerW = SCREEN_W - (PROF_CARD_OUTER + PROF_CARD_INNER) * 2;
  const grid2W = Math.floor((bentoInnerW - photoGap) / 2);
  const grid3W = Math.floor((bentoInnerW - photoGap * 2) / 3);
  const photoSingleH = Math.round(bentoInnerW * 0.42);
  const cvBottomPad = insets.bottom + (showBottomCta ? 84 : 20) + (PROCESS_CHAT_ENABLED && chatOn ? 64 : 0);
  const statusProgress = statusStep <= 0 ? 0.08 : statusStep / 4;
  const hasIntroVideo = !!data.introVideo;
  const mediaTiles = [
    ...photos.map((p, i) => ({ kind: 'photo', uri: p.uri, cap: p.cap, index: i })),
    ...(hasIntroVideo ? [{ kind: 'video', cap: t('intro_video_cap') }] : []),
  ];

  const renderIntroVideoPreview = () => (
    introVideoUrl ? (
      <View pointerEvents="none" style={styles.bentoImg}>
        <WebView
          source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#1a2438;overflow:hidden"><video src="${introVideoUrl}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;background:#1a2438"></video></body></html>` }}
          style={styles.bentoImg}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          scrollEnabled={false}
        />
      </View>
    ) : heroUri ? (
      <Image source={{ uri: heroUri }} style={styles.bentoImg} resizeMode="cover" />
    ) : (
      <View style={[styles.bentoImg, styles.thumbVideoLoading]}><ActivityIndicator color={PROF_GOLD} /></View>
    )
  );

  const renderMediaTile = (tile, w, h) => {
    if (tile.kind === 'video') {
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => introVideoUrl && setVideoPlay(true)}
          style={[styles.photoTile, { width: w, height: h }]}
        >
          {renderIntroVideoPreview()}
          <LinearGradient colors={['rgba(10,17,33,0.02)', 'rgba(10,17,33,0.55)']} style={styles.mediaVideoGrad} pointerEvents="none" />
          <View style={styles.mediaVideoOverlay} pointerEvents="none">
            <View style={styles.thumbVideoBadge}><Text style={styles.thumbVideoPlay}>▶</Text></View>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setGalleryIndex(tile.index)} style={[styles.photoTile, { width: w, height: h }]}>
        <Image source={{ uri: tile.uri }} style={styles.bentoImg} resizeMode="cover" />
        <PhotoWatermark size={w >= grid2W ? 22 : 20} margin={6} />
      </TouchableOpacity>
    );
  };

  const renderMediaGrid = () => {
    const n = mediaTiles.length;
    if (n === 1) {
      const tile = mediaTiles[0];
      const h = tile.kind === 'video' ? grid2W : photoSingleH;
      return (
        <View style={[styles.photoCol, { width: bentoInnerW }]}>
          {renderMediaTile(tile, bentoInnerW, h)}
          <Text style={styles.photoCapBelow} numberOfLines={1}>{tile.cap}</Text>
        </View>
      );
    }
    if (n === 2) {
      return (
        <View style={[styles.photoRow, { width: bentoInnerW }]}>
          {mediaTiles.map((tile, i) => (
            <View key={i} style={[styles.photoCol, { width: grid2W }]}>
              {renderMediaTile(tile, grid2W, grid2W)}
              <Text style={styles.photoCapBelow} numberOfLines={1}>{tile.cap}</Text>
            </View>
          ))}
        </View>
      );
    }
    if (n === 3 && !hasIntroVideo) {
      return (
        <View style={[styles.photoRow, { width: bentoInnerW }]}>
          {mediaTiles.map((tile, i) => (
            <View key={i} style={[styles.photoCol, { width: grid3W }]}>
              {renderMediaTile(tile, grid3W, grid3W)}
              <Text style={styles.photoCapBelow} numberOfLines={1}>{tile.cap}</Text>
            </View>
          ))}
        </View>
      );
    }
    if (n === 3) {
      return (
        <View style={styles.mediaGridStack}>
          <View style={[styles.photoRow, { width: bentoInnerW }]}>
            {mediaTiles.slice(0, 2).map((tile, i) => (
              <View key={i} style={[styles.photoCol, { width: grid2W }]}>
                {renderMediaTile(tile, grid2W, grid2W)}
                <Text style={styles.photoCapBelow} numberOfLines={1}>{tile.cap}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.photoRow, styles.mediaGridRowCenter, { width: bentoInnerW }]}>
            <View style={[styles.photoCol, { width: grid2W }]}>
              {renderMediaTile(mediaTiles[2], grid2W, grid2W)}
              <Text style={styles.photoCapBelow} numberOfLines={1}>{mediaTiles[2].cap}</Text>
            </View>
          </View>
        </View>
      );
    }
    const gridTiles = mediaTiles.slice(0, 4);
    return (
      <View style={styles.mediaGridStack}>
        {[0, 2].map((start) => (
          <View key={start} style={[styles.photoRow, { width: bentoInnerW }]}>
            {gridTiles.slice(start, start + 2).map((tile, i) => (
              <View key={start + i} style={[styles.photoCol, { width: grid2W }]}>
                {renderMediaTile(tile, grid2W, grid2W)}
                <Text style={styles.photoCapBelow} numberOfLines={1}>{tile.cap}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBarBack} onPress={handleTopBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.topBarChev}>{backChevron}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{t('agency_cand_title')}</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {activeTab === 'cv' ? (
      <>
      <View style={styles.heroCard}>
        <View style={styles.heroBody}>
          <View style={styles.heroCenter}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderTxt}>👤</Text></View>
              )}
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroName} numberOfLines={2}>{displayName || code}</Text>
              <View style={styles.heroCodeRow}>
                {flag ? <Image source={flag} style={styles.heroFlagIcon} resizeMode="cover" /> : null}
                <Text style={styles.heroCode} numberOfLines={1}>{code}</Text>
                {cvData?.title ? (
                  <>
                    <Text style={styles.heroCodeDivider}>·</Text>
                    <Text style={styles.heroTitle} numberOfLines={1}>{cvData.title}</Text>
                  </>
                ) : null}
              </View>
              <View style={styles.heroMetaRow}>
                {ratingSummary ? <RatingBadge avg={ratingSummary.avg} count={ratingSummary.count} compact onDark /> : null}
                <View style={styles.onlinePill}>
                  <View style={[styles.onlineDot, !seenOnline && styles.onlineDotDim]} />
                  <Text style={styles.onlineTxt} numberOfLines={1}>{formatLastSeen(lastSeenAt, t)}</Text>
                </View>
              </View>
              {expY ? (
                <Text style={styles.heroPosition} numberOfLines={2}>
                  {t('matches_exp_years', { n: expY })}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.heroStatusStrip}>
            <View style={styles.statusProgressTrack}>
              <View style={[styles.statusProgressFill, { width: `${Math.round(statusProgress * 100)}%` }]} />
            </View>
              {statusStep > 0 ? (
                <Animated.Text style={[styles.statusLabel, offered && { opacity: offerBlink }]} numberOfLines={2}>{statusLabel}</Animated.Text>
              ) : null}
          </View>
        </View>
      </View>

      {isAccepted ? (
        <View style={styles.tabs}>
          {['cv', 'docs'].map((tk) => (
            <TouchableOpacity
              key={tk}
              style={[styles.tab, activeTab === tk && styles.tabOn]}
              onPress={() => { setTab(tk); if (tk === 'docs') refreshDocs(); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, activeTab === tk && styles.tabTextOn]} numberOfLines={1}>
                {tk === 'cv' ? t('agency_tab_cv') : t('agency_tab_docs')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {!isAccepted && !offered ? (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, busy && styles.dim]} onPress={acceptOffer} disabled={busy} activeOpacity={0.88}>
            {busy ? <ActivityIndicator color={PROF_GOLD} /> : <Text style={styles.actionBtnPrimaryTxt} numberOfLines={1}>{t('agency_offer_btn')}</Text>}
          </TouchableOpacity>
        ) : null}
        {isAccepted || offered ? (
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger, busy && styles.dim]} onPress={withdrawOffer} disabled={busy} activeOpacity={0.88}>
            {busy ? <ActivityIndicator color="#f08080" /> : (
              <Text style={styles.actionBtnDangerTxt} numberOfLines={1}>
                {isAccepted ? (isHired ? t('staff_end') : t('process_end')) : t('offer_withdraw_short')}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
        {showIvQuick ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setInterviewOpen(true)} activeOpacity={0.88}>
            <Text style={styles.actionBtnTxt} numberOfLines={1}>{t('iv_propose_btn')}</Text>
          </TouchableOpacity>
        ) : null}
        {hasInterview ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setTranscriptOpen(true)} activeOpacity={0.88}>
            <Text style={styles.actionBtnTxt} numberOfLines={1}>📝 {t('transcript_btn')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.actionBtn, isFav && styles.actionBtnOn]} onPress={onToggleFav} disabled={favBusy} activeOpacity={0.88}>
          <Text style={[styles.actionBtnTxt, isFav && styles.actionBtnTxtOn]} numberOfLines={1}>{isFav ? '★' : '☆'} {t('fav_btn')}</Text>
        </TouchableOpacity>
        {(offered || isAccepted || isHired || isTransit) ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => setNoticeOpen(true)} activeOpacity={0.88}>
            <Text style={styles.actionBtnTxt} numberOfLines={1}>📢 {t('agency_notice')}</Text>
          </TouchableOpacity>
        ) : null}
        {canRate ? (
          <TouchableOpacity style={[styles.actionBtn, hasMyRating && styles.actionBtnOn]} onPress={() => setRateOpen(true)} activeOpacity={0.88}>
            <Text style={[styles.actionBtnTxt, hasMyRating && styles.actionBtnTxtOn]} numberOfLines={1}>★ {hasMyRating ? t('rate_btn_edit') : t('rate_btn')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {ivScheduledLive ? (
        <TouchableOpacity style={styles.ivSchedCard} onPress={() => setInterviewOpen(true)} activeOpacity={0.88}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ivSchedCardTitle}>✓ {t('iv_scheduled')}</Text>
            <Text style={styles.ivSchedCardSlot} numberOfLines={1}>
              {weekdayOf(iv.selectedSlot, lang)} · {slotDateKey(iv.selectedSlot)} · 🕒 {slotTime(iv.selectedSlot)}
            </Text>
            {ivLeft > 0 ? <Text style={styles.ivSchedCardCd}>⏱ {t('iv_countdown')}: {formatCountdown(ivLeft)}</Text> : null}
          </View>
          {ivWin?.joinable ? (
            <View style={styles.ivJoinPill}><Text style={styles.ivJoinPillTxt}>🎥 {t('call_join')}</Text></View>
          ) : (
            <Text style={styles.ivSchedChev}>›</Text>
          )}
        </TouchableOpacity>
      ) : null}
      {(!offered && !isAccepted) && iv?.status === 'proposed' ? (
        <TouchableOpacity style={styles.ivProposedCard} onPress={() => setInterviewOpen(true)} activeOpacity={0.88}>
          <Text style={styles.ivProposedCardTxt} numberOfLines={2}>⏳ {t('iv_proposed_status')}</Text>
          <Text style={styles.ivSchedChev}>›</Text>
        </TouchableOpacity>
      ) : null}

      {(isAccepted || isHired || isTransit) && (isTransit || showContractSignal || boardingNeedsAction || (deadline?.end && isAccepted && !isHired && !isTransit)) ? (
        <View style={styles.opsSignals}>
          {isTransit ? (
            <View style={[styles.opsSignal, styles.opsSignalWarn]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                {workStartDue
                  ? (t('ops_start_confirm_hint') || 'İşe başlama onayı bekleniyor')
                  : `${t('ops_transit_signal') || 'Yolda'}${workStartAt ? ` · ${String(workStartAt).slice(0, 10)}` : ''}`}
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
          {showContractSignal ? (
            <View style={[styles.opsSignal, contract.isPaid ? styles.opsSignalOk : styles.opsSignalWarn]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                {contract.isPaid
                  ? (chatOn ? t('web_contract_open_chat') : t('doc_candidate_turn'))
                  : (chatOn ? t('web_contract_open_chat') : t('web_contract_pay_wait'))}
              </Text>
            </View>
          ) : null}
          {boardingNeedsAction ? (
            <View style={[
              styles.opsSignal,
              boardingStatus === 'missed' ? styles.opsSignalHot : styles.opsSignalWarn,
            ]}>
              <Text style={styles.opsSignalText} numberOfLines={2}>
                {t('boarding_flight_prefix')}: {{
                  pending: t('boarding_short_pending'),
                  no_response: t('boarding_short_no_response'),
                  missed: t('boarding_short_missed'),
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
          <Text style={styles.offerBannerText}>{t('emp_term_body_ag')}</Text>
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

      </>
      ) : null}

      {activeTab === 'cv' ? (
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.cvScrollContent, { paddingBottom: cvBottomPad }]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PROF_GOLD} colors={[PROF_GOLD]} />}
      >
          {mediaTiles.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('agency_cand_photos')}</Text>
              {renderMediaGrid()}
            </View>
          ) : null}
          {ratingSummary ? <RatingBreakdown stats={ratingSummary} /> : null}
        </ScrollView>
      ) : (
        <View style={styles.docsFullShell}>
        <ScrollView
          ref={docsScrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.docsContent, {
            paddingBottom: insets.bottom + (PROCESS_CHAT_ENABLED && chatOn ? 88 : 24) + (kbH > 0 ? kbH + 16 : 0),
          }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2a25a" colors={['#c2a25a']} />}
        >
          <View style={styles.docsHeader}>
            <Text style={styles.docsHeaderTitle}>{t('docs_process_title_ag')}</Text>
            <Text style={styles.docsHeaderSub}>{t('docs_process_sub_ag')}</Text>
          </View>

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
            const vis = docsStepVis(false, pickupOpen);
            return renderTimelineShell({
              step: 6,
              titleKey: 'pipe_step_6',
              hintKey: 'pipe_step_6_hint_ag',
              vis,
              expanded: pickupOpen,
              canToggle: pickupOpen,
              onToggle: () => pickupOpen && setOpenStep((cur) => (cur === 6 ? null : 6)),
              cardStyle: pickupOpen ? styles.cardActive : styles.cardLocked,
              isLast: false,
              children: pickupOpen ? (
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
                <Text style={styles.pickupLockText}>⌑ {t('pickup_lock_agency')}</Text>
              ),
            });
          })()}

          {/* 7) İşe başlama — belge yok; tarihe kadar pasif, sonra sezon geri sayımı */}
          {(() => {
            const startYmd = workStartAt ? String(workStartAt).slice(0, 10) : null;
            const startReached = !startYmd || isYmdDue(startYmd, nowTick);
            const step7Done = episode?.outcome === 'completed' || episode?.outcome === 'early_exit' || has('success_certificate');
            const step7Live = isHired && startReached && !step7Done;
            const step7Wait = isHired && !startReached;
            const open = step7Done || step7Live || step7Wait;
            const startLeft = step7Wait ? msUntilYmdGate(startYmd, nowTick) : 0;
            const seasonLeft = step7Live ? msUntilSeasonEnd(plannedEndOn, nowTick) : 0;
            const vis = docsStepVis(step7Done, step7Live || step7Wait);
            return renderTimelineShell({
              step: 7,
              titleKey: 'pipe_step_7',
              hintKey: 'pipe_step_7_hint_ag',
              vis,
              expanded: open,
              canToggle: open,
              onToggle: () => open && setOpenStep((cur) => (cur === 7 ? null : 7)),
              cardStyle: step7Done ? styles.cardDone : step7Live ? styles.cardActive : styles.cardLocked,
              isLast: false,
              children: (
                <>
                  {(workStartAt || plannedEndOn) && (step7Done || step7Live || step7Wait) ? (
                    <View style={{ marginBottom: 4 }}>
                      {workStartAt ? (
                        <Text style={styles.pickupLockText}>
                          {t('work_start_label')}: {String(workStartAt).slice(0, 10).split('-').reverse().join('.')}
                        </Text>
                      ) : null}
                      {plannedEndOn ? (
                        <Text style={styles.pickupLockText}>
                          {t('season_end_label')}: {String(plannedEndOn).slice(0, 10).split('-').reverse().join('.')}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {step7Done ? (
                    <Text style={styles.pickupLockText}>{t('journey_hint_7_done')}</Text>
                  ) : step7Wait ? (
                    <>
                      <Text style={styles.pickupLockText}>{t('journey_hint_7_wait')}</Text>
                      {startLeft > 0 ? (
                        <CountdownBanner
                          variant="muted"
                          titleKey="work_start_countdown_title"
                          subKey="work_start_countdown_sub_ag"
                          leftMs={startLeft}
                        />
                      ) : null}
                    </>
                  ) : step7Live ? (
                    seasonLeft > 0 ? (
                      <CountdownBanner
                        variant="muted"
                        titleKey="season_countdown_title"
                        subKey="season_countdown_sub"
                        leftMs={seasonLeft}
                      />
                    ) : (
                      <Text style={styles.pickupLockText}>{t('season_countdown_sub')}</Text>
                    )
                  ) : (
                    <Text style={styles.pickupLockText}>⌑ {t('journey_hint_7_wait')}</Text>
                  )}
                </>
              ),
            });
          })()}

          <View style={styles.docsInfoBox}>
            <View style={styles.docsInfoIcon}><Text style={styles.docsInfoIconTxt}>i</Text></View>
            <View style={styles.docsInfoBody}>
              <Text style={styles.docsInfoTitle}>{t('docs_info_title')}</Text>
              <Text style={styles.docsInfoText}>{t('docs_info_ag')}</Text>
            </View>
          </View>
        </ScrollView>
        </View>
      )}

      {showBottomCta && activeTab === 'cv' ? (
        <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={styles.bottomCtaBtn} onPress={() => setCvFullOpen(true)} activeOpacity={0.9}>
            <Text style={styles.bottomCtaBtnTxt}>{t('cv_view_btn')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={cvFullOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCvFullOpen(false)}>
        <View style={styles.cvFullShell}>
          <View style={[styles.cvFullHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={styles.cvFullBack}
              onPress={() => setCvFullOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.cvFullBackText}>{backChevron}</Text>
            </TouchableOpacity>
            <Text style={styles.cvFullTitle} numberOfLines={1}>{t('agency_cand_cv_section')}</Text>
            <TouchableOpacity
              style={styles.cvFullEdit}
              onPress={() => setCvEditorOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.cvFullEditText} numberOfLines={1}>{t('cv_edit_btn')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cvFullBody}>
            {cvTr ? (
              <View style={styles.trBar}>
                <Text style={styles.trBadge}>🌐 {showOriginal ? t('cv_show_original') : t('cv_ai_translated')}</Text>
                <TouchableOpacity onPress={() => setShowOriginal((o) => !o)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.trToggle}>{showOriginal ? t('cv_show_translation') : t('cv_show_original')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <CVPreview
              data={cvData}
              masked={!cvUnlocked}
              candidateNo={code}
              contentKey={cvPreviewKey}
              downloadFileName={documentDownloadName({ code, name: displayName, label: t('doc_cv') || 'CV', extension: 'pdf' })}
            />
          </View>
        </View>
      </Modal>

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

      <FavoriteEmployerSheet
        visible={favPickOpen}
        agencyId={agencyUserId}
        purpose="add"
        markedSlots={favSlots}
        onSelect={onFavPick}
        onClose={() => setFavPickOpen(false)}
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
        downloadFileName={documentDownloadName({ code, name: displayName, label: t('doc_contract_unsigned') || 'Sözleşme', extension: 'pdf' })}
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
        employerId={favSlots[0]?.employerId || null}
        fontsReady={fontsReady}
        candidateLabel={[displayName, code].filter(Boolean).join(' · ')}
        autoJoin={!!openIvJoin}
        onClose={() => { setInterviewOpen(false); refreshIv(); }}
      />

      <TranscriptModal
        visible={transcriptOpen}
        candidateUserId={candidate.user_id}
        candidateLabel={[displayName, code].filter(Boolean).join(' · ')}
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
        peerLabel={[displayName, code].filter(Boolean).join(' · ')}
        peerPhoto={data.photo || data.photoClose || data.photoFull || null}
        peerName={displayName || code}
        peerCode={code}
      />
      <AgencyNoticeSheet
        visible={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={[candidate.user_id]}
        peerLabel={[displayName, code].filter(Boolean).join(' · ')}
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
  wrap: { flex: 1, backgroundColor: PROF_BG },
  dim: { opacity: 0.6 },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 4 },
  topBarBack: { width: 36, alignItems: 'flex-start' },
  topBarChev: { fontSize: 28, color: PROF_GOLD, fontWeight: '700', marginTop: -3 },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: PROF_TEXT },
  topBarSpacer: { width: 36 },
  topBarTabs: { flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  topBarTab: {
    flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  topBarTabOn: { backgroundColor: PROF_GOLD, borderColor: PROF_GOLD },
  topBarTabText: { fontSize: 13, fontWeight: '700', color: PROF_TEXT_SEC },
  topBarTabTextOn: { color: '#1a2030' },

  heroCard: { marginHorizontal: PROF_CARD_OUTER, marginBottom: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1b2533', borderWidth: 1, borderColor: '#1b2533' },
  heroBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, alignItems: 'stretch' },
  heroCenter: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  heroIdentity: { flex: 1, minWidth: 0, marginLeft: 12 },
  avatarRing: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: PROF_GOLD,
    backgroundColor: '#1a2438', overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24304a' },
  avatarPlaceholderTxt: { fontSize: 20 },
  heroName: { fontSize: 19, fontWeight: '800', color: '#fff', lineHeight: 23, textAlign: 'left' },
  heroCode: { fontSize: 11.5, fontWeight: '600', color: '#b8c0cb', letterSpacing: 0.2, textAlign: 'left' },
  heroCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0, marginTop: 3 },
  heroFlagIcon: { width: 26, height: 17, borderRadius: 3, marginRight: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  heroCodeDivider: { marginHorizontal: 6, color: '#788391', fontSize: 13, fontWeight: '700' },
  heroTitle: { flexShrink: 1, color: '#d8bd78', fontSize: 11.5, fontWeight: '700' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  onlineDotDim: { backgroundColor: '#6b7380' },
  onlineTxt: { fontSize: 11, fontWeight: '600', color: '#d0d5dc', flexShrink: 1 },
  heroPosition: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: '#d8bd78', lineHeight: 15, textAlign: 'left', paddingHorizontal: 0 },
  heroStatusStrip: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)', width: '100%' },
  statusProgressTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden', marginBottom: 5 },
  statusProgressFill: { height: '100%', borderRadius: 2, backgroundColor: PROF_GOLD },

  statusCard: {
    marginHorizontal: 14, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: PROF_CARD, borderRadius: 14, borderWidth: 1, borderColor: PROF_BORDER,
  },
  pipeDots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  pipeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E8E2D8' },
  pipeDotOn: { backgroundColor: '#D8CDBB' },
  pipeDotActive: { backgroundColor: PROF_GOLD, width: 16, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '600', color: '#d0d5dc', lineHeight: 16, textAlign: 'center' },

  actionRow: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 14, gap: 6, paddingBottom: 8 },
  actionBtn: {
    flex: 1, minWidth: 0, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: PROF_BORDER, borderRadius: 10,
    paddingHorizontal: 4, paddingVertical: 9, minHeight: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtnOn: { borderColor: PROF_GOLD, backgroundColor: 'rgba(168,148,104,0.12)' },
  actionBtnPrimary: { borderColor: PROF_GOLD, backgroundColor: 'rgba(168,148,104,0.14)' },
  actionBtnPrimaryTxt: { color: PROF_GOLD, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  actionBtnDanger: { borderColor: 'rgba(240,128,128,0.4)', backgroundColor: 'rgba(180,35,24,0.1)' },
  actionBtnDangerTxt: { color: '#f08080', fontWeight: '700', fontSize: 11.5, textAlign: 'center' },
  actionBtnTxt: { color: PROF_TEXT, fontWeight: '600', fontSize: 11.5, textAlign: 'center' },
  actionBtnTxtOn: { color: PROF_GOLD },

  ivSchedCard: {
    marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14,
    backgroundColor: PROF_CARD, borderWidth: 1, borderColor: PROF_BORDER, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  ivSchedCardTitle: { color: PROF_GOLD, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  ivSchedCardSlot: { color: PROF_TEXT, fontWeight: '800', fontSize: 13.5 },
  ivSchedCardCd: { color: PROF_GOLD_D, fontWeight: '700', fontSize: 12, marginTop: 6 },
  ivJoinPill: { backgroundColor: PROF_GOLD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  ivJoinPillTxt: { color: '#1a2030', fontWeight: '900', fontSize: 12.5 },
  ivSchedChev: { color: PROF_GOLD, fontSize: 22, fontWeight: '800' },
  ivProposedCard: {
    marginHorizontal: 14, marginBottom: 10, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(200,184,142,0.1)', borderWidth: 1, borderColor: PROF_BORDER,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  ivProposedCardTxt: { flex: 1, color: PROF_GOLD, fontWeight: '800', fontSize: 13 },

  offerBanner: { marginHorizontal: 14, marginBottom: 10, backgroundColor: 'rgba(200,184,142,0.12)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', borderWidth: 1, borderColor: PROF_BORDER },
  opsSignals: { marginHorizontal: 14, marginBottom: 10, gap: 6 },
  opsSignal: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: PROF_CARD, borderWidth: 1, borderColor: PROF_BORDER },
  opsSignalOk: { backgroundColor: 'rgba(31,138,76,0.14)', borderColor: 'rgba(31,138,76,0.35)' },
  opsSignalWarn: { backgroundColor: 'rgba(200,184,142,0.12)', borderColor: PROF_BORDER },
  opsSignalHot: { backgroundColor: 'rgba(180,35,24,0.12)', borderColor: 'rgba(240,128,128,0.35)' },
  opsSignalMuted: { backgroundColor: 'rgba(255,255,255,0.04)' },
  opsSignalText: { fontSize: 12.5, fontWeight: '700', color: PROF_TEXT, lineHeight: 17 },
  opsSignalClock: { marginTop: 4, fontSize: 14, fontWeight: '800', color: PROF_GOLD, letterSpacing: 0.2 },
  opsSignalClockHot: { color: '#f08080' },
  opsSignalSub: { marginTop: 2, fontSize: 11.5, fontWeight: '600', color: PROF_TEXT_SEC },
  hireConfirmBox: {
    marginHorizontal: 14, marginBottom: 12, padding: 14, borderRadius: 14,
    backgroundColor: PROF_CARD, borderWidth: 1, borderColor: PROF_BORDER,
  },
  hireConfirmTitle: { fontSize: 15, fontWeight: '800', color: PROF_TEXT },
  hireConfirmLead: { marginTop: 6, marginBottom: 12, fontSize: 13, fontWeight: '600', color: PROF_TEXT_SEC, lineHeight: 18 },
  hireConfirmYes: { backgroundColor: '#1f7a4d', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  hireConfirmYesText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  hireConfirmNo: { backgroundColor: '#FBF9F4', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: PROF_BORDER },
  hireConfirmNoText: { color: PROF_TEXT, fontWeight: '700', fontSize: 14 },
  offerBannerText: { color: PROF_GOLD, fontWeight: '800', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  empBanner: { alignItems: 'stretch' },
  empBannerBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  empBannerBtn: {
    flex: 1, minHeight: 44, backgroundColor: PROF_GOLD, borderRadius: 11,
    paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
  },
  empBannerBtnText: { color: '#1a2030', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  empBannerBtnGhost: {
    flex: 1, minHeight: 44, backgroundColor: '#FBF9F4', borderRadius: 11,
    paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: PROF_BORDER,
  },
  empBannerBtnGhostText: { color: PROF_TEXT, fontWeight: '800', fontSize: 14, textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: 5, marginHorizontal: PROF_CARD_OUTER, marginBottom: 8, padding: 4, borderRadius: 11, backgroundColor: '#ebe6dc' },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', shadowColor: '#1b2533', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  tabText: { fontSize: 14, fontWeight: '800', color: PROF_TEXT_SEC },
  tabTextOn: { color: '#1a2030' },

  body: { flex: 1 },
  cvScrollContent: { flexGrow: 1, paddingTop: 4 },
  docsLightShell: { flex: 1, backgroundColor: DOCS_LIGHT_BG },
  docsFullShell: { flex: 1, backgroundColor: DOCS_LIGHT_BG },
  sectionCard: {
    marginHorizontal: PROF_CARD_OUTER, marginBottom: 8, padding: PROF_CARD_INNER, borderRadius: 14,
    backgroundColor: PROF_CARD, borderWidth: 1, borderColor: PROF_BORDER, overflow: 'hidden',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: PROF_TEXT, marginBottom: 10 },
  sectionTitleHead: { marginBottom: 0 },
  photoRow: { flexDirection: 'row', gap: 8, alignSelf: 'center' },
  photoCol: { alignItems: 'center' },
  photoTile: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#1a2438' },
  photoSingle: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#1a2438', alignSelf: 'center' },
  photoCapBelow: { marginTop: 6, fontSize: 11, fontWeight: '500', color: PROF_TEXT_SEC, textAlign: 'center', width: '100%' },
  mediaGridStack: { gap: 8, alignSelf: 'center' },
  mediaGridRowCenter: { justifyContent: 'center' },
  mediaVideoGrad: { ...StyleSheet.absoluteFillObject },
  mediaVideoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bentoImg: { width: '100%', height: '100%' },
  cvSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  cvMiniBtn: {
    borderWidth: 1, borderColor: PROF_BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', maxWidth: '48%',
  },
  cvMiniBtnOn: { borderColor: PROF_GOLD, backgroundColor: 'rgba(168,148,104,0.14)' },
  cvMiniBtnTxt: { fontSize: 11.5, fontWeight: '800', color: PROF_TEXT_SEC },
  cvMiniBtnTxtOn: { color: PROF_GOLD },
  cvFrame: { marginTop: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: PROF_BORDER },

  bottomCta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: 'rgba(10,17,33,0.96)', borderTopWidth: 1, borderTopColor: PROF_BORDER,
  },
  bottomCtaBtn: { backgroundColor: PROF_GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  bottomCtaBtnTxt: { color: '#1a2030', fontWeight: '900', fontSize: 15.5 },
  bottomCtaHint: { marginTop: 6, fontSize: 11.5, fontWeight: '600', color: PROF_TEXT_SEC, textAlign: 'center', lineHeight: 16 },
  cvFullShell: { flex: 1, backgroundColor: PROF_BG },
  cvFullHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, backgroundColor: PROF_BG, borderBottomWidth: 1, borderBottomColor: PROF_BORDER },
  cvFullBack: { width: 38, alignItems: 'flex-start' },
  cvFullBackText: { color: PROF_GOLD_D, fontSize: 30, fontWeight: '700', marginTop: -4 },
  cvFullTitle: { flex: 1, textAlign: 'center', color: PROF_TEXT, fontSize: 16, fontWeight: '800' },
  cvFullEdit: { width: 62, alignItems: 'flex-end' },
  cvFullEditText: { color: PROF_GOLD_D, fontSize: 11.5, fontWeight: '800' },
  cvFullBody: { flex: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },

  thumbVideoLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2438' },
  thumbVideoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  thumbVideoBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbVideoPlay: { color: '#fff', fontSize: 15, marginLeft: 2 },
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
  dateEditBtn: {
    marginTop: 10, marginLeft: 22, marginRight: 4,
    borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 10,
    backgroundColor: '#fffbf0', paddingHorizontal: 12, paddingVertical: 10,
  },
  dateEditBtnWarn: { borderColor: '#e6c2bc', backgroundColor: '#fff8f7' },
  dateEditLabel: { fontSize: 11.5, fontWeight: '800', color: '#9a7b1f', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  dateEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  dateEditValue: { flex: 1, fontSize: 14, fontWeight: '700', color: INK },
  dateEditAction: { fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  dateEditWarn: { fontSize: 13.5, fontWeight: '700', color: '#a32d2d' },
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
  trBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(168,148,104,0.1)', borderWidth: 1, borderColor: PROF_BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  trBadge: { fontSize: 12.5, fontWeight: '800', color: PROF_GOLD, flexShrink: 1 },
  trToggle: { fontSize: 12.5, fontWeight: '800', color: PROF_TEXT, textDecorationLine: 'underline' },
  cvToolbar: { flexDirection: 'row', alignItems: 'stretch', flexWrap: 'nowrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  cvEditBtn: {
    flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe2e7', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 9,
  },
  cvEditBtnOn: { borderColor: '#c2a25a', backgroundColor: '#f6efdd' },
  cvEditBtnText: { fontSize: 12, fontWeight: '800', color: '#1b2533', textAlign: 'center' },
  cvEditBtnTextOn: { color: '#8a6a1f' },

  docsContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },

  docsHeader: { marginBottom: 16 },
  docsHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#1b2533', lineHeight: 28 },
  docsHeaderSub: { marginTop: 4, fontSize: 14, fontWeight: '500', color: '#6b7280', lineHeight: 20 },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  timelineRail: { width: 28, alignItems: 'center', marginRight: 10, paddingTop: 18 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: '#fff' },
  timelineDotDone: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  timelineDotActive: { borderColor: '#c2a25a', backgroundColor: '#fff' },
  timelineDotLocked: { borderColor: '#d1d5db', backgroundColor: '#fff' },
  timelineDotTxt: { fontSize: 11, fontWeight: '800', color: '#c2a25a' },
  timelineDotTxtDone: { color: '#fff' },
  timelineDotTxtMuted: { color: '#9aa1ac' },
  timelineLine: { width: 2, flex: 1, minHeight: 24, backgroundColor: '#e5e7eb', marginTop: 4 },

  stepCardInTimeline: { flex: 1, marginBottom: 12 },
  stepCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1b2533',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepIconTxt: { fontSize: 22, includeFontPadding: false },
  stepCardMain: { flex: 1, minWidth: 0, paddingTop: 2 },
  stepHint: { marginTop: 4, fontSize: 13, fontWeight: '500', color: '#6b7280', lineHeight: 18 },
  stepStatusPill: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  stepStatusDone: { backgroundColor: '#e8f5ee' },
  stepStatusPending: { backgroundColor: '#fdf3e3' },
  stepStatusSoon: { backgroundColor: '#e8f0fa' },
  stepStatusTxt: { fontSize: 11.5, fontWeight: '700' },
  stepStatusDoneTxt: { color: '#1f8a4c' },
  stepStatusPendingTxt: { color: '#9a6b16' },
  stepStatusSoonTxt: { color: '#3b6ea8' },
  stepChev: { fontSize: 20, fontWeight: '700', color: '#c2a25a', marginTop: 10, paddingLeft: 4 },

  docsInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  docsInfoIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  docsInfoIconTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  docsInfoBody: { flex: 1 },
  docsInfoTitle: { fontSize: 14, fontWeight: '800', color: '#1b2533', marginBottom: 4 },
  docsInfoText: { fontSize: 13, fontWeight: '500', color: '#6b7280', lineHeight: 18 },

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
  deadlineActs: { marginTop: 12, width: '100%', gap: 8 },
  deadlineGrantBtn: {
    backgroundColor: '#142033', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  deadlineGrantText: { color: '#f5ecda', fontWeight: '800', fontSize: 14 },
  deadlineEndBtn: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#e8b5b0',
  },
  deadlineEndText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },

  legend: { gap: 8, marginBottom: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#e6e8ec', padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 12.5, color: '#737373', fontWeight: '600', flexShrink: 1 },

  stepCard: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8eaed', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardActive: { borderColor: '#e3d2a3', backgroundColor: '#fffdf8' },
  cardWait: { borderColor: '#c5dbe2', backgroundColor: '#f8fcfd' },
  cardDone: { backgroundColor: '#f9fcfa', borderColor: '#d4e8dc' },
  cardLocked: { backgroundColor: '#fff', borderColor: '#ececec' },

  stepTitle: { fontSize: 16, fontWeight: '800', color: '#1b2533', lineHeight: 21 },
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
  subTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  subActionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingLeft: 22 },
  subMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subBullet: { fontSize: 15, color: '#c9ccd2', fontWeight: '800', width: 14, textAlign: 'center' },
  subBulletDone: { color: '#1f8a4c' },
  subLabel: { fontSize: 14.5, fontWeight: '700', color: INK },
  subLabelLine: { flex: 1, flexShrink: 0 },
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
