// screens/AgencyHomeScreen.js
// Acente paneli — premium aday havuzu (2 sütun foto galeri + alt bilgi).
// Arama yok; bulma ⚙ Filtreler (tam ekran) ile. FlatList sanallaştırma + sonsuz kaydırma.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Keyboard, Modal, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Line, Circle, Path, Polyline, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listCandidates, listCandidateIds, listStatuses, listCandidatesWithDocs, offerCandidate, findCandidateByCode, listInterviewCandidates, listStaff, listInProcess, declineInterview, getCandidateById } from '../lib/roles';
import { updateMyProfile, getSession } from '../lib/auth';
import { candidateCode, parseCode, maskedName } from '../lib/candidateCode';
import { formatLastSeen, lastSeenTier } from '../lib/lastSeenFormat';
import { slotDateKey, slotTime, weekdayOf, fromISO, formatCountdown, cancelInterview } from '../lib/interviews';
import { callWindow, JOIN_PERIOD_MIN } from '../lib/livekitCall';
import { scanDocsDeadline, scanInterviewReminders, scanInterviewSla, notifyOffer } from '../lib/push';
import { Select } from '../components/Select';
import { DAYS, monthOptions, FLIGHT_YEARS } from '../cv/options';
import AgencyFilterSheet from '../components/AgencyFilterSheet';
import NotificationBell from '../components/NotificationBell';
import PhotoWatermark from '../components/PhotoWatermark';
import { LANGUAGES_SUPPORTED } from '../i18n/languages';
import { getAgencyNotifPrefs, setAgencyNotifPrefs } from '../lib/agencyNotifPrefs';
import { syncChatLang } from '../lib/processChat';
import { listRatingStats } from '../lib/ratings';
import RatingBadge from '../components/RatingBadge';
import FavoriteEmployerSheet from '../components/FavoriteEmployerSheet';
import { listFavoriteCandidates, removeFavorite } from '../lib/favorites';
import { readAgencyHomeUi, writeAgencyHomeUi, resetAgencyHomeUi } from '../lib/agencyHomeUi';
import AgencyArrivals from '../components/AgencyArrivals';

