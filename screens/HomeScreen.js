// screens/HomeScreen.js
// Aday ana sayfa — koyu zemin, kariyer şeridi, beyaz profil kartı (3 foto + tanıtım videosu + CV).
// Fotoğrafa dokununca tam ekran galeri; videoya dokununca tam ekran oynatıcı.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated, Alert, ActivityIndicator, Pressable, Share, Platform, useWindowDimensions, StatusBar } from 'react-native';
import Svg, { Path, Polyline, Line, Circle, Rect } from 'react-native-svg';
import { LANGUAGES_ALPHA, nameOf, localeUpper } from '../i18n/languages';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';
import { uploadIntroVideo, getIntroVideoUrl, removeIntroVideo, INTRO_VIDEO_MAX_SEC } from '../lib/introVideo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listDocuments } from '../lib/documents';
import InterviewModal from '../components/InterviewModal';
import ContactSheet from '../components/ContactSheet';
import ContactIcon from '../components/ContactIcon';
import AnnouncementsListSheet from '../components/AnnouncementsListSheet';
import RemindersSheet, { loadDocReminders } from '../components/RemindersSheet';
import CareerJourneySheet from '../components/CareerJourneySheet';
import CertificatePreview from '../components/CertificatePreview';
import NotificationBell from '../components/NotificationBell';
import { getInterview, formatCountdown } from '../lib/interviews';
import { callWindow, getCallWindowOpts } from '../lib/livekitCall';
import { supabase } from '../lib/supabase';
import PhotoWatermark from '../components/PhotoWatermark';
import TurquzLogo from '../components/TurquzLogo';
import PhotoGalleryModal from '../components/PhotoGalleryModal';
import { getCandidateStatus, docsUnlocked, reactivateCandidate, workInfo } from '../lib/candidate';
import {
  undoEmploymentEnd, contestEmploymentEnd, acceptEmploymentEnd, answerEmploymentTerm, getMyEmploymentEpisode,
  listCandidateWorkHistory, scanEmploymentLifecycle, answerBoarding, answerAirportCheck, isEmploymentNotif,
} from '../lib/employment';
import { acceptOffer, rejectOffer } from '../lib/roles';
import { notifyOffer } from '../lib/push';
import { candidatePendingCount, journeyStep, journeyTitleKey, JOURNEY_COUNT, seasonCompleteFromEpisode } from '../lib/pipeline';
import { getFlight, parseArriveAt, msUntilArrival, msUntilYmdGate } from '../lib/flights';
import CountdownBanner from '../components/CountdownBanner';
import { touchLastSeen } from '../lib/lastSeen';
import { APP_SHARE_URL, openPrivacy } from '../lib/config';
import { getCandidateOfferDisplay, getCandidateInterviewDisplay } from '../lib/offerEmployer';
import { unreadAnnouncementCount } from '../lib/notifications';

