// screens/AgencyHomeScreen.js
// Acente paneli — premium aday havuzu (2 sütun foto galeri + alt bilgi).
// Arama yok; bulma ⚙ Filtreler (tam ekran) ile. FlatList sanallaştırma + sonsuz kaydırma.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, FlatList, SectionList, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Keyboard, Modal, Pressable, useWindowDimensions, Animated, Linking, Platform } from 'react-native';
import Svg, { Line, Circle, Path, Polyline, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listCandidates, listCandidateIds, listStatuses, listCandidatesWithDocs, offerCandidate, findCandidateByCode, findCandidatesByName, listInterviewCandidates, listStaff, listInProcess, listInTransit, declineInterview, getCandidateById } from '../lib/roles';
import { listFormerStaff, scanEmploymentLifecycle, isEmploymentNotif, candidateIdFromNotif } from '../lib/employment';
import { updateMyProfile, getSession } from '../lib/auth';
import { candidateCode, parseCode, maskedName } from '../lib/candidateCode';
import { formatLastSeen, lastSeenTier } from '../lib/lastSeenFormat';
import { slotDateKey, slotTime, weekdayOf, fromISO, formatCountdown, cancelInterview } from '../lib/interviews';
import { callWindow, JOIN_PERIOD_MIN } from '../lib/livekitCall';
import { scanOps, notifyOffer } from '../lib/push';
import { Select } from '../components/Select';
import { DAYS, monthOptions, FLIGHT_YEARS } from '../cv/options';
import AgencyFilterSheet from '../components/AgencyFilterSheet';
import NotificationBell from '../components/NotificationBell';
import PhotoWatermark from '../components/PhotoWatermark';
import AgencyOpsDesk from '../components/AgencyOpsDesk';
import AgencyHotelsPanel from '../components/AgencyHotelsPanel';
import AgencyNoticeSheet from '../components/AgencyNoticeSheet';
import AgencyChatInboxSheet from '../components/AgencyChatInboxSheet';
import AgencyRemindersSheet from '../components/AgencyRemindersSheet';
import AnnouncementsListSheet from '../components/AnnouncementsListSheet';
import ContactSheet from '../components/ContactSheet';
import { LANGUAGES_ALPHA, nameOf } from '../i18n/languages';
import { getAgencyNotifPrefs, setAgencyNotifPrefs } from '../lib/agencyNotifPrefs';
import {
  getAgencyProfile, saveAgencyTaxPlate, getAgencyTaxPlateUrl, updateAgencyCompanyName,
} from '../lib/agencyProfile';
import { agencyCode } from '../lib/agencyCode';
import { syncChatLang } from '../lib/processChat';
import { enrichProcessProgress, unreadChatCount, loadAgencyOps } from '../lib/ops';
import { attachEmployers, groupByEmployer, withFormerEmployerFields } from '../lib/employerAttach';
import { urgentTotal } from '../lib/opsUi';
import { unreadAnnouncementCount } from '../lib/notifications';
import { listRatingStats } from '../lib/ratings';
import RatingBadge from '../components/RatingBadge';
import { listFavoriteCandidates, removeFavorite } from '../lib/favorites';
import {
  readAgencyHomeUi, writeAgencyHomeUi, resetAgencyHomeUi,
  PIPELINE_STAGES_PRIMARY, PIPELINE_STAGES_MORE, normalizeAgencyView, normalizePipelineStage,
  isProcessPipelineStage, isStaffPipelineStage, isPipelineMoreStage, stageFromOpsNav,
} from '../lib/agencyHomeUi';
import AgencyArrivals from '../components/AgencyArrivals';
import { supabase } from '../lib/supabase';
import ProcessChatSheet from '../components/ProcessChatSheet';
import EmployerStampListSheet from '../components/EmployerStampListSheet';

const PAGE = 24;
const FOOTER_LOGO = require('../assets/icon-dark.png');
const FOOTER_CONTENT_PAD = 78;

// Uyruk -> ülke bayrağı (elimizde olanlar; diğerlerinde bayrak gösterilmez).
const NATION_FLAG = {
  'Türkiye': require('../assets/flags/tr.png'),
  'Kazakistan': require('../assets/flags/kk.png'),
  'Kırgızistan': require('../assets/flags/ky.png'),
  'Özbekistan': require('../assets/flags/uz.png'),
  'Rusya': require('../assets/flags/ru.png'),
  'Tayland': require('../assets/flags/th.png'),
  'Türkmenistan': require('../assets/flags/tk.png'),
};

const pressHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const tapHaptic = () => Haptics.selectionAsync().catch(() => {});
// Modern "sliders" filtre ikonu (3 yatay çizgi + düğme)
function FilterIcon({ color = '#1b2533', knobFill = '#eef0f2', size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="3" y1="7" x2="21" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="17" x2="21" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="15" cy="7" r="3.2" fill={knobFill} stroke={color} strokeWidth="2" />
      <Circle cx="8" cy="12" r="3.2" fill={knobFill} stroke={color} strokeWidth="2" />
      <Circle cx="16" cy="17" r="3.2" fill={knobFill} stroke={color} strokeWidth="2" />
    </Svg>
  );
}