const PAGE = 24;

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
  const [codeInput, setCodeInput] = useState('');
  const [codeChips, setCodeChips] = useState([]); // koda göre eklenenler {user_id, code, photo}
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const filterKey = JSON.stringify(advFilters);
  const activeCount = countFilters(advFilters);
  const [menuOpen, setMenuOpen] = useState(false);    // header ⋮ menüsü (dil + çıkış)
  // Acente bilgilerini düzenle modalı
  const [profOpen, setProfOpen] = useState(false);
  const [profFirst, setProfFirst] = useState('');
  const [profLast, setProfLast] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [profErr, setProfErr] = useState('');
  const openProfile = async () => {
    setMenuOpen(false);
    try {
      const { session } = await getSession();
      const m = session?.user?.user_metadata || {};
      setProfFirst(m.first_name || ''); setProfLast(m.last_name || ''); setProfPhone(m.phone || '');
    } catch (e) { setProfFirst(''); setProfLast(''); setProfPhone(''); }
    setProfErr(''); setProfOpen(true);
  };
  const saveProfile = async () => {
    const f = profFirst.trim(), l = profLast.trim(), p = profPhone.trim();
    if (!f || !l || !p) { setProfErr('Ad, soyad ve telefon zorunludur.'); return; }
    if (p.replace(/\D/g, '').length < 10) { setProfErr('Geçerli bir telefon numarası girin.'); return; }
    setProfErr(''); setProfBusy(true);
    const { error } = await updateMyProfile({ firstName: f, lastName: l, phone: p });
    setProfBusy(false);
    if (error) { setProfErr(error.message || 'Kaydedilemedi'); return; }
    setProfOpen(false);
  };
  const [searchOpen, setSearchOpen] = useState(false); // header'da açılır arama
  const [view, setView] = useState(() => savedUi.view || 'pool');          // pool | process | staff
  const [subView, setSubView] = useState(() => savedUi.subView || 'interviews'); // interviews | concluded | inprocess
  const [ivList, setIvList] = useState([]);
  const [inProcessList, setInProcessList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [ivSortDesc, setIvSortDesc] = useState(true);   // yeni -> eski
  // Havuz sıralaması: son görünürlük (yeniden eskiye) | eskiden yeniye | CV tarihi
  const [poolSort, setPoolSort] = useState(() => savedUi.poolSort || 'online'); // online | online_old
  const [staffView, setStaffView] = useState('cards'); // cards | arrivals
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState({ s: null, e: null }); // seçili tarih aralığı (Date)
  const [draftFrom, setDraftFrom] = useState({ d: '', m: '', y: '' });
  const [draftTo, setDraftTo] = useState({ d: '', m: '', y: '' });
  const [nowTick, setNowTick] = useState(Date.now());

  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const [ratingMap, setRatingMap] = useState({}); // user_id -> { avg, count }
  const [favEmployer, setFavEmployer] = useState(() => savedUi.favEmployer || null); // { id, name } | null
  const [favFilterOpen, setFavFilterOpen] = useState(false);

  // Aday detayına gidip gelince unmount olmasın diye UI durumunu sakla.
  useEffect(() => {
    writeAgencyHomeUi({ view, subView, poolSort, advFilters, favEmployer });
  }, [view, subView, poolSort, advFilters, favEmployer]);

  // Tarama + tercih yükleme: dil değişiminde TEKRAR ÇALIŞMASIN (menü donmasını önler).
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    scanDocsDeadline();
    scanInterviewReminders();
    scanInterviewSla();
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
    if (!(view === 'process' && subView === 'interviews')) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, subView]);

  // Süreç / Personel sekmesine geçince ilgili listeleri yükle.
  const reloadProcess = useCallback(async () => {
    const [ivs, inp] = await Promise.all([listInterviewCandidates(userId), listInProcess(userId)]);
    setIvList(ivs); setInProcessList(inp);
  }, [userId]);
  useEffect(() => {
    if (view === 'pool') return undefined;
    let alive = true;
    (async () => {
      setListLoading(true);
      if (view === 'process') { await reloadProcess(); }
      else { const rows = await listStaff(userId); if (alive) setStaffList(rows); }
      if (alive) setListLoading(false);
    })();
    return () => { alive = false; };
  }, [view, userId, reloadProcess]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let rows;
      if (favEmployer?.id) {
        rows = await listFavoriteCandidates(userId, favEmployer.id);
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
  }, [filterKey, poolSort, favEmployer?.id, userId]);

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
    if (favEmployer?.id || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const next = page + 1;
    const rows = await listCandidates({ filters: advFilters, from: next * PAGE, to: next * PAGE + PAGE - 1, sort: poolSort });
    setItems((prev) => [...prev, ...rows]); setPage(next); setHasMore(rows.length === PAGE); setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, loading, page, filterKey, poolSort, favEmployer?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (favEmployer?.id) {
      const [rows, st, dids] = await Promise.all([
        listFavoriteCandidates(userId, favEmployer.id),
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

  // Bildirime tıklayınca: ilgili aday (ref_user) varsa o adayın ekranını aç.
  const NOTIF_TO_CANDIDATE = ['interview_scheduled', 'document', 'offer_accepted', 'offer_rejected', 'docs_deadline'];
  const onNotifNavigate = async (n) => {
    if (!n?.ref_user || !NOTIF_TO_CANDIDATE.includes(n.type)) return;
    try {
      const c = await getCandidateById(n.ref_user);
      if (c) onOpenCandidate(c, statuses[n.ref_user]);
    } catch (e) { /* yoksay */ }
  };

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const exitSelect = () => { setSelectMode(false); setSelectedIds([]); setCodeChips([]); setCodeInput(''); setCodeError(false); };

  // Koda göre adayı bul: seçim modunda seçime ekle, değilse adayı aç. (Her zaman erişilebilir.)
  const handleCode = async () => {
    const parsed = parseCode(codeInput);
    if (!parsed) { setCodeError(true); return; }
    setCodeBusy(true); setCodeError(false);
    try {
      const row = await findCandidateByCode(parsed.nationality, parsed.regNo);
      if (!row) { setCodeError(true); return; }
      Keyboard.dismiss();
      setCodeInput('');
      if (selectMode) {
        const code = candidateCode(row.data?.nationality, row.reg_no);
        setSelectedIds((prev) => (prev.includes(row.user_id) ? prev : [...prev, row.user_id]));
        setCodeChips((prev) => (prev.find((c) => c.user_id === row.user_id) ? prev : [...prev, { user_id: row.user_id, code, photo: row.data?.photoClose || row.data?.photo || row.data?.photoFull }]));
      } else {
        onOpenCandidate(row, statuses[row.user_id]);
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
    if (!favEmployer?.id || !candidateId) return;
    try {
      await removeFavorite(userId, favEmployer.id, candidateId);
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
    const showUnfav = !!favEmployer?.id && !selectMode;
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
  const mode = view === 'process' ? subView : view; // interviews | concluded | inprocess | staff

  // Premium kart — moda göre rozet/aksiyon değişir.
  const renderRich = ({ item: c }) => {
    const photo = c.data?.photoClose || c.data?.photo || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality];
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
    } else if (mode === 'inprocess') {
      badgeLabel = t('in_process_label'); badgeStyle = styles.bGreen; dotColor = '#1f8a4c';
    } else { // staff
      const end = c.work_end_at ? new Date(c.work_end_at) : null;
      const expired = end ? Date.now() >= end.getTime() : false;
      badgeLabel = expired ? t('staff_expired') : t('staff_active');
      badgeStyle = expired ? styles.bRed : styles.bGreen; dotColor = expired ? '#a32d2d' : '#1f8a4c';
      if (end) { dateDay = `${weekdayOf(end.toISOString(), lang)}, ${fmtRange(end)}`; strip = expired ? 'red' : 'gold'; }
    }

    return (
      <TouchableOpacity
        style={styles.rich}
        onPress={() => onOpenCandidate(c, mode === 'staff'
          ? { ...(statuses[c.user_id] || {}), status: 'hired', docs_unlocked: true }
          : statuses[c.user_id])}
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
            <Text style={styles.richCode} numberOfLines={1}>{code}{c.title ? `  ·  ${c.title}` : ''}</Text>
            <View style={[styles.badge, badgeStyle]}>
              <View style={[styles.badgeDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.badgeText, { color: dotColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{badgeLabel}</Text>
            </View>
          </View>
          <Text style={styles.richChev}>›</Text>
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
                onChangeText={(v) => { setCodeInput(v.toUpperCase()); setCodeError(false); }}
                placeholder={t('agency_code_ph')}
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCapitalize="characters"
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
            <View style={{ flex: 1 }}>
              <Text style={styles.heroHi} numberOfLines={1}>
                {view === 'pool' ? t('agency_title') : view === 'process' ? t('nav_process') : t('nav_staff')}
              </Text>
              <Text style={[styles.heroTitle, fontsReady && styles.heroTitleFont]} numberOfLines={1}>{t('agency_panel_name')}</Text>
            </View>
            <View style={styles.headerActions}>
              {view === 'pool' ? (
                <TouchableOpacity onPress={() => setSearchOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <SearchIcon color="#e7dcc4" size={21} />
                </TouchableOpacity>
              ) : null}
              <NotificationBell userId={userId} color="#e7dcc4" onNavigate={onNotifNavigate} />
              <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.menuDots}>⋮</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      <View style={styles.accent} />

      {/* Ayarlar: dil + bildirim + hesap — tek kaydırılabilir alt sayfa */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.menuSheet, { maxHeight: winH * 0.86, paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <View style={styles.menuHandle} />
            <View style={styles.menuHeadRow}>
              <Text style={styles.menuHeadTitle}>{t('settings')}</Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.menuCloseBtn}>
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
              <View style={styles.langGrid}>
                {LANGUAGES_SUPPORTED.map((l) => {
                  const on = l.code === lang;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      style={[styles.langChip, on && styles.langChipOn]}
                      onPress={() => {
                        if (on) return;
                        setLang(l.code);
                        setAgencyNotifPrefs({ generalPush, chatPush, preferredLang: l.code }).catch(() => {});
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.langChipText, on && styles.langChipTextOn]} numberOfLines={1}>{l.name}</Text>
                      {on ? <Text style={styles.langChipCheck}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

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

      {/* Acente bilgilerini düzenle */}
      <Modal visible={profOpen} transparent animationType="fade" onRequestClose={() => setProfOpen(false)}>
        <Pressable style={styles.profOverlay} onPress={() => setProfOpen(false)}>
          <Pressable style={styles.profCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.profTitle}>Bilgilerimi Düzenle</Text>
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

      {/* Üst menü: Havuz / Süreç / Personel — segment kontrol */}
      <View style={styles.menu}>
        <View style={styles.segTrack}>
          {['pool', 'process', 'staff'].map((v) => (
            <TouchableOpacity key={v} style={[styles.menuItem, view === v && styles.menuItemOn]} onPress={() => { setView(v); setSearchOpen(false); }} activeOpacity={0.85}>
              <Text style={[styles.menuText, view === v && styles.menuTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t(v === 'pool' ? 'nav_pool' : v === 'process' ? 'nav_process' : 'nav_staff')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Süreç / Personel alt sekmeleri */}
      {view === 'process' ? (
        <View style={styles.subTabs}>
          {['interviews', 'concluded', 'inprocess'].map((sv) => (
            <TouchableOpacity key={sv} style={[styles.subChip, subView === sv && styles.subChipOn]} onPress={() => setSubView(sv)} activeOpacity={0.85}>
              <Text style={[styles.subChipText, subView === sv && styles.subChipTextOn]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{t(sv === 'interviews' ? 'sub_interviews' : sv === 'concluded' ? 'sub_concluded' : 'sub_inprocess')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {view === 'staff' ? (
        <View style={styles.subTabs}>
          <TouchableOpacity style={[styles.subChip, staffView === 'cards' && styles.subChipOn]} onPress={() => setStaffView('cards')} activeOpacity={0.85}>
            <Text style={[styles.subChipText, staffView === 'cards' && styles.subChipTextOn]}>{t('staff_tab_list')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.subChip, staffView === 'arrivals' && styles.subChipOn]} onPress={() => setStaffView('arrivals')} activeOpacity={0.85}>
            <Text style={[styles.subChipText, staffView === 'arrivals' && styles.subChipTextOn]}>🛬 {t('staff_tab_arrivals')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {view !== 'pool' ? (
        listLoading ? (
          <ActivityIndicator color="#c2a25a" style={{ marginTop: 50 }} />
        ) : view === 'staff' && staffView === 'arrivals' ? (
          <AgencyArrivals
            candidates={staffList}
            contentPadBottom={insets.bottom + 24}
            onOpen={(c) => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), status: 'hired', docs_unlocked: true })}
          />
        ) : (
          <>
            {view === 'process' && (mode === 'interviews' || mode === 'concluded') && baseIv.length ? (
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
            <FlatList
              data={mode === 'staff' ? staffList : mode === 'inprocess' ? inProcessList : shownIv}
              keyExtractor={(c) => c.user_id}
              renderItem={renderRich}
              contentContainerStyle={[styles.richContent, { paddingBottom: insets.bottom + 24 }]}
              ListEmptyComponent={<Text style={styles.empty}>{t(mode === 'staff' ? 'staff_empty' : mode === 'concluded' ? 'concluded_empty' : mode === 'inprocess' ? 'inprocess_empty' : 'interviews_empty')}</Text>}
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
          style={[styles.favFilterPill, favEmployer && styles.favFilterPillOn]}
          onPress={() => setFavFilterOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={[styles.favFilterText, favEmployer && styles.favFilterTextOn]} numberOfLines={1}>
            ★ {favEmployer ? favEmployer.name : t('fav_filter_btn')}
          </Text>
          {favEmployer ? (
            <TouchableOpacity
              onPress={() => setFavEmployer(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.favFilterX}
            >
              <Text style={styles.favFilterXText}>✕</Text>
            </TouchableOpacity>
          ) : null}
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
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={styles.empty}>{favEmployer ? t('fav_empty') : t('agency_empty')}</Text>}
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

      <FavoriteEmployerSheet
        visible={favFilterOpen}
        mode="filter"
        agencyId={userId}
        selectedEmployerId={favEmployer?.id || null}
        onPickEmployer={(emp) => setFavEmployer({ id: emp.id, name: emp.name })}
        onClearFilter={() => setFavEmployer(null)}
        onClose={() => setFavFilterOpen(false)}
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

const INK = '#1b2533';
const GOLD = '#c2a25a';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f3ec' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingBottom: 16, backgroundColor: '#16202e', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 7, zIndex: 2 },
  hero: { paddingLeft: 22, paddingRight: 16, paddingBottom: 22, backgroundColor: '#16202e', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 8, zIndex: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroSearchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroSearchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.4, padding: 0 },
  heroSearchGo: { color: '#dcc187', fontWeight: '800', fontSize: 13.5 },
  heroSearchClose: { color: '#e7dcc4', fontSize: 20, fontWeight: '700' },
  heroLogo: { width: 92, height: 64 },
  heroHi: { color: '#c2a25a', fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: 0.3 },
  heroTitleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  headerLogo: { width: 96, height: 60 },
  titleBox: { marginLeft: 6, flexShrink: 1 },
  acente: { color: GOLD, fontSize: 27, fontWeight: '800' },
  acenteFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  acenteSub: { color: '#9aa4b1', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.8, marginTop: 1, textTransform: 'uppercase' },
  accent: { height: 3, backgroundColor: GOLD, zIndex: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
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
  menu: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, zIndex: 5 },
  segTrack: { flexDirection: 'row', backgroundColor: '#202c3d', borderRadius: 999, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  menuItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  menuItemOn: { backgroundColor: GOLD },
  menuText: { fontSize: 13.5, fontWeight: '800', color: '#9aa6b6', letterSpacing: 0.3 },
  menuTextOn: { color: '#16202e' },
  subTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: 'transparent' },
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
  rich: { backgroundColor: '#fff', borderRadius: 20, padding: 15, marginBottom: 14, shadowColor: '#16202e', shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 4 },
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
  bulkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bulkBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  bulkBtnText: { color: INK, fontSize: 15, fontWeight: '800' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, justifyContent: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