const INK = '#1b2533';
const GOLD = '#c2a25a';
const NAVY = '#0e141c';
function LogoutIcon({ color = '#b5413a', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function FooterMegaphoneIcon({ color = '#e7dcc4', size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10.2v3.6c0 .7.5 1.3 1.2 1.4l3.3.5 2.2 3.8c.3.5 1.1.3 1.1-.3v-2.8l6.2 1.1c1.1.2 2-.7 2-1.8V9.1c0-1.1-.9-2-2-1.8l-6.2 1.1V5.8c0-.6-.8-.8-1.1-.3L7.9 9.3l-3.3.5c-.6.1-1.1.7-1.1 1.4Z"
        fill={color}
      />
      <Path d="M19.8 9.6c.8.7.8 2.1 0 2.8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function FooterStopwatchIcon({ color = '#e7dcc4', size = 20 }) {
  const hand = '#0e141c';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13.2" r="7.2" fill={color} />
      <Path d="M12 13.2V9.6" stroke={hand} strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 3.6h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M12 3.6v2.2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M17.6 7.2l1.2-1.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function MenuIcon({ color = '#e7dcc4', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="4" y1="17" x2="20" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function LockMini({ color = 'rgba(231,220,196,0.38)', size = 10 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Rect x="6" y="11" width="12" height="10" rx="2" stroke={color} strokeWidth="2.2" />
    </Svg>
  );
}

function ShareIcon({ color = '#e7dcc4', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4v11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Polyline points="8 8 12 4 16 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function VideoCamIcon({ color = '#c2a25a', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="6.5" width="13.5" height="11" rx="2.2" stroke={color} strokeWidth="1.8" />
      <Path d="M16 10.2 21 7.5v9l-5-2.7v-3.6Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function JourneyMeter({ current, pulse }) {
  const n = current > 0 ? current : 1;
  return (
    <View style={styles.meter} pointerEvents="none">
      {Array.from({ length: JOURNEY_COUNT }, (_, i) => i + 1).map((step) => {
        const done = step < n;
        const active = step === n;
        const locked = step > n;
        const dotStyle = [
          styles.meterDot,
          done && styles.meterDotDone,
          active && styles.meterDotNow,
          locked && styles.meterDotLock,
        ];
        const inner = locked
          ? <LockMini />
          : <Text style={[styles.meterNum, done && styles.meterNumDone, active && styles.meterNumNow]}>{step}</Text>;
        return (
          <React.Fragment key={step}>
            {step > 1 ? <View style={[styles.meterLine, (done || active) && styles.meterLineOn]} /> : null}
            {active && pulse ? (
              <Animated.View style={[dotStyle, { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0.94, 1.14] }) }] }]}>
                {inner}
              </Animated.View>
            ) : (
              <View style={dotStyle}>{inner}</View>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function ModuleRow({ icon, label, soonLabel, last, onPress, rightExtra }) {
  const inner = (
    <>
      <Text style={styles.modIcon}>{icon}</Text>
      <Text style={styles.modLabel}>{label}</Text>
      {rightExtra}
      {onPress ? <Text style={styles.modChev}>›</Text> : <View style={styles.soonBadge}><Text style={styles.soonText}>{soonLabel}</Text></View>}
    </>
  );
  return onPress
    ? <TouchableOpacity style={[styles.modRow, !last && styles.modBorder]} onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
    : <View style={[styles.modRow, !last && styles.modBorder]}>{inner}</View>;
}

// Foto şeridi: dolu = görüntüle + ⋯ menü (değiştir); boş = yerinde ekle (CV'ye gitmez).
function PhotoCell({ uri, caption, addLabel, busy, onView, onAdd, onMenu }) {
  return (
    <View style={styles.cell}>
      {uri ? (
        <View style={styles.cellBox}>
          <TouchableOpacity activeOpacity={0.85} onPress={onView} onLongPress={onMenu} delayLongPress={280} style={StyleSheet.absoluteFill}>
            <Image source={{ uri }} style={styles.cellImg} resizeMode="cover" />
            <PhotoWatermark size={26} margin={6} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoCellMenu} onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
            <Text style={styles.videoCellMenuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={0.7} onPress={onAdd} disabled={busy} style={[styles.cellBox, styles.cellEmpty]}>
          {busy ? <ActivityIndicator color="#c2a25a" /> : (
            <>
              <Text style={styles.cellPlus}>＋</Text>
              <Text style={styles.cellAdd}>{addLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      <Text style={styles.cellCap}>{caption}</Text>
    </View>
  );
}

// Tanıtım videosu — foto şeridinde 4. hücre (kompakt).
function VideoCell({
  hasVideo, busy, progress, phase, pending, caption, addLabel, uploadLabel,
  onPlay, onAdd, onMenu,
}) {
  return (
    <View style={styles.cell}>
      {hasVideo && !busy ? (
        <View style={styles.cellBox}>
          <TouchableOpacity activeOpacity={0.85} onPress={onPlay} style={StyleSheet.absoluteFill}>
            <View style={styles.videoCellMedia} />
            <View style={styles.videoCellOverlay} pointerEvents="none">
              <View style={styles.videoCellBadge}>
                <Text style={styles.videoCellPlay}>▶</Text>
              </View>
            </View>
          </TouchableOpacity>
          {pending ? (
            <View style={styles.videoCellPending}>
              <Text style={styles.videoCellPendingText}>!</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.videoCellMenu} onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
            <Text style={styles.videoCellMenuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onAdd}
          disabled={busy}
          style={[styles.cellBox, styles.cellEmpty]}
        >
          {busy ? (
            <>
              <View style={[styles.videoBarTrack, { width: '78%' }]}>
                <View style={[styles.videoBarFill, { width: `${Math.max(4, Math.round(progress * 100))}%` }]} />
              </View>
              <Text style={[styles.cellAdd, { marginTop: 8 }]}>{uploadLabel}</Text>
            </>
          ) : (
            <>
              <VideoCamIcon size={20} />
              <Text style={styles.cellAdd}>{addLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      <Text style={styles.cellCap}>{caption}</Text>
    </View>
  );
}

async function optimizeHomePhoto(uri) {
  const actions = [{ resize: { width: 800 } }];
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.WEBP, base64: true,
    });
    return `data:image/webp;base64,${out.base64}`;
  } catch {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return `data:image/jpeg;base64,${out.base64}`;
  }
}

export default function HomeScreen({ data, userId, onPreview, onEdit, onOpenSettings, onOpenDocs, onLogout, onSaveData, fontsReady, openJourney = false, onJourneyOpened }) {
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [galleryIndex, setGalleryIndex] = useState(null); // tam ekran slayt indeksi
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // ilerleme 0..1
  const [videoPhase, setVideoPhase] = useState(''); // '' | 'compress' | 'upload'
  const [videoError, setVideoError] = useState(''); // belirgin uyarı (ör. çok uzun)
  const [videoPlayUrl, setVideoPlayUrl] = useState(null); // tam ekran oynatma için imzalı url
  const [pendingVideo, setPendingVideo] = useState(''); // yüklendi ama henüz KAYDEDİLMEDİ (yol)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(''); // önizleme için imzalı url
  const [missingDocs, setMissingDocs] = useState(0);
  const [journeyN, setJourneyN] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false); // ⋮ ayarlar
  const [langOpen, setLangOpen] = useState(false);
  const [offerPending, setOfferPending] = useState(false); // acente teklif gönderdi, aday cevabı bekleniyor
  const [offerEmployer, setOfferEmployer] = useState(null); // { displayName, revealed }
  const [interviewEmployer, setInterviewEmployer] = useState(null);
  const [inProcess, setInProcess] = useState(false); // teklifi kabul etti, belge sürecinde
  const [offerBusy, setOfferBusy] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [hasDocRemind, setHasDocRemind] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [interview, setInterview] = useState(null);
  const [ivPending, setIvPending] = useState(false); // adaya gönderilmiş, henüz seçilmemiş mülakat
  const [ivJoinable, setIvJoinable] = useState(false); // planlandı + katılım penceresi açık
  const [ivOpts, setIvOpts] = useState({ minutes: 10, extraSecs: 0 });
  const [nowTick, setNowTick] = useState(Date.now());
  const [work, setWork] = useState({ hired: false }); // çalışma/personel durumu
  const [episode, setEpisode] = useState(null);
  const [workHistory, setWorkHistory] = useState([]);
  const [certified, setCertified] = useState(false);
  const [certEpisode, setCertEpisode] = useState(null);
  const [boardingStatus, setBoardingStatus] = useState(null);
  const [boardingGateYmd, setBoardingGateYmd] = useState(null); // kalkış günü YYYY-MM-DD
  const [airportCheckStatus, setAirportCheckStatus] = useState(null);
  const [flightDepartAt, setFlightDepartAt] = useState('');
  const [flightArriveAt, setFlightArriveAt] = useState('');
  const [workStartYmd, setWorkStartYmd] = useState(null);
  const [plannedEndAt, setPlannedEndAt] = useState(null);
  const [boardingBusy, setBoardingBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(null); // 'photo' | 'photoClose' | 'photoFull' | null
  const blink = useRef(new Animated.Value(1)).current;
  const remindBlink = useRef(new Animated.Value(1)).current;
  const ivBlink = useRef(new Animated.Value(1)).current;
  const cardBlink = useRef(new Animated.Value(1)).current;
  const spotBlink = useRef(new Animated.Value(1)).current;
  const homeScroll = useRef(null);
  const [careerFocus, setCareerFocus] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [ivReady, setIvReady] = useState(false);
  const careerReady = statusReady && ivReady;

  // Durumu yükle: çalışma (personel) durumu + belge yükleme kapısı + eksik belge sayısı.
  const loadStatus = useCallback(async () => {
    try {
      const [status, ep, hist] = await Promise.all([
        getCandidateStatus(userId),
        getMyEmploymentEpisode(),
        listCandidateWorkHistory(userId),
      ]);
      setEpisode(ep);
      setBoardingStatus(status?.boarding_status || null);
      setAirportCheckStatus(status?.airport_check_status || null);
      {
        const gate = status?.flight_depart_on || status?.work_start_at || null;
        setBoardingGateYmd(gate ? String(gate).slice(0, 10) : null);
      }
      setWorkStartYmd(status?.work_start_at ? String(status.work_start_at).slice(0, 10) : null);
      {
        const endRaw = status?.work_end_at
          || status?.planned_end_on
          || (ep?.planned_end_at ? String(ep.planned_end_at) : null);
        setPlannedEndAt(endRaw || null);
      }
      setWorkHistory((hist || []).filter((h) => h.outcome === 'completed'));
      setCertified((hist || []).some((h) => h.outcome === 'completed'));
      setOfferPending(status?.status === 'offered');
      if (status?.status === 'offered') {
        getCandidateOfferDisplay(userId).then((d) => setOfferEmployer(d)).catch(() => setOfferEmployer(null));
      } else {
        setOfferEmployer(null);
      }
      scanEmploymentLifecycle();

      const nextWork = workInfo(status);
      const nextInProcess = status?.status === 'accepted';
      const unlocked = docsUnlocked(status) || status?.status === 'hired';

      // inProcess/hired’ı journey adımıyla aynı anda set et — yoksa journeyN=0 iken
      // kısa süre “Çalışıyorum” (work_active) flaş yapıyordu.
      if (!unlocked) {
        setMissingDocs(0);
        setJourneyN(0);
        setHasDocRemind(false);
        setWork(nextWork);
        setInProcess(nextInProcess);
        return;
      }

      const [rows, flight] = await Promise.all([listDocuments(userId), getFlight(userId)]);
      setFlightDepartAt(flight?.departAtTs || flight?.departAt || '');
      setFlightArriveAt(flight?.arriveAt || '');
      const has = (k) => rows.some((r) => r.kind === k && r.submitted_at);
      setMissingDocs(candidatePendingCount(has));
      setJourneyN(journeyStep(has, !!flight?.pickupSent, {
        hired: !!nextWork.hired,
        seasonComplete: seasonCompleteFromEpisode(ep) || (hist || []).some((h) => h.outcome === 'completed'),
      }));
      setWork(nextWork);
      setInProcess(nextInProcess);
      const reminds = await loadDocReminders(userId);
      setHasDocRemind(reminds.length > 0);
    } finally {
      setStatusReady(true);
    }
  }, [userId]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Aktif belge süresi varken footer kırmızı uyarıyı sürekli yakıp söndür.
  useEffect(() => {
    if (!hasDocRemind) {
      remindBlink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(remindBlink, { toValue: 0.12, duration: 520, useNativeDriver: true }),
        Animated.timing(remindBlink, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasDocRemind, remindBlink]);

  // Belgelerden geri: yol haritasını yeniden aç.
  useEffect(() => {
    if (!openJourney) return undefined;
    setJourneyOpen(true);
    onJourneyOpened?.();
    return undefined;
  }, [openJourney, onJourneyOpened]);

  // Ana panele her gelişte çevrimiçi zamanını güncelle (havuz rozeti).
  useEffect(() => {
    if (!userId) return undefined;
    touchLastSeen(true);
    return undefined;
  }, [userId]);

  // Durum anlık değişsin (teklif gelince/değişince kart güncellensin).
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`home-status-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_status', filter: `user_id=eq.${userId}` }, () => loadStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents', filter: `user_id=eq.${userId}` }, () => loadStatus())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${userId}` }, () => loadStatus())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadStatus]);

  const refreshAnnounceUnread = useCallback(async () => {
    if (!userId) return;
    const n = await unreadAnnouncementCount(userId);
    setAnnounceUnread(n);
  }, [userId]);

  useEffect(() => { refreshAnnounceUnread(); }, [refreshAnnounceUnread]);
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`home-announce-unread-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
        refreshAnnounceUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, refreshAnnounceUnread]);

  const openAnnouncements = useCallback(() => {
    setAnnouncementsOpen(true);
  }, []);

  // Teklifi KABUL et -> belgeler açılır, acenteye bildirim.
  const doAcceptOffer = () => {
    Alert.alert(t('offer_card_title'), t('offer_accept_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('offer_accept'), onPress: async () => {
          setOfferBusy(true);
          try { await acceptOffer(); notifyOffer(userId, 'offer_accepted'); await loadStatus(); }
          catch (e) { Alert.alert(t('offer_card_title'), e?.message || 'error'); }
          finally { setOfferBusy(false); }
        } },
    ]);
  };

  // Teklifi REDDET -> havuza döner.
  const doRejectOffer = () => {
    Alert.alert(t('offer_card_title'), t('offer_reject_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('offer_reject'), style: 'destructive', onPress: async () => {
          setOfferBusy(true);
          try {
            const { data: st } = await supabase.from('candidate_status').select('accepted_by').eq('user_id', userId).maybeSingle();
            await rejectOffer();
            notifyOffer(userId, 'offer_rejected', st?.accepted_by);
            await loadStatus();
          }
          catch (e) { Alert.alert(t('offer_card_title'), e?.message || 'error'); }
          finally { setOfferBusy(false); }
        } },
    ]);
  };

  // İşyerinden ayrıl (şimdilik UI gizli).

  const doUndoLeave = () => {
    if (!episode?.id) return;
    Alert.alert(t('emp_undo'), t('emp_undo_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('emp_undo'), onPress: async () => {
          try { await undoEmploymentEnd(episode.id); await loadStatus(); }
          catch (e) { Alert.alert(t('emp_undo'), e?.message || 'error'); }
        } },
    ]);
  };

  const doAcceptLeave = () => {
    if (!episode?.id) return;
    Alert.alert(t('emp_accept'), t('emp_accept_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('emp_accept'), onPress: async () => {
          try { await acceptEmploymentEnd(episode.id); await loadStatus(); }
          catch (e) { Alert.alert(t('emp_accept'), e?.message || 'error'); }
        } },
    ]);
  };

  const doContestLeave = async () => {
    if (!episode?.id) return;
    try { await contestEmploymentEnd(episode.id); await loadStatus(); }
    catch (e) { Alert.alert(t('emp_contest'), e?.message || 'error'); }
  };

  const doTermAnswer = (answer) => {
    if (!episode?.id) return;
    const title = answer === 'ok' ? t('emp_term_ok') : t('emp_term_problem');
    const body = answer === 'ok' ? t('emp_term_ok_confirm') : t('emp_term_problem_confirm');
    Alert.alert(title, body, [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: title, style: answer === 'ok' ? 'default' : 'destructive', onPress: async () => {
          try {
            await answerEmploymentTerm(episode.id, answer);
            await loadStatus();
            if (answer === 'problem') {
              Alert.alert(t('emp_term_problem'), t('emp_term_problem_done'));
            }
          }
          catch (e) { Alert.alert(title, e?.message || 'error'); }
        } },
    ]);
  };

  const doReactivate = () => {
    Alert.alert(t('work_title'), t('work_reactivate_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('work_reactivate'), onPress: async () => {
          try {
            await scanEmploymentLifecycle();
            await reactivateCandidate();
            await loadStatus();
          }
          catch (e) { Alert.alert(t('work_title'), e?.message || 'error'); }
        } },
    ]);
  };

  // Eksik belge varsa uyarıyı sürekli yanıp söndür.
  useEffect(() => {
    if (missingDocs > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 650, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    blink.setValue(1);
    return undefined;
  }, [missingDocs, blink]);

  const careerPulse = offerPending || ((inProcess || work.hired) && journeyN > 0);
  const showStaffSummary = work.hired && episode?.outcome === 'active' && journeyN >= 7;

  useEffect(() => {
    if (careerPulse) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(cardBlink, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(cardBlink, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    cardBlink.setValue(1);
    return undefined;
  }, [careerPulse, cardBlink]);

  // Bekleyen mülakat daveti / katılım penceresi. Anlık dinle.
  const loadInterview = useCallback(async () => {
    try {
      const iv = await getInterview(userId);
      setInterview(iv || null);
      if (iv?.status === 'proposed' || iv?.status === 'scheduled') {
        const opportunity = await getCandidateInterviewDisplay(userId).catch(() => null);
        setInterviewEmployer(opportunity);
      } else {
        setInterviewEmployer(null);
      }
      setIvPending(iv?.status === 'proposed');
      if (iv?.status === 'scheduled' && iv.selectedSlot) {
        const opts = await getCallWindowOpts(iv);
        setIvOpts(opts);
        setIvJoinable(callWindow(iv.selectedSlot, opts).joinable);
      } else {
        setIvJoinable(false);
      }
    } finally {
      setIvReady(true);
    }
  }, [userId]);
  useEffect(() => { loadInterview(); }, [loadInterview]);
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`home-iv-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${userId}` }, () => loadInterview())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadInterview]);
  // Katılım penceresi / opts periyodik yenile.
  useEffect(() => {
    const id = setInterval(() => { loadInterview(); }, 15000);
    return () => clearInterval(id);
  }, [loadInterview]);
  // Geri sayım saniyesi (planlı mülakat veya uçuş günü beklerken).
  useEffect(() => {
    const needTick = (interview?.status === 'scheduled' && interview?.selectedSlot)
      || ((boardingStatus === 'pending' || boardingStatus === 'no_response') && boardingGateYmd)
      || (airportCheckStatus === 'pending' && flightDepartAt)
      || (work.inTransit && (msUntilArrival(flightArriveAt) > 0 || msUntilYmdGate(workStartYmd) > 0));
    if (!needTick) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [interview?.status, interview?.selectedSlot, boardingStatus, boardingGateYmd, airportCheckStatus, flightDepartAt, work.inTransit, flightArriveAt, workStartYmd]);
  // Mülakat daveti / katıl penceresi: kutuyu yanıp söndür.
  useEffect(() => {
    if (ivPending || ivJoinable) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(ivBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(ivBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    ivBlink.setValue(1);
    return undefined;
  }, [ivPending, ivJoinable, ivBlink]);

  const d = data || {};
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || t('home_cv_card');
  const subtitle = [d.title, nameOf(lang)].filter(Boolean).join(' · ');

  const ivScheduled = interview?.status === 'scheduled' && !!interview?.selectedSlot;
  const ivFocus = ivPending || ivScheduled;
  const showSpotLive = careerReady && !offerPending && !work.hired && !work.inTransit && !inProcess && !ivFocus;

  useEffect(() => {
    if (showSpotLive) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(spotBlink, { toValue: 0.28, duration: 720, useNativeDriver: true }),
        Animated.timing(spotBlink, { toValue: 1, duration: 720, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    spotBlink.setValue(1);
    return undefined;
  }, [showSpotLive, spotBlink]);

  const ivWin = ivScheduled ? callWindow(interview.selectedSlot, ivOpts) : null;
  const ivCountdownLeft = ivWin?.base ? ivWin.base - nowTick : 0;
  // Anlık joinable (saniyelik tick ile)
  const ivCanJoin = !!(ivWin && (ivWin.joinable || (nowTick >= ivWin.start && nowTick <= ivWin.end + 120000)));
  const renderOpportunityLocation = (opportunity) => {
    if (!opportunity?.displayName) return null;
    const location = [opportunity.country, opportunity.city, opportunity.region].filter(Boolean).join(' · ');
    return (
      <View style={styles.opportunityMeta}>
        <Text style={styles.opportunityName}>
          {t('offer_employer_label') || 'İşletme'}: {opportunity.displayName}
        </Text>
        {location ? (
          <Text style={styles.opportunityLocation}>
            {t('opportunity_location') || 'Konum'}: {location}
          </Text>
        ) : null}
      </View>
    );
  };

  // Uçuş teyidi: kalkış günü gelene kadar geri sayım (bildirim taramasıyla aynı kapı).
  const boardingPending = boardingStatus === 'pending' || boardingStatus === 'no_response';
  const todayYmd = (() => {
    const x = new Date(nowTick);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  })();
  const boardingDue = !boardingGateYmd || boardingGateYmd <= todayYmd;
  const boardingCountdownLeft = (() => {
    if (!boardingGateYmd || boardingDue) return 0;
    const [y, m, day] = boardingGateYmd.split('-').map(Number);
    if (!y || !m || !day) return 0;
    return Math.max(0, new Date(y, m - 1, day, 0, 0, 0, 0).getTime() - nowTick);
  })();
  const showBoardingAsk = boardingPending && boardingDue;
  const showBoardingCountdown = boardingPending && !boardingDue;
  const departureDate = parseArriveAt(flightDepartAt)?.dt || null;
  const airportCheckOpen = airportCheckStatus === 'pending'
    && departureDate
    && nowTick >= departureDate.getTime() - 60 * 60 * 1000
    && nowTick < departureDate.getTime();
  const arriveCountdownLeft = msUntilArrival(flightArriveAt, nowTick);
  const workStartCountdownLeft = work.inTransit ? msUntilYmdGate(workStartYmd, nowTick) : 0;
  const workStartDue = work.inTransit && workStartYmd && workStartCountdownLeft === 0;

  const savedVideo = data?.introVideo || '';
  const showVideo = pendingVideo || savedVideo;   // önizlenecek yol (bekleyen öncelikli)
  const isPending = !!pendingVideo;               // yüklendi ama kaydedilmedi

  // Önizleme için imzalı URL (bekleyen ya da kayıtlı video).
  useEffect(() => {
    let alive = true;
    if (!showVideo) { setVideoPreviewUrl(''); return undefined; }
    getIntroVideoUrl(showVideo).then((u) => { if (alive) setVideoPreviewUrl(u || ''); });
    return () => { alive = false; };
  }, [showVideo]);

  // Seç + yükle -> KAYDETME, sadece önizlemeye al (Kaydet/Vazgeç çıkar).
  const pickVideo = async () => {
    setVideoError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: INTRO_VIDEO_MAX_SEC,
        videoExportPreset: ImagePicker.VideoExportPreset?.Passthrough, // yeniden kodlama YOK -> hızlı + dikey/orijinal korunur
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      if (a.duration && a.duration > (INTRO_VIDEO_MAX_SEC + 0.5) * 1000) {
        setVideoError(t('intro_video_too_long', { n: INTRO_VIDEO_MAX_SEC })); return;
      }
      setVideoBusy(true);
      // 1) Sıkıştır (faststart, dikey, net). Sıkıştırıcı build'de yoksa orijinali yükle (çökmez).
      let uploadUri = a.uri;
      try {
        setVideoPhase('compress'); setVideoProgress(0);
        const { Video } = await import('react-native-compressor');
        uploadUri = await Video.compress(a.uri, { compressionMethod: 'manual', maxSize: 1920, bitrate: 6000000 }, (p) => setVideoProgress(p));
      } catch (ce) {
        console.warn('compressor yok, orijinal yükleniyor:', ce?.message);
        uploadUri = a.uri;
      }
      // 2) Akıtarak yükle.
      setVideoPhase('upload'); setVideoProgress(0);
      const prevPending = pendingVideo;
      const path = await uploadIntroVideo(userId, uploadUri, setVideoProgress);
      setPendingVideo(path);
      if (prevPending) removeIntroVideo(prevPending); // önceki bekleyeni temizle
    } catch (e) {
      Alert.alert(t('intro_video_label'), t('doc_upload_error'));
    } finally {
      setVideoBusy(false); setVideoPhase('');
    }
  };
  // Kaydet: bekleyeni profile yaz; varsa eski kayıtlıyı sil.
  const saveVideo = () => {
    if (!pendingVideo) return;
    const old = savedVideo;
    onSaveData?.({ introVideo: pendingVideo });
    setPendingVideo('');
    if (old && old !== pendingVideo) removeIntroVideo(old);
  };
  // Vazgeç: bekleyeni at (storage'dan da sil).
  const cancelVideo = () => {
    const p = pendingVideo;
    setPendingVideo('');
    if (p) removeIntroVideo(p);
  };
  const playVideo = async () => {
    if (!showVideo) return;
    const url = videoPreviewUrl || await getIntroVideoUrl(showVideo);
    if (url) setVideoPlayUrl(url);
  };
  // Videoyu sil: storage'dan kaldır + profilden temizle (kart yeniden "Video Ekle"ye döner).
  const doRemoveVideo = async () => {
    try { await removeIntroVideo(savedVideo); onSaveData?.({ introVideo: '' }); } catch (e) { /* yoksay */ }
  };
  const removeVideo = () => {
    Alert.alert(t('intro_video_label'), t('intro_video_remove_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('intro_video_remove'), style: 'destructive', onPress: doRemoveVideo },
    ]);
  };

  const pickHomePhoto = async (field, aspect) => {
    if (!onSaveData || photoBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('perm_needed'), t('perm_msg'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect, quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      setPhotoBusy(field);
      const optimized = await optimizeHomePhoto(res.assets[0].uri);
      onSaveData({ [field]: optimized });
    } catch (e) {
      Alert.alert(t('err_title'), t('err_photo'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const shareApp = async () => {
    const url = APP_SHARE_URL;
    const text = t('home_share_msg');
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: text, url }
          : { message: `${text} ${url}`, title: 'Turquz' },
      );
    } catch {
      // Kullanıcı iptal etti.
    }
  };

  const closeSettings = () => {
    setMenuOpen(false);
    setLangOpen(false);
  };

  const photoMenu = (field, aspect, caption) => {
    Alert.alert(caption, '', [
      { text: t('photo_change'), onPress: () => pickHomePhoto(field, aspect) },
      { text: t('consent_cancel'), style: 'cancel' },
    ]);
  };

  const videoMenu = () => {
    const opts = [];
    if (isPending) {
      opts.push({ text: t('intro_video_save'), onPress: saveVideo });
      opts.push({ text: t('intro_video_cancel'), onPress: cancelVideo, style: 'destructive' });
    }
    if (showVideo) {
      opts.push({ text: t('intro_video_watch'), onPress: playVideo });
      opts.push({ text: t('intro_video_change'), onPress: pickVideo });
      if (!isPending) {
        opts.push({ text: t('intro_video_remove'), style: 'destructive', onPress: removeVideo });
      }
    }
    opts.push({ text: t('consent_cancel'), style: 'cancel' });
    Alert.alert(t('intro_video_cap'), '', opts);
  };

  useEffect(() => {
    if (!videoError) return undefined;
    Alert.alert(t('intro_video_label'), videoError);
    setVideoError('');
    return undefined;
  }, [videoError, t]);

  const cells = [
    { field: 'photo', aspect: [1, 1], uri: d.photo, caption: t('photo_cap_id') },
    { field: 'photoClose', aspect: [3, 4], uri: d.photoClose, caption: t('photo_cap_close') },
    { field: 'photoFull', aspect: [3, 4], uri: d.photoFull, caption: t('photo_cap_full') },
  ];
  const gallery = cells.filter((c) => c.uri).map((c) => ({ uri: c.uri, cap: c.caption }));

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroBrand}>
            <TurquzLogo width={94} height={64} style={styles.heroLogo} wordmarkSize={10} fontFamily="Cinzel_600SemiBold" fontsReady />
            <Text style={styles.heroHi} numberOfLines={2}>{localeUpper(t('home_panel_title'), lang)}</Text>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell
              userId={userId}
              color="#e7dcc4"
              onNavigate={(n) => {
                const type = String(n?.type || '');
                if (type === 'chat_message') {
                  onOpenDocs?.({ openChat: true });
                  return;
                }
                if (
                  type === 'reupload'
                  || type === 'agency_doc_retracted'
                  || type === 'agency_doc_updated'
                  || type === 'flight_ticket_updated'
                  || type === 'document'
                  || type === 'success_certificate'
                  || type === 'accepted'
                  || type === 'docs_extra'
                  || type === 'flight_ticket_ready'
                  || type === 'flight_ticket_sent'
                  || type === 'pickup'
                ) {
                  const scrollToStep = type === 'pickup'
                    ? 6
                    : (type === 'success_certificate' ? 9
                      : (type === 'flight_ticket_ready' || type === 'flight_ticket_sent' || type === 'flight_ticket_updated' || type === 'agency_doc_updated' ? 5 : undefined));
                  onOpenDocs?.(scrollToStep ? { scrollToStep } : undefined);
                  return;
                }
                if (type === 'airport_check' || type === 'boarding_check' || type.startsWith('boarding_')) {
                  homeScroll.current?.scrollTo({ y: 0, animated: true });
                  return;
                }
                if (
                  type === 'interview_proposed'
                  || type === 'interview_respond_remind'
                  || type === 'interview_scheduled'
                  || type.startsWith('interview_reminder')
                  || type === 'interview'
                ) {
                  setInterviewOpen(true);
                  return;
                }
                if (type === 'offer') {
                  loadStatus();
                  homeScroll.current?.scrollTo({ y: 0, animated: true });
                  return;
                }
                if (isEmploymentNotif(type)) {
                  loadStatus();
                  homeScroll.current?.scrollTo({ y: 0, animated: true });
                  setCareerFocus(true);
                  setTimeout(() => setCareerFocus(false), 2200);
                }
              }}
            />
            <TouchableOpacity
              onPress={shareApp}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('home_share')}
            >
              <ShareIcon />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('settings')}>
              <MenuIcon />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.heroRule} />
      </View>

      {/* Ayarlar: dil (açılır kaydırma) + bildirim + hesap */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={closeSettings}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSettings} />
          <View style={[styles.menuSheet, { maxHeight: winH * 0.86, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHeadRow}>
              <Text style={styles.menuHeadTitle}>{t('settings')}</Text>
              <TouchableOpacity onPress={closeSettings} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuCloseBtn}>
                <Text style={styles.menuCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: winH * 0.86 - 72 }}
              contentContainerStyle={styles.menuScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
            >
              <Text style={styles.menuSection}>{t('set_language')}</Text>
              <TouchableOpacity
                style={styles.langDrop}
                onPress={() => setLangOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Text style={styles.langDropValue}>{nameOf(lang)}</Text>
                <Text style={styles.langDropChev}>{langOpen ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {langOpen ? (
                <ScrollView
                  style={styles.langDropList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  {LANGUAGES_ALPHA.map((l) => {
                    const on = l.code === lang;
                    return (
                      <TouchableOpacity
                        key={l.code}
                        style={[styles.langDropRow, on && styles.langDropRowOn]}
                        onPress={() => {
                          if (!on) setLang(l.code);
                          setLangOpen(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.langDropName, on && styles.langDropNameOn]}>{l.name}</Text>
                        {on ? <Text style={styles.langDropCheck}>✓</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : null}

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('set_account')}</Text>
              <TouchableOpacity
                style={[styles.actionRow, { marginBottom: 10 }]}
                onPress={() => { closeSettings(); openPrivacy(); }}
                activeOpacity={0.85}
              >
                <Text style={styles.menuPrivacyIcon}>🔒</Text>
                <Text style={[styles.menuPrivacyText, { flex: 1 }]}>{t('set_privacy')}</Text>
                <Text style={styles.menuPrivacyHint}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => { closeSettings(); onLogout?.(); }}
                activeOpacity={0.85}
              >
                <View style={styles.menuLogoutIcon}><LogoutIcon color="#b5413a" size={18} /></View>
                <Text style={[styles.menuLogoutText, { flex: 1 }]}>{t('set_logout')}</Text>
                <Text style={styles.menuLogoutHint}>›</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={homeScroll}
        style={{ backgroundColor: NAVY }}
        contentContainerStyle={[styles.content, { paddingTop: 18, paddingBottom: insets.bottom + 88 }]}
      >
        {/* Kariyer yolculuğu: teklif → mülakat → belge aşaması → personel */}
        <View style={[styles.workCard, careerFocus && styles.workCardFocus]}>
          <Text style={styles.workKicker}>{localeUpper(t('career_started'), lang)}</Text>

          {!careerReady ? (
            <Text style={styles.workActive}>…</Text>
          ) : !work.hired && offerPending ? (
            <>
              <Text style={styles.workActive}>{t('spotlight_offer_title')}</Text>
              <View style={[styles.offerCard, styles.workEmbed]}>
                {offerEmployer?.displayName ? (
                  renderOpportunityLocation(offerEmployer)
                ) : null}
                <Text style={styles.offerCardDesc}>{t('offer_card_desc')}</Text>
                <View style={styles.offerBtns}>
                  <TouchableOpacity style={styles.offerDecline} onPress={doRejectOffer} disabled={offerBusy} activeOpacity={0.85}>
                    <Text style={styles.offerDeclineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('offer_reject')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.offerAccept} onPress={doAcceptOffer} disabled={offerBusy} activeOpacity={0.9}>
                    {offerBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.offerAcceptText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('offer_accept')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              {inProcess || work.hired || work.inTransit ? (
                <TouchableOpacity
                  onPress={() => setJourneyOpen(true)}
                  activeOpacity={0.88}
                >
                  {journeyN > 0 ? <JourneyMeter current={journeyN} pulse={cardBlink} /> : null}
                  <View style={styles.workStageRow}>
                    <Text style={[styles.workActive, { flex: 1 }]} numberOfLines={2}>
                      {journeyN > 0
                        ? t(journeyTitleKey(Math.min(journeyN, JOURNEY_COUNT)))
                        : '…'}
                    </Text>
                    {missingDocs > 0 ? (
                      <Animated.View style={[styles.workMissBadge, { opacity: blink }]}>
                        <Text style={styles.workMissText}>{missingDocs}</Text>
                      </Animated.View>
                    ) : null}
                    <Text style={styles.workStageChev}>›</Text>
                  </View>
                </TouchableOpacity>
              ) : ivFocus ? (
                <Text style={styles.workActive}>{ivPending ? t('spotlight_iv_title') : t('spotlight_iv_sched_title')}</Text>
              ) : (
                <View>
                  <Animated.View style={{ opacity: spotBlink }}>
                    <Text style={styles.workActive}>{t('spotlight_title')}</Text>
                  </Animated.View>
                  <Text style={styles.workSub}>{t('spotlight_sub')}</Text>
                  <Text style={styles.workSub}>{t('spotlight_hint')}</Text>
                </View>
              )}

              {!work.hired && ivFocus ? (
                ivPending ? (
                  <TouchableOpacity style={[styles.focusAction, styles.workEmbed]} onPress={() => setInterviewOpen(true)} activeOpacity={0.88}>
                    <Text style={styles.focusActionIcon}>📅</Text>
                    <View style={styles.focusActionBody}>
                      <Text style={styles.focusActionTitle}>{t('home_iv_pick_focus')}</Text>
                      <Text style={styles.focusActionSub}>{t('home_iv_pick_focus_sub')}</Text>
                    </View>
                    <Animated.View style={[styles.gridBadge, styles.gridBadgeGold, styles.workEmbedBadge, { opacity: ivBlink }]}>
                      <Text style={styles.gridBadgeText}>!</Text>
                    </Animated.View>
                    <Text style={styles.focusActionChev}>›</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.focusAction, styles.workEmbed, ivCanJoin && styles.focusActionHot]}
                    onPress={() => setInterviewOpen(true)}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.focusActionIcon}>{ivCanJoin ? '▶' : '⏱'}</Text>
                    <View style={styles.focusActionBody}>
                      <Text style={styles.focusActionTitle}>
                        {ivCanJoin ? t('call_join') : formatCountdown(Math.max(0, ivCountdownLeft))}
                      </Text>
                      <Text style={styles.focusActionSub}>
                        {ivCanJoin ? t('spotlight_iv_sched_sub') : t('home_iv_countdown_sub')}
                      </Text>
                    </View>
                    {ivCanJoin ? (
                      <Animated.View style={[styles.gridBadge, styles.gridBadgeGold, styles.workEmbedBadge, { opacity: ivBlink }]}>
                        <Text style={styles.gridBadgeText}>▶</Text>
                      </Animated.View>
                    ) : null}
                    <Text style={styles.focusActionChev}>›</Text>
                  </TouchableOpacity>
                )
              ) : null}
              {ivFocus ? renderOpportunityLocation(interviewEmployer) : null}
            </>
          )}

          {showStaffSummary && work.end ? (
            <Text style={styles.workSub}>{t('work_until', { date: `${String(work.end.getDate()).padStart(2, '0')}.${String(work.end.getMonth() + 1).padStart(2, '0')}.${work.end.getFullYear()}` })}</Text>
          ) : null}

          {work.inTransit && workStartDue ? (
            <Text style={styles.workSub}>{t('home_transit_wait')}</Text>
          ) : null}

          {work.inTransit ? (
            <>
              {airportCheckOpen ? (
                <View style={styles.workAlert}>
                  <Text style={styles.workAlertText}>{t('airport_check_prompt') || 'Uçuşunuza yaklaşık 1 saat kaldı. Havaalanına geldiniz mi?'}</Text>
                  <TouchableOpacity
                    style={[styles.workBtnPrimary, boardingBusy && styles.workBtnDim]}
                    disabled={boardingBusy}
                    onPress={async () => {
                      setBoardingBusy(true);
                      try { await answerAirportCheck('confirmed'); await loadStatus(); }
                      catch (e) { Alert.alert(t('airport_check_title') || 'Havaalanı teyidi', e?.message || 'error'); }
                      finally { setBoardingBusy(false); }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.workBtnPrimaryText}>{t('airport_check_yes') || 'Evet, havaalanına geldim'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.workBtnDanger, boardingBusy && styles.workBtnDim]}
                    disabled={boardingBusy}
                    onPress={async () => {
                      setBoardingBusy(true);
                      try { await answerAirportCheck('not_yet'); await loadStatus(); }
                      catch (e) { Alert.alert(t('airport_check_title') || 'Havaalanı teyidi', e?.message || 'error'); }
                      finally { setBoardingBusy(false); }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.workBtnDangerText}>{t('airport_check_no') || 'Hayır, henüz gelemedim'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {airportCheckStatus === 'confirmed' ? (
                <View style={styles.workNote}>
                  <Text style={styles.workNoteText}>✓ {t('airport_check_confirmed_self') || 'Havaalanına geldiğiniz acentenize bildirildi.'}</Text>
                </View>
              ) : airportCheckStatus === 'missed' ? (
                <View style={styles.workNote}>
                  <Text style={styles.workNoteText}>{t('airport_check_missed_self') || 'Havaalanına gelemediğiniz acentenize bildirildi.'}</Text>
                </View>
              ) : null}

              {showBoardingCountdown ? (
                <View style={styles.workNote}>
                  <Text style={styles.workNoteText}>⏱ {t('boarding_countdown_title')}: {formatCountdown(boardingCountdownLeft)}</Text>
                  <Text style={[styles.workSub, { marginTop: 6 }]}>{t('boarding_countdown_sub')}</Text>
                </View>
              ) : null}

              {arriveCountdownLeft > 0 ? (
                <CountdownBanner
                  titleKey="arrive_countdown_title"
                  subKey="arrive_countdown_sub"
                  leftMs={arriveCountdownLeft}
                />
              ) : null}

              {workStartCountdownLeft > 0 ? (
                <CountdownBanner
                  titleKey="work_start_countdown_title"
                  subKey="work_start_countdown_sub"
                  leftMs={workStartCountdownLeft}
                />
              ) : null}

              {showBoardingAsk ? (
                <View style={styles.workAlert}>
                  <Text style={styles.workAlertText}>{t('boarding_check_prompt')}</Text>
                  <TouchableOpacity
                    style={[styles.workBtnPrimary, boardingBusy && styles.workBtnDim]}
                    disabled={boardingBusy}
                    onPress={async () => {
                      setBoardingBusy(true);
                      try { await answerBoarding('confirmed'); await loadStatus(); }
                      catch (e) {
                        const msg = e?.message === 'boarding_too_early' ? t('boarding_too_early') : (e?.message || 'error');
                        Alert.alert(t('boarding_check_title'), msg);
                      }
                      finally { setBoardingBusy(false); }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.workBtnPrimaryText}>{t('boarding_yes')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.workBtnDanger, boardingBusy && styles.workBtnDim]}
                    disabled={boardingBusy}
                    onPress={async () => {
                      setBoardingBusy(true);
                      try { await answerBoarding('missed'); await loadStatus(); }
                      catch (e) {
                        const msg = e?.message === 'boarding_too_early' ? t('boarding_too_early') : (e?.message || 'error');
                        Alert.alert(t('boarding_check_title'), msg);
                      }
                      finally { setBoardingBusy(false); }
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.workBtnDangerText}>{t('boarding_missed')}</Text>
                  </TouchableOpacity>
                </View>
              ) : boardingStatus === 'confirmed' ? (
                <View style={styles.workNote}>
                  <Text style={styles.workNoteText}>✓ {t('boarding_confirmed_self')}</Text>
                </View>
              ) : boardingStatus === 'missed' ? (
                <View style={styles.workNote}>
                  <Text style={styles.workNoteText}>{t('boarding_missed_self')}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          {work.hired && episode?.outcome === 'active' ? (
            <View style={styles.workNote}>
              <Text style={styles.workNoteText}>✓ {t('home_work_started')}</Text>
            </View>
          ) : null}

          {(work.hired || work.inTransit) ? (
            <>
              {work.hired && episode?.outcome === 'early_exit_pending' ? (
                <View style={styles.workAlert}>
                  <Text style={styles.workAlertText}>
                    {episode.end_requested_by === userId ? t('emp_pending_mine') : t('emp_pending_theirs')}
                  </Text>
                  {episode.end_requested_by === userId ? (
                    <TouchableOpacity style={styles.workBtnPrimary} onPress={doUndoLeave} activeOpacity={0.9}>
                      <Text style={styles.workBtnPrimaryText}>{t('emp_undo')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.workBtnPrimary} onPress={doAcceptLeave} activeOpacity={0.9}>
                        <Text style={styles.workBtnPrimaryText} numberOfLines={1}>{t('emp_accept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.workBtnGhost, { marginTop: 8 }]} onPress={doContestLeave} activeOpacity={0.9}>
                        <Text style={styles.workBtnGhostText} numberOfLines={1}>{t('emp_contest')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : work.hired && episode?.outcome === 'completion_pending' ? (
                <View style={styles.workAlert}>
                  <Text style={styles.workAlertText}>{t('emp_term_body')}</Text>
                  {episode.term_vote_candidate === 'ok' ? (
                    <Text style={styles.workNoteText}>{t('emp_term_waiting')}</Text>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.workBtnPrimary} onPress={() => doTermAnswer('ok')} activeOpacity={0.9}>
                        <Text style={styles.workBtnPrimaryText}>{t('emp_term_ok')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.workBtnGhost, { marginTop: 8 }]} onPress={() => doTermAnswer('problem')} activeOpacity={0.9}>
                        <Text style={styles.workBtnGhostText}>{t('emp_term_problem')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ) : work.hired && episode?.outcome === 'disputed' ? (
                <View style={styles.workNote}>
                  <Text style={styles.workAlertText}>{t('emp_disputed')}</Text>
                </View>
              ) : work.hired && work.expired ? (
                <View style={styles.workAlert}>
                  <Text style={styles.workAlertText}>{t('emp_term_body')}</Text>
                  <TouchableOpacity style={styles.workBtnPrimary} onPress={async () => {
                    try { await scanEmploymentLifecycle(); await loadStatus(); }
                    catch (e) { Alert.alert(t('work_title'), e?.message || 'error'); }
                  }} activeOpacity={0.9}>
                    <Text style={styles.workBtnPrimaryText}>{t('emp_term_ok')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {!work.hired && (certified || workHistory.length) ? (
          <View style={styles.workCard}>
            {certified ? <Text style={styles.workKicker}>🏅 {t('cert_badge')}</Text> : null}
            {workHistory.length ? (
              <>
                <Text style={styles.workActive}>{t('work_history_title')}</Text>
                {workHistory.slice(0, 5).map((h) => (
                  <View key={h.episode_id} style={styles.certRow}>
                    <Text style={[styles.workSub, { flex: 1 }]}>
                      {h.employer_title || '—'}
                      {h.ended_at ? ` · ${new Date(h.ended_at).toLocaleDateString()}` : ''}
                    </Text>
                    {h.outcome === 'completed' ? (
                      <TouchableOpacity
                        style={styles.certPdfBtn}
                        onPress={() => setCertEpisode(h)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.certPdfText}>{t('pdf_download')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}
          </View>
        ) : null}

        <CertificatePreview
          visible={!!certEpisode}
          data={d}
          episode={certEpisode}
          onClose={() => setCertEpisode(null)}
        />

        {/* Aday kartı */}
        <View style={styles.card}>
          {/* Kimlik satırı */}
          <View style={styles.cardHead}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (d.photo
                ? photoMenu('photo', [1, 1], t('photo_cap_id'))
                : pickHomePhoto('photo', [1, 1]))}
              disabled={!!photoBusy}
            >
              {d.photo ? (
                <Image source={{ uri: d.photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {photoBusy === 'photo'
                    ? <ActivityIndicator color="#c2a25a" />
                    : <Text style={styles.avatarIcon}>👤</Text>}
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.cardId}>
              <Text style={[styles.name, fontsReady && styles.nameFont]} numberOfLines={2}>{localeUpper(fullName, lang)}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.strip}>
            <View style={styles.stripRow}>
              {cells.slice(0, 2).map((c) => (
                <PhotoCell
                  key={c.field}
                  uri={c.uri}
                  caption={c.caption}
                  addLabel={t('photo_add')}
                  busy={photoBusy === c.field}
                  onView={() => {
                    const i = gallery.findIndex((g) => g.uri === c.uri);
                    if (i >= 0) setGalleryIndex(i);
                  }}
                  onAdd={() => pickHomePhoto(c.field, c.aspect)}
                  onMenu={() => photoMenu(c.field, c.aspect, c.caption)}
                />
              ))}
            </View>
            <View style={styles.stripRow}>
              {cells.slice(2).map((c) => (
                <PhotoCell
                  key={c.field}
                  uri={c.uri}
                  caption={c.caption}
                  addLabel={t('photo_add')}
                  busy={photoBusy === c.field}
                  onView={() => {
                    const i = gallery.findIndex((g) => g.uri === c.uri);
                    if (i >= 0) setGalleryIndex(i);
                  }}
                  onAdd={() => pickHomePhoto(c.field, c.aspect)}
                  onMenu={() => photoMenu(c.field, c.aspect, c.caption)}
                />
              ))}
              <VideoCell
                hasVideo={!!showVideo}
                busy={videoBusy}
                progress={videoProgress}
                phase={videoPhase}
                pending={isPending}
                caption={t('intro_video_cap')}
                addLabel={t('photo_add')}
                uploadLabel={videoPhase === 'compress' ? t('intro_video_processing') : t('intro_video_uploading')}
                onPlay={playVideo}
                onAdd={pickVideo}
                onMenu={videoMenu}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.cvBtn} onPress={onPreview} activeOpacity={0.85}>
            <Text style={styles.cvBtnText}>{t('home_view_cv')}  →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.footerGold} />
        <TouchableOpacity
          style={styles.footerTab}
          onPress={openAnnouncements}
          activeOpacity={0.85}
        >
          <View style={styles.footerIconWrap}>
            <FooterMegaphoneIcon color="#e7dcc4" size={20} />
            {announceUnread > 0 ? (
              <View style={styles.footerBadge}>
                <Text style={styles.footerBadgeText}>{announceUnread > 9 ? '9+' : announceUnread}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_announce_short')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerTab}
          onPress={() => setRemindersOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.footerIconWrap}>
            <FooterStopwatchIcon color="#e7dcc4" size={20} />
            {hasDocRemind ? (
              <Animated.View style={[styles.footerWarnDot, { opacity: remindBlink }]} />
            ) : null}
          </View>
          <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_remind_short')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerTab}
          onPress={() => setContactOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.footerIconWrap}>
            <ContactIcon color="#e7dcc4" size={20} />
          </View>
          <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_support_short')}</Text>
        </TouchableOpacity>
      </View>

      <PhotoGalleryModal
        visible={galleryIndex !== null}
        photos={gallery}
        index={galleryIndex ?? 0}
        onClose={() => setGalleryIndex(null)}
      />

      {/* Tanıtım videosu oynatıcı (WebView + HTML5 video) */}
      <Modal visible={!!videoPlayUrl} transparent animationType="fade" onRequestClose={() => setVideoPlayUrl(null)}>
        <View style={styles.videoModalWrap}>
          <View style={[styles.videoModalHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setVideoPlayUrl(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.videoModalX}>✕</Text>
            </TouchableOpacity>
          </View>
          {videoPlayUrl ? (
            <WebView
              source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video src="${videoPlayUrl}" controls autoplay playsinline style="max-width:100%;max-height:100vh"></video></body></html>` }}
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          ) : null}
        </View>
      </Modal>

      <ContactSheet
        visible={contactOpen}
        onClose={() => setContactOpen(false)}
        prefill={`${t('faq_chat_msg')}${fullName ? `\n${fullName}` : ''}`}
        name={fullName}
      />

      <AnnouncementsListSheet
        visible={announcementsOpen}
        onClose={() => {
          setAnnouncementsOpen(false);
          refreshAnnounceUnread();
        }}
        userId={userId}
      />

      <RemindersSheet
        visible={remindersOpen}
        onClose={() => {
          setRemindersOpen(false);
          loadStatus();
        }}
        userId={userId}
        onOpenDocs={onOpenDocs}
      />

      <CareerJourneySheet
        visible={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        current={journeyN}
        certified={certified}
        workStartYmd={workStartYmd}
        seasonEndAt={plannedEndAt || (work.end ? work.end.toISOString() : null)}
        seasonComplete={seasonCompleteFromEpisode(episode) || certified}
        onOpenStep={(step) => {
          if (step === 7) return; // adım 7 belgesiz — sadece geri sayım
          setJourneyOpen(false);
          onOpenDocs?.({ scrollToStep: step, returnToJourney: true });
        }}
      />

      <InterviewModal
        visible={interviewOpen}
        role="candidate"
        userId={userId}
        fontsReady={fontsReady}
        onClose={() => { setInterviewOpen(false); loadInterview(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  hero: { paddingLeft: 16, paddingRight: 16, paddingBottom: 12, backgroundColor: NAVY, zIndex: 2 },
  heroRule: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(194,162,90,0.38)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8 },
  heroLogo: { width: 94, height: 64 },
  heroHi: {
    color: '#c2a25a', fontSize: 16, fontWeight: '800', letterSpacing: 1.2,
    flexShrink: 1, flexGrow: 1, minWidth: 0, marginLeft: -4,
    lineHeight: 20,
  },
  heroTitle: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: 0.3 },
  heroTitleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  menuDots: { fontSize: 26, color: '#e7dcc4', fontWeight: '900', marginTop: -4 },

  // ⋮ ayarlar (acente ile aynı düzen; dil açılır kaydırma)
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.5)', justifyContent: 'flex-end' },
  menuSheet: {
    backgroundColor: '#f7f4ec', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden',
  },
  menuHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 3, backgroundColor: '#ddd2b8', marginBottom: 10 },
  menuHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  menuHeadTitle: { fontSize: 20, fontWeight: '900', color: INK, letterSpacing: 0.2 },
  menuCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ebe4d5', alignItems: 'center', justifyContent: 'center' },
  menuCloseX: { fontSize: 15, fontWeight: '800', color: '#5c6570' },
  menuScrollContent: { paddingBottom: 8 },
  menuSection: { fontSize: 11.5, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 },
  langDrop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6dfd0', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  langDropValue: { fontSize: 16, fontWeight: '800', color: INK, flex: 1, paddingRight: 8 },
  langDropChev: { fontSize: 14, color: '#9a7b1f', fontWeight: '800' },
  langDropList: {
    maxHeight: 220, marginTop: 8, backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e6dfd0', overflow: 'hidden',
  },
  langDropRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0eadc',
  },
  langDropRowOn: { backgroundColor: '#f3ecdc' },
  langDropName: { fontSize: 15.5, fontWeight: '600', color: '#2a3342' },
  langDropNameOn: { fontWeight: '800', color: '#8a6a1f' },
  langDropCheck: { fontSize: 15, fontWeight: '900', color: GOLD },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebe4d5',
  },
  menuPrivacyIcon: { width: 38, textAlign: 'center', fontSize: 18 },
  menuPrivacyText: { color: '#2a3342', fontWeight: '800', fontSize: 15 },
  menuPrivacyHint: { color: '#c2a25a', fontSize: 22, fontWeight: '300' },
  menuLogoutIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fbeae8', alignItems: 'center', justifyContent: 'center' },
  menuLogoutText: { color: '#b5413a', fontWeight: '800', fontSize: 15 },
  menuLogoutHint: { color: '#c9a9a4', fontSize: 22, fontWeight: '300' },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', backgroundColor: '#111820',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(194,162,90,0.35)',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: -8 }, elevation: 16,
    paddingTop: 10,
  },
  footerGold: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(194,162,90,0.55)' },
  footerTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  footerIconWrap: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
  },
  footerLogoWrap: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.4, borderColor: 'rgba(194,162,90,0.7)', overflow: 'hidden', backgroundColor: '#0a1018',
  },
  footerLogo: { width: 36, height: 36, borderRadius: 18 },
  footerLabel: { fontSize: 11, fontWeight: '800', color: '#e7dcc4', letterSpacing: 0.3 },
  footerBadge: {
    position: 'absolute', top: -2, right: -6, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#d24b40', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#111820',
  },
  footerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  footerWarnDot: {
    position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#e03b30', borderWidth: 1.5, borderColor: '#111820',
  },

  gridBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#b5413a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  gridBadgeGold: { backgroundColor: '#c2a25a' },
  gridBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Spotlight — havuzda canlı
  spot: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#16202e', borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#c2a25a', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  spotRadar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  spotRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#c2a25a' },
  spotRing2: { borderColor: '#dcc187' },
  spotCore: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(194,162,90,0.18)', borderWidth: 1.5, borderColor: '#c2a25a', alignItems: 'center', justifyContent: 'center' },
  spotEye: { fontSize: 22 },
  spotBody: { flex: 1 },
  spotKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  spotLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5fd08a' },
  spotKicker: { color: '#dcc187', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  spotTitle: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  spotSub: { color: '#9fb0c4', fontSize: 12.5, fontWeight: '500', lineHeight: 17, marginTop: 3 },

  // Tanıtım videosu kartı (CV kartıyla aynı beyaz dil)
  videoCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 18, marginTop: 4, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  videoHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  videoIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#f6efdd',
    borderWidth: 1, borderColor: '#eadfc2', alignItems: 'center', justifyContent: 'center',
  },
  videoKicker: { fontSize: 15.5, fontWeight: '800', color: '#1b2533', letterSpacing: 0.2 },
  videoOkBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e7f3ec', alignItems: 'center', justifyContent: 'center' },
  videoOkText: { color: '#1f8a4c', fontSize: 12, fontWeight: '900' },
  videoMotiv: { fontSize: 12.5, color: '#6b6457', fontWeight: '500', lineHeight: 19, marginBottom: 12 },
  videoFullbody: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16,
    backgroundColor: '#f6efdd', borderWidth: 1, borderColor: '#eadfc2',
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12,
  },
  videoFullbodyIcon: { fontSize: 18 },
  videoFullbodyText: { flex: 1, color: '#8a6a1f', fontWeight: '800', fontSize: 12.5, lineHeight: 17 },
  videoCta: { backgroundColor: '#c2a25a', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#a8842f', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  videoCtaText: { color: '#16202e', fontWeight: '800', fontSize: 15 },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoPreview: { alignSelf: 'center', width: 174, height: 309, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', marginBottom: 14, borderWidth: 1, borderColor: '#eadfc2' },
  videoPreviewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoFsBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  videoFsIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  videoWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#c0392b', borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e05b4d' },
  videoWarnIcon: { fontSize: 18 },
  videoWarnText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 13.5, lineHeight: 18 },
  videoUploading: { paddingVertical: 8 },
  videoBarTrack: { height: 8, borderRadius: 4, backgroundColor: '#eee8dc', overflow: 'hidden' },
  videoBarFill: { height: '100%', backgroundColor: '#c2a25a', borderRadius: 4 },
  videoUploadingText: { fontSize: 12, color: '#8a6a1f', fontWeight: '800', marginTop: 8, textAlign: 'center' },
  videoSaved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  videoLink: { fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  videoLinkSep: { color: '#c9ccd2', fontSize: 13 },
  videoPendingTag: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(194,162,90,0.95)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  videoPendingText: { color: '#16202e', fontSize: 10.5, fontWeight: '800' },
  videoCancelBtn: { flex: 1, backgroundColor: '#f4f5f7', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  videoCancelText: { color: '#1b2533', fontWeight: '800', fontSize: 13.5 },
  videoSaveBtn: { flex: 2, backgroundColor: '#1f8a4c', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  videoSaveText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  videoPlayBtn: { flex: 1, backgroundColor: '#16202e', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  videoPlayText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  videoSmallBtn: { paddingHorizontal: 10, paddingVertical: 11 },
  videoSmallText: { color: '#9a7b1f', fontWeight: '800', fontSize: 12.5 },
  videoAddBtn: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 13, alignItems: 'center', shadowColor: '#a8842f', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  videoAddText: { color: '#16202e', fontWeight: '800', fontSize: 14.5 },
  videoModalWrap: { flex: 1, backgroundColor: '#000' },
  videoModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#000' },
  videoModalX: { color: '#fff', fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 18 },

  // --- Üst başlık (acente paneliyle aynı) ---
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingBottom: 14, backgroundColor: '#1b2533', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5, zIndex: 2 },
  headerLogo: { width: 96, height: 60 },
  titleBox: { marginLeft: 6, marginRight: 14, flexShrink: 1 },
  acente: { color: '#c2a25a', fontSize: 27, fontWeight: '800' },
  acenteFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  acenteSub: { color: '#9aa4b1', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.8, marginTop: 1, textTransform: 'uppercase' },
  accent: { height: 2, backgroundColor: '#c2a25a', zIndex: 2 },
  settingsIcon: { fontSize: 22, color: '#e7dcc4' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  // --- Çalışma / personel kartı ---
  workCard: {
    backgroundColor: '#1b2533', borderRadius: 20, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
    marginBottom: 14,
  },
  workCardFocus: { opacity: 1 },
  workPulse: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    borderWidth: 0,
  },
  workKicker: { color: '#c2a25a', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 12 },
  workRow: { flexDirection: 'row', alignItems: 'center' },
  workActive: { color: '#fff', fontSize: 20, fontWeight: '800' },
  workStageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  workStageChev: { color: '#c2a25a', fontSize: 26, fontWeight: '600', marginTop: -2 },
  workMissBadge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#b5413a',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  workMissText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  workEmbed: { marginBottom: 0, marginTop: 14 },
  workEmbedBadge: { position: 'relative', top: 0, right: 0 },
  meter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 14 },
  meterLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 2 },
  meterLineOn: { backgroundColor: '#c2a25a' },
  meterDot: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(231,220,196,0.22)',
  },
  meterDotDone: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  meterDotNow: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#1b2533',
    borderWidth: 2, borderColor: '#c2a25a',
  },
  meterDotLock: { backgroundColor: 'transparent', borderColor: 'rgba(231,220,196,0.18)' },
  meterNum: { color: '#9aa4b1', fontSize: 11, fontWeight: '800' },
  meterNumDone: { color: '#1b2533' },
  meterNumNow: { color: '#c2a25a', fontSize: 13 },
  meterLock: { fontSize: 9, opacity: 0.55 },
  workSub: { color: '#9aa4b1', fontSize: 13, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  certPdfBtn: { backgroundColor: '#c2a25a', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  certPdfText: { color: '#1b2533', fontWeight: '800', fontSize: 11 },
  workAlert: {
    marginTop: 16, backgroundColor: 'rgba(232,181,176,0.12)', borderRadius: 14,
    padding: 14, gap: 10,
  },
  workAlertText: { color: '#e8b5b0', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  workNote: {
    marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14,
  },
  workNoteText: { color: '#c5ccd6', fontSize: 13.5, fontWeight: '600', lineHeight: 20 },
  workBtnPrimary: {
    backgroundColor: '#c2a25a', borderRadius: 12, minHeight: 48,
    paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  workBtnPrimaryText: { color: '#1b2533', fontWeight: '800', fontSize: 14.5, textAlign: 'center', lineHeight: 19 },
  workBtnDanger: {
    backgroundColor: '#fbeae8', borderRadius: 12, minHeight: 48,
    paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  workBtnDangerText: { color: '#a32d2d', fontWeight: '800', fontSize: 14.5, textAlign: 'center', lineHeight: 19 },
  workBtnGhost: {
    marginTop: 14, borderRadius: 12, minHeight: 46, borderWidth: 1.5, borderColor: 'rgba(194,162,90,0.5)',
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  workBtnGhostText: { color: '#e7dcc4', fontWeight: '800', fontSize: 14.5, textAlign: 'center' },
  workBtnDim: { opacity: 0.55 },
  workExpired: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 },
  workExpiredText: { color: '#e8b5b0', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  workReBtn: { backgroundColor: '#c2a25a', borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  workReText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },

  // --- Odak aksiyonu (belgeler / mülakat geri sayım) ---
  focusAction: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 14, borderWidth: 1.5, borderColor: '#eadfc2',
    shadowColor: '#1b2533', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  focusActionHot: { backgroundColor: '#f3faf5', borderColor: '#5fd08a' },
  focusActionIcon: { fontSize: 28 },
  focusActionBody: { flex: 1, minWidth: 0 },
  focusActionTitle: { color: '#1b2533', fontSize: 16.5, fontWeight: '800' },
  focusActionSub: { color: '#6b6457', fontSize: 13, fontWeight: '600', marginTop: 3, lineHeight: 18 },
  focusActionChev: { color: '#c2a25a', fontSize: 26, fontWeight: '600', marginTop: -2 },

  // --- Teklif kartı (kabul/ret) ---
  offerCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#d6e0ec', shadowColor: '#1b2533', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  offerKicker: { color: '#1f3a63', fontSize: 11.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  offerCardTitle: { color: '#1b2533', fontSize: 18, fontWeight: '800' },
  offerEmployerName: { color: '#1b2533', fontSize: 15, fontWeight: '800', marginBottom: 8 },
  opportunityMeta: { marginBottom: 10, paddingVertical: 2 },
  opportunityName: { color: '#1b2533', fontSize: 15, fontWeight: '800' },
  opportunityLocation: { color: '#5a5a6b', fontSize: 13, fontWeight: '600', marginTop: 4 },
  offerCardDesc: { color: '#5a5a6b', fontSize: 13.5, fontWeight: '500', lineHeight: 20 },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerDecline: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  offerDeclineText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },
  offerAccept: { flex: 2, backgroundColor: '#1f3a63', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  offerAcceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // --- Grup mülakatı daveti ---
  grpCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#eadfc2', shadowColor: '#1b2533', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  grpKicker: { color: '#9a7b1f', fontSize: 11.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grpWhen: { color: '#1b2533', fontSize: 16, fontWeight: '800' },
  grpBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  grpDecline: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  grpDeclineText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },
  grpAccept: { flex: 2, backgroundColor: '#1f8a4c', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  grpAcceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  grpDeclinedNote: { color: '#a32d2d', fontWeight: '700', fontSize: 13, marginTop: 10 },
  grpAcceptedNote: { color: '#1f8a4c', fontWeight: '800', fontSize: 14, marginTop: 10 },
  grpJoinBtn: { backgroundColor: '#1f8a4c', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  grpJoinText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // --- Aday kartı ---
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 18, marginTop: 2, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 68, height: 68, borderRadius: 18, backgroundColor: '#e9ebee' },
  avatarPlaceholder: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: '#1b2533', alignItems: 'center', justifyContent: 'center',
  },
  avatarIcon: { fontSize: 30 },
  cardId: { flex: 1, marginLeft: 14 },
  name: { fontSize: 20, fontWeight: '800', color: '#1b2533', letterSpacing: 0.4 },
  nameFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  subtitle: { fontSize: 13, color: '#737373', marginTop: 3 },
  count: { fontSize: 12.5, color: '#c2a25a', fontWeight: '700', marginTop: 6 },

  divider: { height: 1, backgroundColor: '#eef0f2', marginVertical: 16 },

  strip: { gap: 12 },
  stripRow: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  cellBox: { width: '100%', aspectRatio: 0.85, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef0f2' },
  cellImg: { width: '100%', height: '100%' },
  cellEmpty: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', backgroundColor: '#fafbfc',
  },
  cellPlus: { fontSize: 26, color: '#c2a25a', fontWeight: '700' },
  cellAdd: { fontSize: 12.5, color: '#c2a25a', fontWeight: '700', marginTop: 2 },
  cellCap: { fontSize: 12, color: '#6b6457', fontWeight: '700', textAlign: 'center', marginTop: 8 },
  // Galerideki tanıtım videosu hücresi (foto hücreleriyle aynı boy: cell + cellBox)
  videoCellMedia: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoCellLoading: { alignItems: 'center', justifyContent: 'center' },
  videoCellOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  videoCellBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoCellPlay: { color: '#fff', fontSize: 13, marginLeft: 2 },
  videoCellMenu: {
    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  videoCellMenuIcon: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: -4 },
  videoCellPending: {
    position: 'absolute', top: 4, left: 4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#c2a25a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 2,
  },
  videoCellPendingText: { color: '#16202e', fontSize: 10, fontWeight: '900' },
  videoBarTrack: { height: 5, borderRadius: 3, backgroundColor: '#eee8dc', overflow: 'hidden' },
  videoBarFill: { height: '100%', backgroundColor: '#c2a25a', borderRadius: 3 },
  videoModalWrap: { flex: 1, backgroundColor: '#000' },
  videoModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#000' },
  videoModalX: { color: '#fff', fontSize: 24, fontWeight: '800' },

  cvBtn: { marginTop: 16, backgroundColor: '#c2a25a', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  cvBtnText: { color: '#1b2533', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },

  docsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#1b2533', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  docsIcon: { fontSize: 20, marginRight: 12 },
  docsLabel: { flex: 1, fontSize: 15, color: '#1b2533', fontWeight: '700' },
  docsChev: { fontSize: 22, color: '#c2a25a', fontWeight: '700', marginLeft: 8 },
  missBadge: { marginLeft: 8 },
  missBadgeText: { fontSize: 12.5, fontWeight: '800', color: '#a32d2d', backgroundColor: '#fbeaea', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },

  modList: { marginTop: 26, borderTopWidth: 0.5, borderTopColor: '#dfe2e7' },
  modRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  modBorder: { borderBottomWidth: 0.5, borderBottomColor: '#dfe2e7' },
  modIcon: { fontSize: 20, marginRight: 14 },
  modLabel: { flex: 1, fontSize: 15, color: '#1b2533' },
  soonBadge: { backgroundColor: '#eef0f2', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  soonText: { fontSize: 11, fontWeight: '700', color: '#9aa1ac' },
  modChev: { fontSize: 22, color: '#c2a25a', fontWeight: '700' },
  ivBadge: { backgroundColor: '#d24b40', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginRight: 8 },
  ivBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

});