// Modern çıkış (logout) ikonu — kapıdan çıkan ok
function LogoutIcon({ color = '#cbd2db', size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
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

function SearchIcon({ color = '#fff', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <Line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function CalIcon({ color = '#9a7b1f', size = 15 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4.5" width="18" height="17" rx="3" stroke={color} strokeWidth="1.8" />
      <Line x1="3" y1="9.5" x2="21" y2="9.5" stroke={color} strokeWidth="1.8" />
      <Line x1="8" y1="2.5" x2="8" y2="6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="16" y1="2.5" x2="16" y2="6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function countFilters(f) {
  if (!f) return 0;
  let n = 0;
  if (f.codeNation || f.regNo) n += 1;
  if (f.ageMin || f.ageMax) n += 1;
  if (f.gender) n += 1;
  if (f.employmentStatus) n += 1;
  if (f.turquzCertified) n += 1;
  if (f.availableMonths && f.availableMonths.length) n += 1;
  ['nationalities', 'positions', 'languages', 'skills'].forEach((k) => { if (f[k] && f[k].length) n += 1; });
  return n;
}

function PrefSwitch({ on, onToggle }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={[styles.swTrack, on && styles.swTrackOn]}
    >
      <View style={[styles.swThumb, on && styles.swThumbOn]} />
    </TouchableOpacity>
  );
}

function FooterMegaphoneIcon({ color = '#e7dcc4', size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10.2v3.6c0 .7.5 1.3 1.2 1.4l3.3.5 2.2 3.8c.3.5 1.1.3 1.1-.3v-2.8l6.2 1.1c1.1.2 2-.7 2-1.8V9.1c0-1.1-.9-2-2-1.8l-6.2 1.1V5.8c0-.6-.8-.8-1.1-.3L7.9 9.3l-3.3.5c-.6.1-1.1.7-1.1 1.4Z"
        stroke={color} strokeWidth="1.7" strokeLinejoin="round"
      />
      <Path d="M19.8 9.6c.8.7.8 2.1 0 2.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function FooterStopwatchIcon({ color = '#e7dcc4', size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13.2" r="7.2" stroke={color} strokeWidth="1.8" />
      <Path d="M12 13.2V9.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M10 3.6h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 3.6v2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M17.6 7.2l1.2-1.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function FooterChatIcon({ color = '#e7dcc4', size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-4.2L8.2 21.1c-.72.5-1.7-.02-1.7-.86V17A4 4 0 0 1 4 13V7Z"
        stroke={color} strokeWidth="1.7" strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AgencyHomeScreen({ userId, onOpenCandidate, onLogout, fontsReady }) {
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [docIds, setDocIds] = useState(new Set()); // kendi belgesini yüklemiş aday user_id'leri
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const savedUi = readAgencyHomeUi();
  const [advFilters, setAdvFilters] = useState(() => savedUi.advFilters || {});
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [hubCompose, setHubCompose] = useState(false);
  const [hubNotice, setHubNotice] = useState(null);
  const [hubIds, setHubIds] = useState([]);
  const [hubPeople, setHubPeople] = useState([]);
  const [hubNonce, setHubNonce] = useState(0);
  const [codeInput, setCodeInput] = useState('');
  const [codeChips, setCodeChips] = useState([]); // koda göre eklenenler {user_id, code, photo}
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const filterKey = JSON.stringify(advFilters);
  const activeCount = countFilters(advFilters);
  const [menuOpen, setMenuOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [taxBusy, setTaxBusy] = useState(false);
  // Acente bilgilerini düzenle modalı
  const [profOpen, setProfOpen] = useState(false);
  const [profFirst, setProfFirst] = useState('');
  const [profLast, setProfLast] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profCompany, setProfCompany] = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [profErr, setProfErr] = useState('');

  const refreshAgencyProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await getAgencyProfile(userId);
      setAgencyProfile(p);
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { refreshAgencyProfile(); }, [refreshAgencyProfile]);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(show, () => setKbOpen(true));
    const s2 = Keyboard.addListener(hide, () => setKbOpen(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const openSettings = () => {
    setLangOpen(false);
    setMenuOpen(true);
    refreshAgencyProfile();
  };

  const openProfile = async () => {
    setMenuOpen(false);
    try {
      const { session } = await getSession();
      const m = session?.user?.user_metadata || {};
      setProfFirst(m.first_name || '');
      setProfLast(m.last_name || '');
      setProfPhone(m.phone || '');
      const p = agencyProfile || await getAgencyProfile(userId);
      setProfCompany(p?.companyName || '');
    } catch (e) {
      setProfFirst(''); setProfLast(''); setProfPhone(''); setProfCompany('');
    }
    setProfErr(''); setProfOpen(true);
  };
  const saveProfile = async () => {
    const f = profFirst.trim(), l = profLast.trim(), p = profPhone.trim();
    if (!f || !l || !p) { setProfErr('Ad, soyad ve telefon zorunludur.'); return; }
    if (p.replace(/\D/g, '').length < 10) { setProfErr('Geçerli bir telefon numarası girin.'); return; }
    setProfErr(''); setProfBusy(true);
    const { error } = await updateMyProfile({ firstName: f, lastName: l, phone: p });
    if (error) { setProfBusy(false); setProfErr(error.message || 'Kaydedilemedi'); return; }
    try {
      await updateAgencyCompanyName(userId, profCompany);
      await refreshAgencyProfile();
    } catch (e) {
      setProfBusy(false);
      setProfErr(e?.message || 'Şirket adı kaydedilemedi');
      return;
    }
    setProfBusy(false);
    setProfOpen(false);
  };

  const pickTaxPdf = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const { File } = await import('expo-file-system');
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const isPdf = (asset.mimeType || '').includes('pdf') || (asset.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { Alert.alert(t('agency_tax_section'), t('agency_tax_pdf_only') || 'Yalnızca PDF yükleyin.'); return; }
      setTaxBusy(true);
      const base64 = await new File(asset.uri).base64();
      await saveAgencyTaxPlate(userId, base64);
      await refreshAgencyProfile();
    } catch (e) {
      Alert.alert(t('agency_tax_section'), e?.message || 'PDF yüklenemedi');
    } finally {
      setTaxBusy(false);
    }
  };

  const viewTaxPdf = async () => {
    try {
      setTaxBusy(true);
      const url = await getAgencyTaxPlateUrl(userId);
      if (!url) { Alert.alert(t('agency_tax_section'), t('agency_tax_missing') || 'Vergi levhası yok.'); return; }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t('agency_tax_section'), e?.message || 'Açılamadı');
    } finally {
      setTaxBusy(false);
    }
  };

  const [searchOpen, setSearchOpen] = useState(false); // header'da açılır arama
  const [pipeStepFilter, setPipeStepFilter] = useState(null); // 1–6 | null
  const [view, setView] = useState(() => normalizeAgencyView(savedUi.view)); // ops | pool | pipeline | hotels
  const [kbOpen, setKbOpen] = useState(false);
  const [pipelineStage, setPipelineStage] = useState(() => normalizePipelineStage(savedUi.pipelineStage, savedUi));
  const [ivList, setIvList] = useState([]);
  const [inProcessList, setInProcessList] = useState([]);
  const [offeredList, setOfferedList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [ivSortDesc, setIvSortDesc] = useState(true);   // yeni -> eski
  // Havuz sıralaması: son görünürlük (yeniden eskiye) | eskiden yeniye | CV tarihi
  const [poolSort, setPoolSort] = useState(() => savedUi.poolSort || 'online'); // online | online_old
  const subView = isProcessPipelineStage(pipelineStage) ? pipelineStage : 'interviews';
  const [formerList, setFormerList] = useState([]);
  const [transitList, setTransitList] = useState([]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState({ s: null, e: null }); // seçili tarih aralığı (Date)
  const [draftFrom, setDraftFrom] = useState({ d: '', m: '', y: '' });
  const [draftTo, setDraftTo] = useState({ d: '', m: '', y: '' });
  const [nowTick, setNowTick] = useState(Date.now());
  const [chatBadge, setChatBadge] = useState(0);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const [remindWarn, setRemindWarn] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [chatPeer, setChatPeer] = useState(null); // { id, label } — inbox’tan açılan sohbet
  const remindBlink = React.useRef(new Animated.Value(1)).current;

  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const [ratingMap, setRatingMap] = useState({}); // user_id -> { avg, count }
  const [favOn, setFavOn] = useState(() => !!savedUi.favOn);

  // Aday detayına gidip gelince unmount olmasın diye UI durumunu sakla.
  useEffect(() => {
    writeAgencyHomeUi({ view, pipelineStage, poolSort, advFilters, favOn });
  }, [view, pipelineStage, poolSort, advFilters, favOn]);

  // Tarama + tercih yükleme: dil değişiminde TEKRAR ÇALIŞMASIN (menü donmasını önler).
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    scanOps();
    getAgencyNotifPrefs().then((p) => {
      if (!alive) return;
      setGeneralPush(p.generalPush);
      setChatPush(p.chatPush);
    });
    return () => { alive = false; };
  }, [userId]);

  // Dil değişince yalnız sohbet dilini senkronla (listeyi yeniden çekme).
  useEffect(() => {
    if (!userId) return;
    syncChatLang(lang);
  }, [userId, lang]);

  // Mülakat listesinde geri sayım / katıl penceresi için tick.
  useEffect(() => {
    if (!(view === 'pipeline' && pipelineStage === 'interviews')) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, pipelineStage]);

  // Süreç / Personel sekmesine geçince ilgili listeleri yükle.
  const reloadProcess = useCallback(async () => {
    const [ivs, inp] = await Promise.all([listInterviewCandidates(userId), listInProcess(userId)]);
    const enriched = await enrichProcessProgress(inp);
    const [ivAttached, inAttached] = await Promise.all([
      attachEmployers(userId, ivs),
      attachEmployers(userId, enriched),
    ]);
    setIvList(ivAttached);
    setInProcessList(inAttached);
  }, [userId]);

  const reloadOffered = useCallback(async () => {
    const st = await listStatuses();
    setStatuses(st);
    const ids = Object.keys(st).filter((id) => st[id]?.status === 'offered' && st[id]?.accepted_by === userId);
    if (!ids.length) { setOfferedList([]); return; }
    const rows = await Promise.all(ids.map((id) => getCandidateById(id)));
    const list = rows.filter(Boolean).map((r) => ({ ...r, st: st[r.user_id] }));
    setOfferedList(await attachEmployers(userId, list));
  }, [userId]);

  useEffect(() => {
    if (view === 'pool' || view === 'ops' || view === 'hotels') return undefined;
    let alive = true;
    (async () => {
      setListLoading(true);
      const needProcess = view === 'pipeline' && isProcessPipelineStage(pipelineStage);
      const needStaff = view === 'pipeline' && isStaffPipelineStage(pipelineStage);
      if (needProcess) {
        await reloadProcess();
        if (pipelineStage === 'offered') await reloadOffered();
      }
      if (needStaff) {
        const [rows, former, transit] = await Promise.all([
          listStaff(userId),
          listFormerStaff(userId),
          listInTransit(userId),
        ]);
        if (alive) {
          const [staffAttached, transitAttached] = await Promise.all([
            attachEmployers(userId, rows),
            attachEmployers(userId, transit),
          ]);
          setStaffList(staffAttached);
          setFormerList(withFormerEmployerFields(former));
          setTransitList(transitAttached);
        }
        scanEmploymentLifecycle();
      }
      if (alive) setListLoading(false);
    })();
    return () => { alive = false; };
  }, [view, pipelineStage, userId, reloadProcess, reloadOffered]);

  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const [chatN, annN, ops] = await Promise.all([
          unreadChatCount(userId),
          unreadAnnouncementCount(userId),
          loadAgencyOps(userId),
        ]);
        if (!alive) return;
        setChatBadge(chatN || 0);
        setAnnounceUnread(annN || 0);
        setRemindWarn(urgentTotal(ops?.metrics || {}) > 0);
      } catch { /* ignore */ }
    };
    tick();
    const tmr = setInterval(tick, 20000);
    const ch = supabase
      .channel(`agency-chat-badge-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (row?.type === 'chat_message') tick();
        },
      )
      .subscribe();
    return () => { alive = false; clearInterval(tmr); supabase.removeChannel(ch); };
  }, [userId, view]);

  useEffect(() => {
    if (!remindWarn) {
      remindBlink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(remindBlink, { toValue: 0.2, duration: 550, useNativeDriver: true }),
        Animated.timing(remindBlink, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [remindWarn, remindBlink]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let rows;
      if (favOn) {
        rows = await listFavoriteCandidates(userId);
        const [st, dids] = await Promise.all([listStatuses(), listCandidatesWithDocs()]);
        if (!alive) return;
        setItems(rows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(false); setLoading(false);
        return;
      }
      const [poolRows, st, dids] = await Promise.all([
        listCandidates({ filters: advFilters, from: 0, to: PAGE - 1, sort: poolSort }),
        listStatuses(),
        listCandidatesWithDocs(),
      ]);
      if (!alive) return;
      setItems(poolRows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(poolRows.length === PAGE); setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, poolSort, favOn, userId]);

  // Havuz + süreç listelerindeki adayların açık puan özeti
  useEffect(() => {
    const ids = [
      ...items.map((c) => c.user_id),
      ...ivList.map((c) => c.user_id),
      ...inProcessList.map((c) => c.user_id),
      ...staffList.map((c) => c.user_id),
    ];
    if (!ids.length) return undefined;
    let alive = true;
    listRatingStats(ids).then((m) => { if (alive) setRatingMap((prev) => ({ ...prev, ...m })); });
    return () => { alive = false; };
  }, [items, ivList, inProcessList, staffList]);

  const loadMore = useCallback(async () => {
    if (favOn || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const next = page + 1;
    const rows = await listCandidates({ filters: advFilters, from: next * PAGE, to: next * PAGE + PAGE - 1, sort: poolSort });
    setItems((prev) => [...prev, ...rows]); setPage(next); setHasMore(rows.length === PAGE); setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, loading, page, filterKey, poolSort, favOn]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (favOn) {
      const [rows, st, dids] = await Promise.all([
        listFavoriteCandidates(userId),
        listStatuses(),
        listCandidatesWithDocs(),
      ]);
      setItems(rows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(false);
      setRefreshing(false);
      return;
    }
    const [rows, st, dids] = await Promise.all([
      listCandidates({ filters: advFilters, from: 0, to: PAGE - 1, sort: poolSort }),
      listStatuses(),
      listCandidatesWithDocs(),
    ]);
    setItems(rows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(rows.length === PAGE);
    setRefreshing(false);
  };

  const isAccepted = (id) => statuses[id]?.status === 'accepted';
  const isOffered = (id) => statuses[id]?.status === 'offered';
  // pending = havuzda; offered = teklif gitti (cevap bekleniyor); active = aday KABUL etti (süreçte)
  const category = (id) => (isAccepted(id) ? 'active' : isOffered(id) ? 'offered' : 'pending');
  const isSelected = (id) => selectedIds.includes(id);

  // Bildirime tıklayınca: ilgili adayı aç (chat_message → sohbet).
  const NOTIF_TO_CANDIDATE = [
    'interview_scheduled', 'document', 'offer_accepted', 'offer_rejected', 'docs_deadline', 'docs_extra',
    'chat_message', 'boarding_missed', 'boarding_no_response', 'boarding_confirmed', 'flight_ticket_sent',
    'work_start_confirm', 'work_start_remind', 'transit_stalled', 'employment_started',
    'arrival_today', 'arrival_tomorrow',
  ];
  const onNotifNavigate = async (n) => {
    if (!n?.type) return;
    if (!NOTIF_TO_CANDIDATE.includes(n.type) && !isEmploymentNotif(n.type)) return;
    const candId = isEmploymentNotif(n.type)
      ? await candidateIdFromNotif(n)
      : (n.payload?.candidateId || n.ref_user);
    if (!candId) return;
    try {
      let c = await getCandidateById(candId);
      if (!c) c = staffList.find((r) => r.user_id === candId) || null;
      if (!c) {
        const f = formerList.find((r) => r.candidate_id === candId || r.user_id === candId);
        if (f) c = { user_id: f.candidate_id || f.user_id, title: f.employer_title || f.title, data: f.data || {}, reg_no: f.reg_no, nationality: f.nationality };
      }
      if (c) {
        onOpenCandidate(c, {
          ...(statuses[candId] || {}),
          ...(n.type === 'chat_message' ? { _openChat: true } : {}),
          // Uçak kaçırma: bileti aday alır — bilet yükleme sheet otomatik açılmaz
          ...(n.payload?.openWorkStart && n.type !== 'boarding_missed'
            ? { _openWorkStart: true } : {}),
          ...(n.type === 'boarding_no_response' || n.payload?.openBoardingResolve
            ? { status: 'in_transit' } : {}),
          ...((n.type === 'work_start_confirm' || n.type === 'work_start_remind' || n.type === 'transit_stalled' || n.payload?.openHireConfirm)
            ? { _openHireConfirm: true, status: 'in_transit' } : {}),
          ...((n.type === 'rating_required' || n.type === 'rating_remind' || n.payload?.openRate)
            ? { _openRate: true, status: 'new' } : {}),
        });
      }
    } catch (e) { /* yoksay */ }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const exitSelect = () => { setSelectMode(false); setSelectedIds([]); setCodeChips([]); setCodeInput(''); setCodeError(false); setNoticeOpen(false); };

  // Kod veya isimle aday bul: seçim modunda seçime ekle; tek sonuçta aç; çok sonuçta havuzu filtrele.
  const handleCode = async () => {
    const raw = String(codeInput || '').trim();
    if (!raw) { setCodeError(true); return; }
    setCodeBusy(true); setCodeError(false);
    try {
      const parsed = parseCode(raw);
      let rows = [];
      if (parsed) {
        const row = await findCandidateByCode(parsed.nationality, parsed.regNo);
        if (row) rows = [row];
      } else {
        rows = await findCandidatesByName(raw);
      }
      if (!rows.length) { setCodeError(true); return; }
      Keyboard.dismiss();
      setCodeInput('');
      if (selectMode) {
        setSelectedIds((prev) => {
          const next = [...prev];
          rows.forEach((row) => { if (!next.includes(row.user_id)) next.push(row.user_id); });
          return next;
        });
        setCodeChips((prev) => {
          const next = [...prev];
          rows.forEach((row) => {
            if (next.find((c) => c.user_id === row.user_id)) return;
            const code = candidateCode(row.nationality || row.data?.nationality, row.reg_no);
            next.push({ user_id: row.user_id, code, photo: row.data?.photoClose || row.data?.photo || row.data?.photoFull });
          });
          return next;
        });
      } else if (rows.length === 1) {
        onOpenCandidate(rows[0], statuses[rows[0].user_id]);
      } else {
        setView('pool');
        setItems(rows);
        setPage(0);
        setHasMore(false);
        setSearchOpen(false);
      }
    } finally {
      setCodeBusy(false);
    }
  };

  const removeChip = (id) => {
    setCodeChips((prev) => prev.filter((c) => c.user_id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  // Filtreye uyan TÜM adayları seç (toggle: hepsi seçiliyse temizle).
  const selectAllFiltered = async () => {
    const ids = await listCandidateIds({ filters: advFilters });
    if (ids.length && ids.every((id) => selectedIds.includes(id))) setSelectedIds([]);
    else setSelectedIds(ids);
  };

  const onCardPress = (c) => {
    Keyboard.dismiss();
    if (selectMode) { tapHaptic(); toggleSelect(c.user_id); }
    else onOpenCandidate(c, statuses[c.user_id]);
  };

  // Uzun bas: titreşim + seçim modunu aç/kapa (tekrar uzun basınca her şey eskiye döner).
  const onCardLongPress = (c) => {
    pressHaptic();
    if (selectMode) exitSelect();
    else { setSelectMode(true); toggleSelect(c.user_id); }
  };

  // Toplu teklif: seçili adayların hepsine teklif gönder.
  const bulkOffer = () => {
    if (!selectedIds.length) return;
    Alert.alert(t('agency_offer'), t('agency_bulk_confirm', { n: selectedIds.length }), [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('agency_offer'),
        onPress: async () => {
          setBulkBusy(true);
          try {
            for (const id of selectedIds) {
              // eslint-disable-next-line no-await-in-loop
              await offerCandidate(id);
              notifyOffer(id, 'offer');
            }
            const st = await listStatuses();
            setStatuses(st);
            exitSelect();
          } catch (e) {
            Alert.alert(t('agency_offer'), e?.message || 'error');
          } finally {
            setBulkBusy(false);
          }
        },
      },
    ]);
  };

  // Havuzda müsait adaylara rozet yok — sadece teklifli / süreçte belirgin olsun.
  const PILL = {
    offered: { box: styles.pillOffered, dot: styles.dotOffered, txt: styles.pillTextOffered, label: t('agency_filter_offered') },
    active: { box: styles.pillActive, dot: styles.dotActive, txt: styles.pillTextActive, label: t('agency_filter_active') },
  };

  const removeFromFavList = async (candidateId) => {
    if (!favOn || !candidateId) return;
    try {
      await removeFavorite(userId, candidateId);
      setItems((prev) => prev.filter((r) => r.user_id !== candidateId));
      tapHaptic();
    } catch (e) {
      Alert.alert(t('fav_remove'), e?.message || 'error');
    }
  };

  const renderItem = ({ item: c }) => {
    const cat = category(c.user_id);
    const pill = PILL[cat] || null;
    const photo = c.data?.photoClose || c.data?.photo || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality];
    const sel = isSelected(c.user_id);
    const name = maskedName(c.data) || code;
    const showUnfav = favOn && !selectMode;
    return (
      <TouchableOpacity style={[styles.fbCard, sel && styles.fbCardSel]} onPress={() => onCardPress(c)} onLongPress={() => onCardLongPress(c)} delayLongPress={300} activeOpacity={0.92}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.fbPhoto} resizeMode="cover" />
        ) : (
          <View style={[styles.fbPhoto, styles.photoPh]}><Text style={styles.photoIcon}>👤</Text></View>
        )}
        <PhotoWatermark size={26} margin={8} />
        {/* Çok hafif alt fade — sadece isim okunaklılığı; fotoğrafı karartmasın */}
        <View style={styles.fbScrim} pointerEvents="none" />
        {flag ? <Image source={flag} style={styles.fbFlag} resizeMode="cover" /> : null}
        {ratingMap[c.user_id] ? (
          <View style={[styles.fbRateBadge, (selectMode || showUnfav) && styles.fbRateBadgeSelect]} pointerEvents="none">
            <RatingBadge avg={ratingMap[c.user_id].avg} count={ratingMap[c.user_id].count} compact onDark float />
          </View>
        ) : null}
        {showUnfav ? (
          <TouchableOpacity
            style={styles.fbUnfav}
            onPress={() => removeFromFavList(c.user_id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.85}
            accessibilityLabel={t('fav_remove')}
          >
            <Text style={styles.fbUnfavText}>✕</Text>
          </TouchableOpacity>
        ) : null}
        {selectMode ? (
          <View style={[styles.checkbox, sel && styles.checkboxOn]}>
            {sel ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
        ) : null}
        <View style={styles.fbInfo} pointerEvents="none">
          {pill ? (
            <View style={[styles.fbPill, pill.box]}>
              <View style={[styles.dot, pill.dot]} />
              <Text style={[styles.pillText, pill.txt]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{pill.label}</Text>
            </View>
          ) : null}
          <Text style={styles.fbName} numberOfLines={1}>{name}</Text>
          <Text style={styles.fbSub} numberOfLines={1}>{code}{c.title ? `  ·  ${c.title}` : ''}</Text>
        </View>
        <View style={styles.fbOnlineWrap} pointerEvents="none">
          <View style={[styles.fbOnlinePill, styles[`fbOnline_${lastSeenTier(c.last_seen_at)}`] || styles.fbOnline_stale]}>
            <View style={[styles.fbOnlineDot, styles[`fbOnlineDot_${lastSeenTier(c.last_seen_at)}`] || styles.fbOnlineDot_stale]} />
            <Text style={styles.fbOnlineText}>{formatLastSeen(c.last_seen_at, t)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Aktif mod: pool dışındayken hangi alt liste gösteriliyor.
  const mode = view === 'pipeline'
    ? (isStaffPipelineStage(pipelineStage) ? 'staff' : pipelineStage)
    : view; // interviews | concluded | offered | inprocess | staff
  const canNoticeSelect =
    view === 'pipeline' && (
      pipelineStage === 'offered' || pipelineStage === 'inprocess'
      || pipelineStage === 'staff' || pipelineStage === 'transit'
    );

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds([]);
    setCodeChips([]);
  }, [view, pipelineStage]);

  // Premium kart — moda göre rozet/aksiyon değişir.
  const renderRich = ({ item: c }) => {
    const photo = c.data?.photoClose || c.data?.photo || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality || c.nationality];
    const sel = isSelected(c.user_id);
    let badgeLabel = ''; let badgeStyle = styles.bMuted; let dotColor = '#9aa1ac';
    let dateDay = ''; let dateTime = ''; let strip = 'none'; // none | gold | red

    if (mode === 'interviews') {
      if (c.ivStatus === 'scheduled') {
        badgeLabel = t('iv_will_attend'); badgeStyle = styles.bGreen; dotColor = '#1f8a4c';
        dateDay = `${weekdayOf(c.ivSlot, lang)}, ${slotDateKey(c.ivSlot)}`; dateTime = slotTime(c.ivSlot); strip = 'gold';
      } else {
        badgeLabel = t('iv_waiting_label'); badgeStyle = styles.bAmber; dotColor = '#d99221';
      }
    } else if (mode === 'concluded') {
      badgeLabel = t('sub_concluded'); badgeStyle = styles.bMuted; dotColor = '#6b7280';
      if (c.ivSlot) { dateDay = `${weekdayOf(c.ivSlot, lang)}, ${slotDateKey(c.ivSlot)}`; dateTime = slotTime(c.ivSlot); strip = 'gold'; }
    } else if (mode === 'offered') {
      badgeLabel = t('agency_filter_offered') || 'Teklifli'; badgeStyle = styles.bAmber; dotColor = '#1f3a63';
    } else if (mode === 'inprocess') {
      const turn = c.turn === 'agency'
        ? (t('turn_agency') || 'Sıra sizde')
        : (t('turn_candidate') || 'Aday bekleniyor');
      const step = c.titleKey ? (t(c.titleKey) || `Adım ${c.pipeStep}`) : (c.pipeStep ? `Adım ${c.pipeStep}` : '');
      badgeLabel = step ? `${step} · ${turn}` : (t('in_process_label') || 'Süreçte');
      badgeStyle = c.turn === 'agency' ? styles.bAmber : styles.bGreen;
      dotColor = c.turn === 'agency' ? '#9a7b1f' : '#1f8a4c';
    } else { // staff
      const end = c.work_end_at ? new Date(c.work_end_at) : null;
      const expired = end ? Date.now() >= end.getTime() : false;
      badgeLabel = expired ? t('staff_expired') : t('staff_active');
      badgeStyle = expired ? styles.bRed : styles.bGreen; dotColor = expired ? '#a32d2d' : '#1f8a4c';
      if (end) { dateDay = `${weekdayOf(end.toISOString(), lang)}, ${fmtRange(end)}`; strip = expired ? 'red' : 'gold'; }
    }

    return (
      <TouchableOpacity
        style={[styles.rich, sel && styles.richSel]}
        onPress={() => {
          if (canNoticeSelect && selectMode) { tapHaptic(); toggleSelect(c.user_id); return; }
          onOpenCandidate(c, mode === 'staff'
            ? { ...(statuses[c.user_id] || {}), status: 'hired', docs_unlocked: true }
            : statuses[c.user_id]);
        }}
        onLongPress={canNoticeSelect ? () => {
          pressHaptic();
          if (selectMode) exitSelect();
          else { setSelectMode(true); toggleSelect(c.user_id); }
        } : undefined}
        delayLongPress={300}
        activeOpacity={0.92}
      >
        <View style={styles.richTop}>
          <View style={styles.richPhotoBox}>
            {photo ? <Image source={{ uri: photo }} style={styles.richPhoto} resizeMode="cover" /> : <View style={[styles.richPhoto, styles.photoPh]}><Text style={styles.photoIcon}>👤</Text></View>}
            <PhotoWatermark size={16} margin={4} />
            {flag ? <Image source={flag} style={styles.richFlag} resizeMode="cover" /> : null}
            {ratingMap[c.user_id] ? (
              <View style={styles.richRateBadge} pointerEvents="none">
                <RatingBadge avg={ratingMap[c.user_id].avg} count={ratingMap[c.user_id].count} compact onDark float />
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.richName} numberOfLines={1}>{maskedName(c.data) || code}</Text>
            <Text style={styles.richCode} numberOfLines={1}>
              {code}
              {c.employerLabel ? `  ·  ${c.employerLabel}` : ''}
            </Text>
            <View style={[styles.badge, badgeStyle]}>
              <View style={[styles.badgeDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.badgeText, { color: dotColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{badgeLabel}</Text>
            </View>
          </View>
          {canNoticeSelect && selectMode ? (
            <View style={[styles.checkbox, styles.richCheck, sel && styles.checkboxOn]}>
              {sel ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          ) : (
            <Text style={styles.richChev}>›</Text>
          )}
        </View>

        {strip !== 'none' && dateDay ? (
          <View style={[styles.dateStrip, strip === 'red' && styles.dateStripRed]}>
            <CalIcon color={strip === 'red' ? '#a32d2d' : '#9a7b1f'} />
            <Text style={[styles.dateStripText, strip === 'red' && { color: '#a32d2d' }]} numberOfLines={1}>
              {mode === 'staff' ? t('staff_until', { date: dateDay }) : dateDay}
            </Text>
            {dateTime ? (
              <>
                <View style={styles.dateSep} />
                <Text style={styles.dateStripTime}>🕒 {dateTime}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {/* Planlanmış mülakat: geri sayım + katıl */}
        {mode === 'interviews' && c.ivStatus === 'scheduled' && c.ivSlot ? (() => {
          const win = callWindow(c.ivSlot, { minutes: c.ivMinutes || JOIN_PERIOD_MIN, extraSecs: c.ivExtraSecs || 0 });
          const left = (win.base || 0) - nowTick;
          return (
            <View style={styles.ivJoinRow}>
              {left > 0 ? (
                <Text style={styles.ivCdText} numberOfLines={1}>⏱ {formatCountdown(left)}</Text>
              ) : (
                <Text style={styles.ivCdText} numberOfLines={1}>{win.joinable ? t('call_join') : t('iv_ended')}</Text>
              )}
              {win.joinable ? (
                <TouchableOpacity
                  style={styles.ivJoinMini}
                  onPress={() => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), _openIvJoin: true })}
                  activeOpacity={0.9}
                >
                  <Text style={styles.ivJoinMiniText}>🎥 {t('call_join')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })() : null}

        {/* Sonuçlanan: Teklif / Reddet — ama teklif zaten gittiyse buton AÇIK olmaz (mükerrer engeli) */}
        {mode === 'concluded' ? (
          isAccepted(c.user_id) ? (
            <View style={styles.concNote}><Text style={styles.concNoteOk}>✓ {t('offer_accepted_note')}</Text></View>
          ) : isOffered(c.user_id) ? (
            <View style={styles.concNote}><Text style={styles.concNotePend}>⏳ {t('offer_sent_note')}</Text></View>
          ) : (
            <View style={styles.concActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectFromList(c)} activeOpacity={0.85}>
                <Text style={styles.rejectBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('reject_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.offerBtn} onPress={() => offerFromList(c)} activeOpacity={0.9}>
                <Text style={styles.offerBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>✅ {t('offer_btn')}</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
      </TouchableOpacity>
    );
  };

  // Sonuçlanan görüşmeden teklif / ret.
  const offerFromList = (c) => {
    Alert.alert(t('offer_btn'), maskedName(c.data) || candidateCode(c.data?.nationality, c.reg_no), [
      { text: t('agency_cancel'), style: 'cancel' },
      { text: t('offer_btn'), onPress: async () => {
          try { await offerCandidate(c.user_id); notifyOffer(c.user_id, 'offer'); await cancelInterview(c.user_id); await reloadProcess(); }
          catch (e) { Alert.alert(t('offer_btn'), e?.message || 'error'); }
        } },
    ]);
  };
  const rejectFromList = (c) => {
    Alert.alert(t('reject_btn'), t('reject_confirm'), [
      { text: t('agency_cancel'), style: 'cancel' },
      { text: t('reject_btn'), style: 'destructive', onPress: async () => {
          try { await declineInterview(c.user_id); await reloadProcess(); }
          catch (e) { Alert.alert(t('reject_btn'), e?.message || 'error'); }
        } },
    ]);
  };

  // Mülakat(yaklaşan) vs Sonuçlanan: katılım penceresi (slot+30dk) bitince "sonuçlanan".
  // Aksi halde görüşme sürerken kart "Sonuçlanan"a düşüp Teklif/Reddet görünürdü.
  const slotMsLocal = (iso) => { const p = fromISO(iso); return p?.dt ? p.dt.getTime() : (p ? new Date(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.hhmm.split(':')[0]), Number(p.hhmm.split(':')[1])).getTime() : 0); };
  const nowMs = Date.now();
  const isConcluded = (c) => {
    if (c.ivStatus !== 'scheduled' || !c.ivSlot) return false;
    const mins = c.ivMinutes || JOIN_PERIOD_MIN;
    const extra = c.ivExtraSecs || 0;
    return (slotMsLocal(c.ivSlot) + mins * 60 * 1000 + extra * 1000) < nowMs;
  };
  const upcomingIv = ivList.filter((c) => !isConcluded(c));
  const concludedIv = ivList.filter(isConcluded);
  const baseIv = subView === 'concluded' ? concludedIv : upcomingIv;

  // Tarih ARALIĞI filtresi (planlananlar) + sıralama. ivSortDate ISO -> lexik sıralanır.
  const dayOf = (iso) => { const p = fromISO(iso); return p ? new Date(Number(p.y), Number(p.m) - 1, Number(p.d)).getTime() : null; };
  const rangeActive = !!(range.s || range.e);
  const sMs = range.s ? new Date(range.s.getFullYear(), range.s.getMonth(), range.s.getDate()).getTime() : null;
  const eMs = range.e ? new Date(range.e.getFullYear(), range.e.getMonth(), range.e.getDate()).getTime() : null;
  const shownIv = baseIv
    .filter((c) => {
      if (!rangeActive) return true;
      if (c.ivStatus !== 'scheduled' || !c.ivSlot) return false;
      const d = dayOf(c.ivSlot);
      if (d == null) return false;
      if (sMs != null && d < sMs) return false;
      if (eMs != null && d > eMs) return false;
      return true;
    })
    .sort((a, b) => (a.ivSortDate || '').localeCompare(b.ivSortDate || ''));
  if (ivSortDesc) shownIv.reverse();

  const noneEmp = t('employer_group_none') || 'İşletme atanmamış';
  const richListData = mode === 'staff' ? staffList : mode === 'inprocess'
    ? (pipeStepFilter
      ? inProcessList.filter((c) => (pipeStepFilter === 6 ? (c.pipeStep || 0) >= 6 : c.pipeStep === pipeStepFilter))
      : inProcessList)
    : mode === 'offered' ? offeredList : shownIv;
  const richSections = groupByEmployer(richListData, { noneLabel: noneEmp });
  const transitSections = groupByEmployer(transitList, { noneLabel: noneEmp });
  const formerSections = groupByEmployer(formerList, { noneLabel: noneEmp });
  const noticeListIds = canNoticeSelect
    ? (view === 'pipeline' && pipelineStage === 'transit'
      ? transitList
      : richListData).map((c) => c.user_id).filter(Boolean)
    : [];
  const selectAllNotice = () => {
    if (!noticeListIds.length) return;
    if (noticeListIds.every((id) => selectedIds.includes(id))) setSelectedIds([]);
    else setSelectedIds(noticeListIds.slice());
  };

  const renderEmpHeader = ({ section }) => (
    <View style={styles.empSec}>
      <Text style={styles.empSecTitle} numberOfLines={1}>{section.title}</Text>
      <Text style={styles.empSecN}>{section.data.length}</Text>
    </View>
  );

  const fmtRange = (dt) => (dt ? `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}` : '');
  const openRange = () => {
    const toDraft = (dt) => (dt ? { d: String(dt.getDate()).padStart(2, '0'), m: String(dt.getMonth() + 1).padStart(2, '0'), y: String(dt.getFullYear()) } : { d: '', m: '', y: '' });
    setDraftFrom(toDraft(range.s)); setDraftTo(toDraft(range.e)); setRangeOpen(true);
  };
  const applyRange = () => {
    const mk = (g) => (g.d && g.m && g.y ? new Date(Number(g.y), Number(g.m) - 1, Number(g.d)) : null);
    let s = mk(draftFrom); let e = mk(draftTo);
    if (s && e && s.getTime() > e.getTime()) { const t2 = s; s = e; e = t2; } // ters seçilirse düzelt
    setRange({ s, e }); setRangeOpen(false);
  };
  const clearRange = () => { setRange({ s: null, e: null }); setRangeOpen(false); };

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        {searchOpen ? (
          <View style={styles.heroSearchRow}>
            <View style={styles.heroSearchField}>
              <SearchIcon color="rgba(255,255,255,0.7)" size={19} />
              <TextInput
                style={styles.heroSearchInput}
                value={codeInput}
                onChangeText={(v) => { setCodeInput(v); setCodeError(false); }}
                placeholder={t('agency_code_ph')}
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                onSubmitEditing={handleCode}
                returnKeyType="search"
              />
              {codeInput ? (
                <TouchableOpacity onPress={handleCode} disabled={codeBusy} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                  {codeBusy ? <ActivityIndicator color={GOLD} /> : <Text style={styles.heroSearchGo}>{selectMode ? t('photo_add') : t('agency_find')}</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => { setSearchOpen(false); setCodeInput(''); setCodeError(false); Keyboard.dismiss(); }} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
              <Text style={styles.heroSearchClose}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.heroRow}>
            <View style={styles.heroBrand}>
              <Image source={require('../assets/turquz-logo.png')} style={styles.heroLogo} resizeMode="contain" />
              <View style={styles.heroTitles}>
                <Text style={styles.heroHi} numberOfLines={1}>{t('agency_panel_kicker')}</Text>
                <Text style={[styles.heroTitle, fontsReady && styles.heroTitleFont]} numberOfLines={1}>
                  {view === 'ops' ? t('nav_today')
                    : view === 'pool' ? t('agency_title')
                    : view === 'pipeline' ? t('nav_candidates')
                    : view === 'hotels' ? t('nav_hotels')
                    : t('nav_candidates')}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {view === 'pool' ? (
                <TouchableOpacity onPress={() => setSearchOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <SearchIcon color="#e7dcc4" size={21} />
                </TouchableOpacity>
              ) : null}
              <NotificationBell userId={userId} color="#e7dcc4" onNavigate={onNotifNavigate} />
              <TouchableOpacity onPress={openSettings} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel={t('settings')}>
                <MenuIcon />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      <View style={styles.accent} />

      {/* Ayarlar: kimlik + dil + bildirim + vergi levhası + hesap */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setMenuOpen(false); setLangOpen(false); }} />
          <View style={[styles.menuSheet, { maxHeight: winH * 0.9, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHeadRow}>
              <Text style={styles.menuHeadTitle}>{t('settings')}</Text>
              <TouchableOpacity onPress={() => { setMenuOpen(false); setLangOpen(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuCloseBtn}>
                <Text style={styles.menuCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: winH * 0.9 - 72 }}
              contentContainerStyle={styles.menuScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              nestedScrollEnabled
            >
              <View style={styles.idCard}>
                <Text style={styles.idCode}>{agencyCode(agencyProfile?.regNo)}</Text>
                <Text style={styles.idName} numberOfLines={2}>
                  {agencyProfile?.companyName || t('agency_company_fallback') || 'Acente'}
                </Text>
                <Text style={styles.idHint}>{t('agency_id_hint') || 'Acente kimlik kodunuz'}</Text>
              </View>

              <Text style={[styles.menuSection, { marginTop: 16 }]}>{t('set_language')}</Text>
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
                          if (!on) {
                            setLang(l.code);
                            setAgencyNotifPrefs({ generalPush, chatPush, preferredLang: l.code }).catch(() => {});
                          }
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

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('set_notifications')}</Text>
              <View style={styles.prefCard}>
                <View style={styles.prefRow}>
                  <View style={styles.prefText}>
                    <Text style={styles.prefTitle}>{t('set_notif_general')}</Text>
                    <Text style={styles.prefDesc}>{t('set_notif_general_desc')}</Text>
                  </View>
                  <PrefSwitch
                    on={generalPush}
                    onToggle={() => {
                      const v = !generalPush;
                      setGeneralPush(v);
                      setAgencyNotifPrefs({ generalPush: v, chatPush, preferredLang: lang }).catch(() => {});
                    }}
                  />
                </View>
                <View style={styles.prefDivider} />
                <View style={styles.prefRow}>
                  <View style={styles.prefText}>
                    <Text style={styles.prefTitle}>{t('set_notif_chat')}</Text>
                    <Text style={styles.prefDesc}>{t('set_notif_chat_desc')}</Text>
                  </View>
                  <PrefSwitch
                    on={chatPush}
                    onToggle={() => {
                      const v = !chatPush;
                      setChatPush(v);
                      setAgencyNotifPrefs({ generalPush, chatPush: v, preferredLang: lang }).catch(() => {});
                    }}
                  />
                </View>
              </View>

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('stamp_menu')}</Text>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => { setMenuOpen(false); setStampOpen(true); }}
                activeOpacity={0.85}
              >
                <View style={[styles.menuLogoutIcon, { backgroundColor: '#eef3fb' }]}><Text style={{ fontSize: 16 }}>✒️</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuLogoutText, { color: INK }]}>{t('stamp_title')}</Text>
                  <Text style={styles.menuLogoutHint}>{t('stamp_list_hint_short')}</Text>
                </View>
                <Text style={styles.menuLogoutHint}>›</Text>
              </TouchableOpacity>

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('agency_tax_section') || 'Vergi levhası'}</Text>
              <View style={styles.taxCard}>
                <Text style={styles.taxStatus} numberOfLines={2}>
                  {agencyProfile?.taxPlatePath
                    ? (t('agency_tax_ready') || 'PDF yüklü')
                    : (t('agency_tax_missing') || 'Henüz yüklenmedi')}
                </Text>
                <View style={styles.taxBtns}>
                  {agencyProfile?.taxPlatePath ? (
                    <TouchableOpacity style={styles.taxBtnGhost} onPress={viewTaxPdf} disabled={taxBusy} activeOpacity={0.85}>
                      <Text style={styles.taxBtnGhostText}>{t('agency_tax_view') || 'Görüntüle'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.taxBtn} onPress={pickTaxPdf} disabled={taxBusy} activeOpacity={0.85}>
                    {taxBusy
                      ? <ActivityIndicator color="#1b2533" />
                      : (
                        <Text style={styles.taxBtnText}>
                          {agencyProfile?.taxPlatePath
                            ? (t('agency_tax_replace') || 'Yeniden yükle')
                            : (t('agency_tax_upload') || 'PDF yükle')}
                        </Text>
                      )}
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('set_account')}</Text>
              <TouchableOpacity style={styles.actionRow} onPress={openProfile} activeOpacity={0.85}>
                <View style={[styles.menuLogoutIcon, { backgroundColor: '#eef3fb' }]}><Text style={{ fontSize: 16 }}>👤</Text></View>
                <Text style={[styles.menuLogoutText, { color: INK, flex: 1 }]}>{t('set_edit_profile')}</Text>
                <Text style={styles.menuLogoutHint}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionRow, { marginTop: 8 }]}
                onPress={() => { setMenuOpen(false); resetAgencyHomeUi(); onLogout?.(); }}
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

      <EmployerStampListSheet
        visible={stampOpen}
        agencyId={userId}
        onClose={() => setStampOpen(false)}
      />

      {/* Acente bilgilerini düzenle */}
      <Modal visible={profOpen} transparent animationType="fade" onRequestClose={() => setProfOpen(false)}>
        <Pressable style={styles.profOverlay} onPress={() => setProfOpen(false)}>
          <Pressable style={styles.profCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.profTitle}>{t('set_edit_profile')}</Text>
            <Text style={styles.profLbl}>{t('agency_company_name') || 'Şirket / işletme adı'}</Text>
            <TextInput style={styles.profInput} value={profCompany} onChangeText={setProfCompany} placeholder="Örn. ABC Turizm Ltd." placeholderTextColor="#9aa1ac" />
            <Text style={styles.profLbl}>Ad</Text>
            <TextInput style={styles.profInput} value={profFirst} onChangeText={setProfFirst} placeholder="Ad" placeholderTextColor="#9aa1ac" />
            <Text style={styles.profLbl}>Soyad</Text>
            <TextInput style={styles.profInput} value={profLast} onChangeText={setProfLast} placeholder="Soyad" placeholderTextColor="#9aa1ac" />
            <Text style={styles.profLbl}>Telefon</Text>
            <TextInput style={styles.profInput} value={profPhone} onChangeText={setProfPhone} placeholder="+90 5xx xxx xx xx" placeholderTextColor="#9aa1ac" keyboardType="phone-pad" />
            {profErr ? <Text style={styles.profErr}>{profErr}</Text> : null}
            <TouchableOpacity style={[styles.profSave, profBusy && { opacity: 0.6 }]} onPress={saveProfile} disabled={profBusy} activeOpacity={0.85}>
              <Text style={styles.profSaveText}>{profBusy ? '…' : 'Kaydet'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profCancel} onPress={() => setProfOpen(false)} activeOpacity={0.7}>
              <Text style={styles.profCancelText}>İptal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Üst menü: Bugün / Adaylar / Havuz / Oteller */}
      <View style={styles.menu}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segTrack}>
          {[
            { id: 'ops', label: t('nav_today') },
            { id: 'pipeline', label: t('nav_candidates') },
            { id: 'pool', label: t('nav_pool') },
            { id: 'hotels', label: t('nav_hotels') },
          ].map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.menuItem, view === v.id && styles.menuItemOn]}
              onPress={() => { setView(v.id); setSearchOpen(false); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.menuText, view === v.id && styles.menuTextOn]} numberOfLines={1}>
                {v.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Adaylar: 6 ana aşama + Daha fazla (Sonuçlanan / Eski) */}
      {view === 'pipeline' ? (
        <View style={styles.subTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {PIPELINE_STAGES_PRIMARY.map((st) => (
              <TouchableOpacity
                key={st.id}
                style={[styles.subChip, pipelineStage === st.id && styles.subChipOn]}
                onPress={() => { setPipelineStage(st.id); setPipeStepFilter(null); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.subChipText, pipelineStage === st.id && styles.subChipTextOn]} numberOfLines={1}>
                  {st.id === 'arrivals' ? `🛬 ${t(st.labelKey)}` : (st.id === 'offered' ? (t(st.labelKey) || 'Teklif') : t(st.labelKey))}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.subChip, isPipelineMoreStage(pipelineStage) && styles.subChipOn]}
              onPress={() => {
                Alert.alert(t('pipeline_more'), undefined, [
                  ...PIPELINE_STAGES_MORE.map((st) => ({
                    text: t(st.labelKey),
                    onPress: () => { setPipelineStage(st.id); setPipeStepFilter(null); },
                  })),
                  { text: t('agency_cancel'), style: 'cancel' },
                ]);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.subChipText, isPipelineMoreStage(pipelineStage) && styles.subChipTextOn]} numberOfLines={1}>
                {isPipelineMoreStage(pipelineStage)
                  ? t(PIPELINE_STAGES_MORE.find((s) => s.id === pipelineStage)?.labelKey || 'pipeline_more')
                  : `${t('pipeline_more')} ▾`}
              </Text>
            </TouchableOpacity>
            {canNoticeSelect ? (
              <TouchableOpacity
                style={[styles.subChip, selectMode && styles.subChipOn]}
                onPress={() => (selectMode ? exitSelect() : setSelectMode(true))}
                activeOpacity={0.85}
              >
                <Text style={[styles.subChipText, selectMode && styles.subChipTextOn]} numberOfLines={1}>
                  {selectMode ? t('agency_cancel') : `☑ ${t('agency_select')}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      {selectMode && canNoticeSelect ? (
        <View style={styles.selectPanel}>
          <View style={styles.selectRow}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllNotice} activeOpacity={0.8}>
              <Text style={styles.selectAllText}>☑ {t('agency_select_all')}</Text>
            </TouchableOpacity>
            <Text style={styles.selectCount}>{t('agency_selected', { n: selectedIds.length })}</Text>
          </View>
        </View>
      ) : null}

      {view === 'ops' ? (
        <AgencyOpsDesk
          agencyId={userId}
          padBottom={kbOpen ? 16 : insets.bottom + FOOTER_CONTENT_PAD}
          onOpen={(c, st) => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), ...(st || {}) })}
          onNavigateCat={(cat, sub) => {
            if (cat === 'messages') {
              setMessagesOpen(true);
              return;
            }
            if (cat === 'pool' || cat === 'ops' || cat === 'hotels') {
              setView(cat);
              setPipeStepFilter(null);
              return;
            }
            setView('pipeline');
            if (typeof sub === 'string' && sub.startsWith('pipe_')) {
              setPipelineStage('inprocess');
              setPipeStepFilter(Number(sub.slice(5)) || null);
              return;
            }
            const stage = stageFromOpsNav(cat, sub);
            if (stage) setPipelineStage(stage);
            setPipeStepFilter(null);
          }}
        />
      ) : view === 'hotels' ? (
        <AgencyHotelsPanel agencyId={userId} />
      ) : view !== 'pool' ? (
        listLoading ? (
          <ActivityIndicator color="#c2a25a" style={{ marginTop: 50 }} />
        ) : view === 'pipeline' && pipelineStage === 'transit' ? (
          <SectionList
            sections={transitSections}
            keyExtractor={(c) => c.user_id}
            stickySectionHeadersEnabled
            renderSectionHeader={renderEmpHeader}
            contentContainerStyle={[styles.richContent, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD + (selectMode ? 64 : 0) }]}
            ListEmptyComponent={<Text style={styles.empty}>Yolda / başlangıç bekleyen aday yok.</Text>}
            renderItem={({ item: c }) => {
              const code = candidateCode(c.nationality || c.data?.nationality, c.reg_no);
              const start = c.work_start_at ? String(c.work_start_at).slice(0, 10) : '—';
              const sel = isSelected(c.user_id);
              return (
                <TouchableOpacity
                  style={[styles.rich, sel && styles.richSel]}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (selectMode) { tapHaptic(); toggleSelect(c.user_id); return; }
                    onOpenCandidate(c, {
                      ...(statuses[c.user_id] || {}),
                      status: 'in_transit',
                      work_start_at: c.work_start_at,
                      boarding_status: c.boarding_status,
                      flight_depart_on: c.flight_depart_on,
                      _openHireConfirm: true,
                    });
                  }}
                  onLongPress={() => {
                    pressHaptic();
                    if (selectMode) exitSelect();
                    else { setSelectMode(true); toggleSelect(c.user_id); }
                  }}
                  delayLongPress={300}
                >
                  <View style={{ flex: 1, padding: 14 }}>
                    <Text style={styles.richName} numberOfLines={1}>{maskedName(c.data) || code}</Text>
                    <Text style={styles.richCode} numberOfLines={1}>{code} · başlangıç {start}</Text>
                    <Text style={[styles.richCode, { color: '#9a7b1f', marginTop: 4 }]}>Personel onayı bekleniyor</Text>
                  </View>
                  {selectMode ? (
                    <View style={[styles.checkbox, styles.richCheck, sel && styles.checkboxOn]}>
                      {sel ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  ) : (
                    <Text style={styles.richChev}>›</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : view === 'pipeline' && pipelineStage === 'former' ? (
          <SectionList
            sections={formerSections}
            keyExtractor={(c) => c.episode_id || c.candidate_id}
            stickySectionHeadersEnabled
            renderSectionHeader={renderEmpHeader}
            contentContainerStyle={[styles.richContent, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD }]}
            ListEmptyComponent={<Text style={styles.empty}>{t('staff_former_empty')}</Text>}
            renderItem={({ item: row }) => {
              const c = {
                user_id: row.candidate_id,
                title: row.title,
                data: row.data,
                reg_no: row.reg_no,
                nationality: row.nationality,
              };
              const code = candidateCode(c.nationality, c.reg_no);
              const outcomeLabel = row.outcome === 'completed' ? t('staff_outcome_completed') : t('staff_outcome_early');
              const needRate = !!row.needs_rating;
              return (
                <TouchableOpacity
                  style={styles.rich}
                  activeOpacity={0.9}
                  onPress={() => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), status: 'new' })}
                >
                  <View style={{ flex: 1, padding: 14 }}>
                    <Text style={styles.richName} numberOfLines={1}>{maskedName(c.data) || code}</Text>
                    <Text style={styles.richCode} numberOfLines={1}>{code} · {outcomeLabel}</Text>
                    {needRate ? (
                      <Text style={[styles.richCode, { color: '#9a7b1f', fontWeight: '700', marginTop: 4 }]}>
                        ★ {t('rate_required_badge')}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      {needRate ? (
                        <TouchableOpacity
                          style={[styles.subChip, styles.subChipOn]}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            onOpenCandidate(c, { ...(statuses[c.user_id] || {}), status: 'new', openRate: true });
                          }}
                        >
                          <Text style={[styles.subChipText, styles.subChipTextOn]}>{t('rate_btn')}</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={[styles.subChip, styles.subChipOn]}
                        onPress={async (e) => {
                          e?.stopPropagation?.();
                          try {
                            await offerCandidate(c.user_id);
                            notifyOffer(c.user_id, 'offer');
                            Alert.alert(t('agency_offer'), t('offer_sent_note'));
                          } catch (err) {
                            Alert.alert(t('agency_offer'), err?.message || 'error');
                          }
                        }}
                      >
                        <Text style={[styles.subChipText, styles.subChipTextOn]}>{t('agency_offer')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : view === 'pipeline' && pipelineStage === 'arrivals' ? (
          <AgencyArrivals
            candidates={(() => {
              const m = {};
              (staffList || []).forEach((c) => { m[c.user_id] = { ...c, arrivalStatus: 'hired' }; });
              (transitList || []).forEach((c) => { m[c.user_id] = { ...c, arrivalStatus: 'transit' }; });
              return Object.values(m);
            })()}
            contentPadBottom={insets.bottom + FOOTER_CONTENT_PAD}
            onOpen={(c) => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), status: c.arrivalStatus === 'transit' ? 'in_transit' : 'hired', docs_unlocked: true })}
          />
        ) : (
          <>
            {view === 'pipeline' && (mode === 'interviews' || mode === 'concluded') && baseIv.length ? (
              <View style={styles.ivToolbar}>
                <TouchableOpacity style={styles.sortPill} onPress={() => setIvSortDesc((s) => !s)} activeOpacity={0.85}>
                  <Text style={styles.sortArrow}>{ivSortDesc ? '↓' : '↑'}</Text>
                  <Text style={styles.sortPillText}>{ivSortDesc ? t('sort_new_old') : t('sort_old_new')}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                {rangeActive ? (
                  <TouchableOpacity style={styles.rangeChip} onPress={openRange} activeOpacity={0.85}>
                    <Text style={styles.rangeChipText}>{fmtRange(range.s) || '…'} – {fmtRange(range.e) || '…'}</Text>
                    <TouchableOpacity onPress={clearRange} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}><Text style={styles.rangeChipX}>✕</Text></TouchableOpacity>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.rangeIconBtn, rangeActive && styles.rangeIconBtnOn]} onPress={openRange} activeOpacity={0.85}>
                  <CalIcon color={rangeActive ? '#1b2533' : '#fff'} size={19} />
                </TouchableOpacity>
              </View>
            ) : null}
            {view === 'pipeline' && mode === 'inprocess' && pipeStepFilter ? (
              <View style={styles.pipeFilterBar}>
                <Text style={styles.pipeFilterText} numberOfLines={1}>
                  {t('ops_pipe_filter', {
                    x: t(
                      pipeStepFilter === 3 ? 'ops_funnel_ref'
                        : pipeStepFilter === 4 ? 'ops_funnel_permit'
                          : pipeStepFilter === 6 ? 'ops_funnel_transfer'
                            : `pipe_step_${pipeStepFilter}`,
                    ),
                  })}
                </Text>
                <TouchableOpacity onPress={() => setPipeStepFilter(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.pipeFilterClear}>{t('ops_pipe_clear')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <SectionList
              sections={richSections}
              keyExtractor={(c) => c.user_id}
              stickySectionHeadersEnabled
              renderSectionHeader={renderEmpHeader}
              renderItem={renderRich}
              contentContainerStyle={[styles.richContent, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD + (selectMode ? 64 : 0) }]}
              ListEmptyComponent={(
                <Text style={styles.empty}>
                  {mode === 'offered'
                    ? (t('offered_empty') || 'Yanıt bekleyen teklif yok.')
                    : t(mode === 'staff' ? 'staff_empty' : mode === 'concluded' ? 'concluded_empty' : mode === 'inprocess' ? 'inprocess_empty' : 'interviews_empty')}
                </Text>
              )}
            />
          </>
        )
      ) : (
      <>
      {codeError ? <Text style={styles.codeErrBar}>{t('agency_code_notfound')}</Text> : null}

      {/* Görünürlük sıralaması + favori + huni */}
      <View style={styles.poolSortRow}>
        <View style={styles.sortSeg}>
          <TouchableOpacity
            style={[styles.sortSegItem, poolSort === 'online' && styles.sortSegItemOn]}
            onPress={() => setPoolSort('online')}
            activeOpacity={0.85}
          >
            <View style={[styles.sortSegDot, poolSort === 'online' && styles.sortSegDotOn]} />
            <Text style={[styles.sortSegText, poolSort === 'online' && styles.sortSegTextOn]} numberOfLines={1}>{t('sort_newest')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortSegItem, poolSort === 'online_old' && styles.sortSegItemOn]}
            onPress={() => setPoolSort('online_old')}
            activeOpacity={0.85}
          >
            <Text style={[styles.sortSegText, poolSort === 'online_old' && styles.sortSegTextOn]} numberOfLines={1}>{t('sort_oldest')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.favFilterPill, favOn && styles.favFilterPillOn]}
          onPress={() => setFavOn((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={[styles.favFilterText, favOn && styles.favFilterTextOn]} numberOfLines={1}>
            ★ {t('fav_filter_btn')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setSheetVisible(true)} activeOpacity={0.8}>
          <FilterIcon color="#fff" knobFill={GOLD} size={18} />
          {activeCount > 0 ? (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeCount}</Text></View>
          ) : null}
        </TouchableOpacity>
      </View>

      {selectMode ? (
        <View style={styles.selectPanel}>
          <View style={styles.selectRow}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllFiltered} activeOpacity={0.8}>
              <Text style={styles.selectAllText}>☑ {t('agency_select_all')}</Text>
            </TouchableOpacity>
            <Text style={styles.selectCount}>{t('agency_selected', { n: selectedIds.length })}</Text>
          </View>
          {codeChips.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
              {codeChips.map((ch) => (
                <TouchableOpacity key={ch.user_id} style={styles.codeChip} onPress={() => removeChip(ch.user_id)} activeOpacity={0.8}>
                  {ch.photo ? <Image source={{ uri: ch.photo }} style={styles.codeChipImg} /> : null}
                  <Text style={styles.codeChipText}>{ch.code}</Text>
                  <Text style={styles.codeChipX}>✕</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#c2a25a" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.user_id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.colWrap}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={styles.empty}>{favOn ? t('fav_empty') : t('agency_empty')}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#c2a25a" style={{ marginVertical: 16 }} /> : null}
        />
      )}

      {selectMode ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bulkText}>{t('agency_selected', { n: selectedIds.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={exitSelect} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>{t('agency_cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, (bulkBusy || !selectedIds.length) && { opacity: 0.5 }]} onPress={bulkOffer} disabled={bulkBusy || !selectedIds.length} activeOpacity={0.9}>
              {bulkBusy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.bulkBtnText}>{t('agency_offer')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      </>
      )}

      {!selectMode && !kbOpen ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.footerGold} />
          <TouchableOpacity style={styles.footerTab} onPress={() => setAnnouncementsOpen(true)} activeOpacity={0.85}>
            <View style={styles.footerIconWrap}>
              <FooterMegaphoneIcon color="#e7dcc4" size={20} />
              {announceUnread > 0 ? (
                <View style={styles.footerBadge}>
                  <Text style={styles.footerBadgeText}>{announceUnread > 9 ? '9+' : announceUnread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_announcements')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerTab} onPress={() => setRemindersOpen(true)} activeOpacity={0.85}>
            <View style={styles.footerIconWrap}>
              <FooterStopwatchIcon color="#e7dcc4" size={20} />
              {remindWarn ? <Animated.View style={[styles.footerWarnDot, { opacity: remindBlink }]} /> : null}
            </View>
            <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_remind_short')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerTab} onPress={() => setMessagesOpen(true)} activeOpacity={0.85}>
            <View style={styles.footerIconWrap}>
              <FooterChatIcon color="#e7dcc4" size={20} />
              {chatBadge > 0 ? (
                <View style={styles.footerBadge}>
                  <Text style={styles.footerBadgeText}>{chatBadge > 9 ? '9+' : chatBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('nav_messages')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerTab} onPress={() => setContactOpen(true)} activeOpacity={0.85}>
            <View style={styles.footerLogoWrap}>
              <Image source={FOOTER_LOGO} style={styles.footerLogo} resizeMode="cover" />
            </View>
            <Text style={styles.footerLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('home_support_short')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {selectMode && canNoticeSelect ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.bulkText}>{t('agency_selected', { n: selectedIds.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={exitSelect} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>{t('agency_cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, !selectedIds.length && { opacity: 0.5 }]}
              onPress={() => selectedIds.length && setNoticeOpen(true)}
              disabled={!selectedIds.length}
              activeOpacity={0.9}
            >
              <Text style={styles.bulkBtnText}>{t('agency_notice')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <AgencyNoticeSheet
        visible={noticeOpen || hubCompose}
        onClose={() => {
          setNoticeOpen(false);
          setHubCompose(false);
          setHubNotice(null);
          setHubIds([]);
          setHubPeople([]);
          setHubNonce((n) => n + 1);
        }}
        userIds={noticeOpen ? selectedIds : hubIds}
        previewPeople={noticeOpen ? [] : hubPeople}
        allowAudience={hubCompose && !noticeOpen && !hubIds.length}
        agencyId={userId}
        startNotice={hubNotice}
        hideHistory={hubCompose}
        targetKind="selected"
      />

      <AgencyChatInboxSheet
        visible={messagesOpen && !chatPeer}
        onClose={() => {
          setChatPeer(null);
          setMessagesOpen(false);
          unreadChatCount(userId).then(setChatBadge).catch(() => {});
        }}
        agencyId={userId}
        onBadgeChange={(n) => setChatBadge(n || 0)}
        onOpen={(c) => {
          const code = candidateCode(c.nationality || c.data?.nationality, c.reg_no);
          const label = [maskedName(c.data), code].filter(Boolean).join(' · ') || code;
          setChatPeer({ id: c.user_id, label });
        }}
      />

      <ProcessChatSheet
        visible={!!chatPeer}
        onClose={() => {
          setChatPeer(null);
          unreadChatCount(userId).then(setChatBadge).catch(() => {});
        }}
        onRead={() => unreadChatCount(userId).then(setChatBadge).catch(() => {})}
        candidateId={chatPeer?.id}
        peerLabel={chatPeer?.label}
      />

      <AnnouncementsListSheet
        visible={announcementsOpen && !hubCompose}
        onClose={() => {
          setAnnouncementsOpen(false);
          unreadAnnouncementCount(userId).then(setAnnounceUnread).catch(() => {});
        }}
        userId={userId}
        agencyId={userId}
        reloadAt={hubNonce}
        onCompose={() => { setHubNotice(null); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
        onComposeGroup={(b) => {
          setHubNotice(null);
          setHubIds((b.people || []).map((p) => p.userId));
          setHubPeople(b.people || []);
          setHubCompose(true);
        }}
        onOpenSent={(row) => { setHubNotice(row); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
      />
      <AgencyRemindersSheet
        visible={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        agencyId={userId}
        onPick={(a) => {
          if (a?.cat === 'messages' || a?.filter === 'chat') setMessagesOpen(true);
          else setView('ops');
        }}
      />
      <ContactSheet visible={contactOpen} onClose={() => setContactOpen(false)} />

      <AgencyFilterSheet
        visible={sheetVisible}
        initial={advFilters}
        sort={poolSort}
        onApply={(f) => {
          const { sort: nextSort, ...rest } = f || {};
          if (nextSort) setPoolSort(nextSort);
          setAdvFilters(rest);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
      />

      {/* Tarih aralığı seçici */}
      <Modal visible={rangeOpen} transparent animationType="fade" onRequestClose={() => setRangeOpen(false)}>
        <Pressable style={styles.rangeBackdrop} onPress={() => setRangeOpen(false)}>
          <Pressable style={styles.rangeSheet} onPress={() => {}}>
            <View style={styles.rangeHandle} />
            <Text style={styles.rangeTitle}>{t('range_title')}</Text>

            <Text style={styles.rangeLbl}>{t('range_from')}</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeCol}><Select label={t('f_day')} value={draftFrom.d} options={DAYS} onChange={(v) => setDraftFrom((g) => ({ ...g, d: v }))} /></View>
              <View style={styles.rangeCol}><Select label={t('f_month')} value={draftFrom.m} options={monthOptions(lang)} onChange={(v) => setDraftFrom((g) => ({ ...g, m: v }))} /></View>
              <View style={styles.rangeCol}><Select label={t('f_year')} value={draftFrom.y} options={FLIGHT_YEARS} onChange={(v) => setDraftFrom((g) => ({ ...g, y: v }))} /></View>
            </View>

            <Text style={styles.rangeLbl}>{t('range_to')}</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeCol}><Select label={t('f_day')} value={draftTo.d} options={DAYS} onChange={(v) => setDraftTo((g) => ({ ...g, d: v }))} /></View>
              <View style={styles.rangeCol}><Select label={t('f_month')} value={draftTo.m} options={monthOptions(lang)} onChange={(v) => setDraftTo((g) => ({ ...g, m: v }))} /></View>
              <View style={styles.rangeCol}><Select label={t('f_year')} value={draftTo.y} options={FLIGHT_YEARS} onChange={(v) => setDraftTo((g) => ({ ...g, y: v }))} /></View>
            </View>

            <View style={styles.rangeBtns}>
              <TouchableOpacity style={styles.rangeClear} onPress={clearRange} activeOpacity={0.85}><Text style={styles.rangeClearText}>{t('range_clear')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.rangeApply} onPress={applyRange} activeOpacity={0.9}><Text style={styles.rangeApplyText}>{t('range_apply')}</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const INK = '#142033';
const GOLD = '#b8954a';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f3f0ea' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingBottom: 16, backgroundColor: '#0f1826', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 7, zIndex: 2 },
  hero: { paddingLeft: 8, paddingRight: 16, paddingBottom: 20, backgroundColor: '#0f1826', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 8, zIndex: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8, minWidth: 0 },
  heroTitles: { flex: 1, minWidth: 0, marginLeft: -2 },
  heroSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroSearchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroSearchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.4, padding: 0 },
  heroSearchGo: { color: '#dcc187', fontWeight: '800', fontSize: 13.5 },
  heroSearchClose: { color: '#e7dcc4', fontSize: 20, fontWeight: '700' },
  heroLogo: { width: 94, height: 64, marginLeft: -6 },
  heroHi: { color: '#c2a25a', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 2 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.2 },
  heroTitleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  headerLogo: { width: 96, height: 60 },
  titleBox: { marginLeft: 6, flexShrink: 1 },
  acente: { color: GOLD, fontSize: 27, fontWeight: '800' },
  acenteFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  acenteSub: { color: '#9aa4b1', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.8, marginTop: 1, textTransform: 'uppercase' },
  accent: { height: 3, backgroundColor: GOLD, zIndex: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  menuDots: { fontSize: 26, color: '#cbd2db', fontWeight: '900', marginTop: -4 },
  // Ayarlar alt sayfası
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
  menuScroll: { flexGrow: 0 },
  menuScrollContent: { paddingBottom: 8 },
  menuSection: { fontSize: 11.5, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 },
  idCard: {
    backgroundColor: '#0f1826', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
  },
  idCode: { fontSize: 22, fontWeight: '900', color: GOLD, letterSpacing: 1.2 },
  idName: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#f5ecda' },
  idHint: { marginTop: 6, fontSize: 11.5, fontWeight: '600', color: 'rgba(231,220,196,0.55)' },
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
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6dfd0', width: '48%',
  },
  langChipOn: { backgroundColor: '#f3ecdc', borderColor: GOLD },
  langChipText: { fontSize: 14.5, fontWeight: '700', color: '#2a3342', flexShrink: 1 },
  langChipTextOn: { color: '#8a6a1f' },
  langChipCheck: { fontSize: 13, fontWeight: '900', color: GOLD, marginLeft: 'auto' },
  prefCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ebe4d5', overflow: 'hidden' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  prefText: { flex: 1, minWidth: 0 },
  prefTitle: { fontSize: 15, fontWeight: '800', color: INK },
  prefDesc: { fontSize: 12, fontWeight: '600', color: '#8a929c', marginTop: 3, lineHeight: 16 },
  prefDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ece4d2', marginLeft: 14 },
  taxCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ebe4d5',
    paddingVertical: 14, paddingHorizontal: 14, gap: 12,
  },
  taxStatus: { fontSize: 14, fontWeight: '700', color: '#2a3342', lineHeight: 19 },
  taxBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  taxBtn: {
    flexGrow: 1, minWidth: 120, backgroundColor: GOLD, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  taxBtnText: { color: '#1b2533', fontWeight: '800', fontSize: 14 },
  taxBtnGhost: {
    flexGrow: 1, minWidth: 100, backgroundColor: '#f3efe6', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e6dfd0',
  },
  taxBtnGhostText: { color: INK, fontWeight: '800', fontSize: 14 },
  swTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#cfd3d8', padding: 2, justifyContent: 'center' },
  swTrackOn: { backgroundColor: GOLD },
  swThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: 'flex-start' },
  swThumbOn: { alignSelf: 'flex-end' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ebe4d5',
  },
  menuLogoutIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fbeae8', alignItems: 'center', justifyContent: 'center' },
  menuLogoutText: { color: '#b5413a', fontWeight: '800', fontSize: 15 },
  menuLogoutHint: { color: '#c9a9a4', fontSize: 22, fontWeight: '300' },
  profOverlay: { flex: 1, backgroundColor: 'rgba(10,16,24,0.6)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  profCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 22 },
  profTitle: { fontSize: 19, fontWeight: '900', color: '#1b2533', marginBottom: 14 },
  profLbl: { fontSize: 12.5, fontWeight: '700', color: '#737373', marginBottom: 5, marginTop: 10 },
  profInput: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, color: '#1b2533' },
  profErr: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: 10 },
  profSave: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 },
  profSaveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  profCancel: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  profCancelText: { color: '#9aa1ac', fontSize: 14, fontWeight: '700' },
  menu: { backgroundColor: 'transparent', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, zIndex: 5 },
  segTrack: { flexDirection: 'row', backgroundColor: '#1a2536', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 2 },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, flexDirection: 'row', gap: 5 },
  menuItemOn: { backgroundColor: GOLD },
  menuText: { fontSize: 13, fontWeight: '800', color: '#9aa6b6', letterSpacing: 0.2 },
  menuTextOn: { color: '#16202e' },
  navBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#b42318', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  subTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: 'transparent' },
  pipeFilterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#f4ead2',
  },
  pipeFilterText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1b2533' },
  pipeFilterClear: { fontSize: 12, fontWeight: '800', color: '#8f7130' },
  subChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ebe4d5', maxWidth: '100%' },
  subChipOn: { backgroundColor: '#16202e' },
  subChipText: { fontSize: 12.5, fontWeight: '800', color: '#737373' },
  subChipTextOn: { color: '#fff' },
  ivJoinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  ivCdText: { flex: 1, color: '#9a7b1f', fontWeight: '800', fontSize: 12.5 },
  ivJoinMini: { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  ivJoinMiniText: { color: INK, fontWeight: '900', fontSize: 12.5 },
  concActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  concNote: { marginTop: 12, borderRadius: 11, paddingVertical: 11, alignItems: 'center', backgroundColor: '#f3f4f6' },
  concNoteOk: { color: '#1f8a4c', fontWeight: '800', fontSize: 13.5 },
  concNotePend: { color: '#1f3a63', fontWeight: '800', fontSize: 13.5 },
  rejectBtn: { flex: 1, backgroundColor: '#fbeaea', borderWidth: 1, borderColor: '#e8b5b0', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  rejectBtnText: { color: '#a32d2d', fontWeight: '800', fontSize: 13.5 },
  offerBtn: { flex: 2, backgroundColor: '#1f8a4c', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  offerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  grpSection: { marginBottom: 14 },
  grpSectionTitle: { fontSize: 12, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  grpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1b2533', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8 },
  grpWhen: { color: '#fff', fontSize: 14, fontWeight: '800' },
  grpMeta: { color: '#9aa4b1', fontSize: 12, fontWeight: '600', marginTop: 3 },
  grpJoin: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1f8a4c', alignItems: 'center', justifyContent: 'center' },
  grpJoinText: { fontSize: 18 },
  grpCancelBtn: { width: 28, alignItems: 'center' },
  grpCancelX: { color: '#e8806f', fontSize: 15, fontWeight: '800' },
  grpBtn: { backgroundColor: '#22303f', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  grpBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  // --- Mülakat araç çubuğu ---
  ivToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, backgroundColor: 'transparent' },
  poolSortRow: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sortSeg: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#eef0f2', borderRadius: 999, padding: 3, borderWidth: 1, borderColor: '#e6e8ec',
  },
  sortSegItem: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  sortSegItemOn: { backgroundColor: '#fff', shadowColor: '#0c1320', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sortSegDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9aa3b0' },
  sortSegDotOn: { backgroundColor: '#22a06b', shadowColor: '#22a06b', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  sortSegText: { fontSize: 12, fontWeight: '800', color: '#6b7280' },
  sortSegTextOn: { color: INK },
  favFilterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '42%', backgroundColor: '#eef0f2', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#e6e8ec' },
  favFilterPillOn: { backgroundColor: 'rgba(194,162,90,0.16)', borderColor: GOLD },
  favFilterText: { fontSize: 12.5, fontWeight: '800', color: '#5c6675', flexShrink: 1 },
  favFilterTextOn: { color: '#8a6a1f' },
  favFilterX: { marginLeft: 2 },
  favFilterXText: { fontSize: 12, fontWeight: '800', color: '#8a6a1f' },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ebe4d5', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%' },
  sortArrow: { color: GOLD, fontSize: 14, fontWeight: '900' },
  sortPillText: { color: INK, fontWeight: '800', fontSize: 12.5, flexShrink: 1 },
  rangeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#faf2e0', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 20, paddingLeft: 12, paddingRight: 9, paddingVertical: 7 },
  rangeChipText: { color: '#9a7b1f', fontWeight: '800', fontSize: 12 },
  rangeChipX: { color: '#9a7b1f', fontWeight: '900', fontSize: 12 },
  rangeIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1b2533', alignItems: 'center', justifyContent: 'center' },
  rangeIconBtnOn: { backgroundColor: GOLD },

  // --- Mülakat / Personel premium kart ---
  richContent: { paddingHorizontal: 14, paddingTop: 12 },
  empSec: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    marginHorizontal: -14, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f3efe6', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e4ddd0',
  },
  empSecTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: '#142033' },
  empSecN: {
    minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden',
    backgroundColor: 'rgba(184,149,74,0.2)', fontSize: 11, fontWeight: '800', color: '#8f7130', textAlign: 'center',
  },
  rich: { backgroundColor: '#fff', borderRadius: 20, padding: 15, marginBottom: 14, shadowColor: '#16202e', shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 4 },
  richSel: { borderWidth: 2, borderColor: GOLD },
  richCheck: { position: 'relative', top: 0, right: 0, marginLeft: 6 },
  richTop: { flexDirection: 'row', alignItems: 'center' },
  richPhotoBox: { width: 62, height: 62, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eef0f2' },
  richPhoto: { width: '100%', height: '100%' },
  richFlag: { position: 'absolute', bottom: 3, right: 3, width: 18, height: 12, borderRadius: 2, borderWidth: 0.5, borderColor: '#fff' },
  richName: { fontSize: 16, fontWeight: '800', color: '#16202e' },
  richCode: { fontSize: 11.5, fontWeight: '700', color: '#9a7b1f', letterSpacing: 0.4, marginTop: 3 },
  richChev: { fontSize: 26, color: '#cdbfa2', fontWeight: '700', marginLeft: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  bMuted: { backgroundColor: '#f1f2f4' },
  bGreen: { backgroundColor: '#e6f4ec' },
  bAmber: { backgroundColor: '#fbf0d9' },
  bRed: { backgroundColor: '#fbeaea' },
  dateStrip: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13, backgroundColor: '#faf7ef', borderWidth: 1, borderColor: '#eadfc2', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  dateStripRed: { backgroundColor: '#fbeaea', borderColor: '#e8c5c0' },
  dateStripText: { flex: 1, fontSize: 13, fontWeight: '800', color: '#7a6420' },
  dateSep: { width: 1, height: 16, backgroundColor: '#e0d3ad' },
  dateStripTime: { fontSize: 13.5, fontWeight: '800', color: '#9a7b1f' },

  // --- Tarih aralığı modalı ---
  rangeBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  rangeSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  rangeHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#dfe2e7', marginBottom: 14 },
  rangeTitle: { fontSize: 17, fontWeight: '800', color: INK, marginBottom: 16 },
  rangeLbl: { fontSize: 11, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 7 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rangeCol: { flex: 1 },
  rangeBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  rangeClear: { flex: 1, backgroundColor: '#f1f2f4', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  rangeClearText: { color: INK, fontWeight: '800', fontSize: 14 },
  rangeApply: { flex: 2, backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  rangeApplyText: { color: INK, fontWeight: '800', fontSize: 15 },
  logout: { fontSize: 22, color: '#e8806f', fontWeight: '700' },
  selectBtn: { fontSize: 14, fontWeight: '800', color: GOLD },
  selectPanel: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectAllBtn: { backgroundColor: '#eef0f2', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  selectAllText: { fontSize: 13, fontWeight: '800', color: INK },
  selectCount: { fontSize: 13, fontWeight: '700', color: '#737373' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, backgroundColor: 'transparent' },
  codeErrBar: { color: '#a32d2d', fontSize: 12.5, fontWeight: '600', paddingHorizontal: 16, paddingTop: 6, backgroundColor: '#fff' },
  codeAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  codeInput: { flex: 1, backgroundColor: '#f4efe3', borderWidth: 1, borderColor: '#e7ddc6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontWeight: '600', letterSpacing: 0.3, color: INK },
  codeAddBtn: { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, minWidth: 64, alignItems: 'center' },
  codeAddText: { color: INK, fontWeight: '800', fontSize: 14 },
  codeErr: { color: '#a32d2d', fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  codeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef0f2', borderRadius: 18, paddingLeft: 4, paddingRight: 10, paddingVertical: 3 },
  codeChipImg: { width: 24, height: 24, borderRadius: 12, marginRight: 6, backgroundColor: '#dfe2e7' },
  codeChipText: { fontSize: 12.5, fontWeight: '800', color: INK, marginRight: 6 },
  codeChipX: { fontSize: 12, color: '#737373', fontWeight: '800' },

  filterIconBtn: { width: 40, height: 36, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  filterBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  filterBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#fff' },

  tabs: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 14, paddingRight: 8, paddingVertical: 13, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  tabScroll: { gap: 7, alignItems: 'center', paddingRight: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#efe9dd' },
  tabOn: { backgroundColor: INK, shadowColor: INK, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText: { fontSize: 12.5, fontWeight: '800', color: '#737373' },
  tabTextOn: { color: '#fff' },

  content: { paddingHorizontal: 14, paddingTop: 14 },
  colWrap: { justifyContent: 'space-between' },
  empty: { textAlign: 'center', color: '#9aa1ac', marginTop: 50, fontSize: 15 },

  // --- Editorial Hero: tam-kaplama kart ---
  fbCard: {
    width: '48.5%', aspectRatio: 0.7, marginBottom: 18, borderRadius: 26, overflow: 'hidden', backgroundColor: '#e9ebee',
    shadowColor: '#0c1320', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  fbCardSel: { borderWidth: 2.5, borderColor: GOLD },
  fbPhoto: { width: '100%', height: '100%' },
  fbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '30%', backgroundColor: 'rgba(10,15,22,0.20)' },
  fbFlag: { position: 'absolute', top: 11, left: 11, width: 30, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, zIndex: 3 },
  fbRateBadge: { position: 'absolute', top: 10, right: 10, zIndex: 4 },
  fbRateBadgeSelect: { top: 46 },
  fbUnfav: {
    position: 'absolute', top: 8, right: 8, zIndex: 5,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(10,16,24,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  fbUnfavText: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: -1 },
  richRateBadge: { position: 'absolute', top: 4, right: 4, zIndex: 4, transform: [{ scale: 0.92 }] },
  fbInfo: { position: 'absolute', left: 0, right: 0, bottom: 30, paddingHorizontal: 13, paddingBottom: 0, paddingTop: 4 },
  fbPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4.5, marginBottom: 8 },
  fbName: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 1 } },
  fbSub: { color: '#e7cf9a', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6 },
  fbOnlineWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 5, zIndex: 3,
    alignItems: 'center', paddingHorizontal: 10,
  },
  fbOnlinePill: {
    maxWidth: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  fbOnline_fresh: { backgroundColor: 'rgba(15,107,69,0.72)', borderColor: 'rgba(120,220,170,0.55)' },
  fbOnline_recent: { backgroundColor: 'rgba(138,106,20,0.72)', borderColor: 'rgba(230,200,120,0.55)' },
  fbOnline_stale: { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' },
  fbOnline_never: { backgroundColor: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.2)' },
  fbOnlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c5ccd6', flexShrink: 0 },
  fbOnlineDot_fresh: { backgroundColor: '#7dffb2' },
  fbOnlineDot_recent: { backgroundColor: '#ffe08a' },
  fbOnlineDot_stale: { backgroundColor: '#c5ccd6' },
  fbOnlineDot_never: { backgroundColor: '#c5ccd6' },
  fbOnlineText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.15, lineHeight: 13, flexShrink: 1 },

  card: {
    width: '48.5%', marginBottom: 18, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden',
    shadowColor: '#16202e', shadowOpacity: 0.12, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 5,
  },
  cardSel: { borderWidth: 2, borderColor: GOLD },
  checkbox: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: GOLD, borderColor: '#fff' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: '900' },
  photoBox: { width: '100%', aspectRatio: 0.8, backgroundColor: '#e9ebee' },
  photoFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, backgroundColor: 'rgba(13,19,28,0.26)' },
  flag: { position: 'absolute', top: 9, left: 9, width: 30, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  photo: { width: '100%', height: '100%' },
  photoPh: { backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  photoIcon: { fontSize: 46 },
  info: { paddingHorizontal: 13, paddingTop: 11, paddingBottom: 13 },
  code: { fontSize: 16.5, fontWeight: '800', color: '#16202e', letterSpacing: 0.2 },
  codeSub: { fontSize: 11, fontWeight: '800', color: '#9a7b1f', letterSpacing: 0.9, marginTop: 3 },
  pos: { fontSize: 12, color: '#8b93a0', marginTop: 3, fontWeight: '500' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 11 },
  pillOk: { backgroundColor: '#e6f4ec' },
  pillPend: { backgroundColor: '#fdf0db' },
  pillOffered: { backgroundColor: '#e7ecf3' },
  pillActive: { backgroundColor: '#e7f3ec' },
  dotOffered: { backgroundColor: '#1f3a63' },
  dotActive: { backgroundColor: '#1f8a4c' },
  pillTextOffered: { color: '#1f3a63' },
  pillTextActive: { color: '#1f7a44' },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  dotOk: { backgroundColor: '#2faa6a' },
  dotPend: { backgroundColor: '#d99221' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextOk: { color: '#1f8a4c' },
  pillTextPend: { color: '#9a6b16' },

  bulkBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1b2533', paddingHorizontal: 20, paddingTop: 14,
  },
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
  footerIconOn: { backgroundColor: 'rgba(194,162,90,0.32)', borderColor: 'rgba(194,162,90,0.75)' },
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
  bulkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bulkBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  bulkBtnText: { color: INK, fontSize: 15, fontWeight: '800' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, justifyContent: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
