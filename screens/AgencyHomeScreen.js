// screens/AgencyHomeScreen.js
// Acente paneli — premium aday havuzu (2 sütun foto galeri + alt bilgi).
// Arama yok; bulma ⚙ Filtreler (tam ekran) ile. FlatList sanallaştırma + sonsuz kaydırma.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, FlatList, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Keyboard, Modal, Pressable } from 'react-native';
import Svg, { Line, Circle, Path, Polyline, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listCandidates, listCandidateIds, listStatuses, listCandidatesWithDocs, offerCandidate, findCandidateByCode, listInterviewCandidates, listStaff, listInProcess, declineInterview, getCandidateById } from '../lib/roles';
import { candidateCode, parseCode, maskedName } from '../lib/candidateCode';
import { slotDateKey, slotTime, weekdayOf, fromISO, cancelInterview } from '../lib/interviews';
import { Select } from '../components/Select';
import { DAYS, monthOptions, FLIGHT_YEARS } from '../cv/options';
import AgencyFilterSheet from '../components/AgencyFilterSheet';
import NotificationBell from '../components/NotificationBell';
import PhotoWatermark from '../components/PhotoWatermark';
import { LANGUAGES_SUPPORTED } from '../i18n/languages';

const FILTERS = ['all', 'pending', 'offered', 'active'];
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
// Sekme aktif renkleri (marka + durum paleti): turkuaz / kehribar / zümrüt
const TAB_COLOR = { all: '#2a9db8', pending: '#d99221', offered: '#cf9a3a', active: '#5566d6' };
const TAB_DOT = { all: '#9aa1ac', pending: '#d99221', offered: '#1f3a63', active: '#1f8a4c' };

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
  ['nationalities', 'positions', 'languages', 'skills'].forEach((k) => { if (f[k] && f[k].length) n += 1; });
  return n;
}

export default function AgencyHomeScreen({ userId, onOpenCandidate, onLogout, fontsReady }) {
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [docIds, setDocIds] = useState(new Set()); // kendi belgesini yüklemiş aday user_id'leri
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [advFilters, setAdvFilters] = useState({});
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
  const [searchOpen, setSearchOpen] = useState(false); // header'da açılır arama
  const [view, setView] = useState('pool');          // pool | process | staff
  const [subView, setSubView] = useState('interviews'); // interviews | concluded | inprocess
  const [ivList, setIvList] = useState([]);
  const [inProcessList, setInProcessList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [ivSortDesc, setIvSortDesc] = useState(true);   // yeni -> eski
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState({ s: null, e: null }); // seçili tarih aralığı (Date)
  const [draftFrom, setDraftFrom] = useState({ d: '', m: '', y: '' });
  const [draftTo, setDraftTo] = useState({ d: '', m: '', y: '' });

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
  }, [view, userId, lang, reloadProcess]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [rows, st, dids] = await Promise.all([listCandidates({ filters: advFilters, from: 0, to: PAGE - 1 }), listStatuses(), listCandidatesWithDocs()]);
      if (!alive) return;
      setItems(rows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(rows.length === PAGE); setLoading(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const next = page + 1;
    const rows = await listCandidates({ filters: advFilters, from: next * PAGE, to: next * PAGE + PAGE - 1 });
    setItems((prev) => [...prev, ...rows]); setPage(next); setHasMore(rows.length === PAGE); setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, loading, page, filterKey]);

  const onRefresh = async () => {
    setRefreshing(true);
    const [rows, st, dids] = await Promise.all([listCandidates({ filters: advFilters, from: 0, to: PAGE - 1 }), listStatuses(), listCandidatesWithDocs()]);
    setItems(rows); setStatuses(st); setDocIds(dids); setPage(0); setHasMore(rows.length === PAGE); setRefreshing(false);
  };

  const isAccepted = (id) => statuses[id]?.status === 'accepted';
  const isOffered = (id) => statuses[id]?.status === 'offered';
  // pending = havuzda; offered = teklif gitti (cevap bekleniyor); active = aday KABUL etti (süreçte)
  const category = (id) => (isAccepted(id) ? 'active' : isOffered(id) ? 'offered' : 'pending');
  const isSelected = (id) => selectedIds.includes(id);

  // Bildirime tıklayınca: ilgili aday (ref_user) varsa o adayın ekranını aç.
  const NOTIF_TO_CANDIDATE = ['interview_scheduled', 'document', 'offer_accepted', 'offer_rejected'];
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

  const data = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((c) => category(c.user_id) === filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, statuses, docIds, filter]);

  const PILL = {
    pending: { box: styles.pillPend, dot: styles.dotPend, txt: styles.pillTextPend, label: t('agency_filter_pending') },
    offered: { box: styles.pillOffered, dot: styles.dotOffered, txt: styles.pillTextOffered, label: t('agency_filter_offered') },
    active: { box: styles.pillActive, dot: styles.dotActive, txt: styles.pillTextActive, label: t('agency_filter_active') },
  };

  const renderItem = ({ item: c }) => {
    const cat = category(c.user_id);
    const pill = PILL[cat];
    const photo = c.data?.photoClose || c.data?.photo || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality];
    const sel = isSelected(c.user_id);
    const name = maskedName(c.data) || code;
    return (
      <TouchableOpacity style={[styles.fbCard, sel && styles.fbCardSel]} onPress={() => onCardPress(c)} onLongPress={() => onCardLongPress(c)} delayLongPress={300} activeOpacity={0.92}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.fbPhoto} resizeMode="cover" />
        ) : (
          <View style={[styles.fbPhoto, styles.photoPh]}><Text style={styles.photoIcon}>👤</Text></View>
        )}
        <PhotoWatermark size={26} margin={8} />
        {/* JS katmanlı scrim (native gradient gerektirmez) — yazılar okunur kalsın */}
        <View style={styles.fbScrimA} pointerEvents="none" />
        <View style={styles.fbScrimB} pointerEvents="none" />
        <View style={styles.fbScrimC} pointerEvents="none" />
        {flag ? <Image source={flag} style={styles.fbFlag} resizeMode="cover" /> : null}
        {selectMode ? (
          <View style={[styles.checkbox, sel && styles.checkboxOn]}>
            {sel ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
        ) : null}
        <View style={styles.fbInfo} pointerEvents="none">
          <View style={[styles.fbPill, pill.box]}>
            <View style={[styles.dot, pill.dot]} />
            <Text style={[styles.pillText, pill.txt]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{pill.label}</Text>
          </View>
          <Text style={styles.fbName} numberOfLines={1}>{name}</Text>
          <Text style={styles.fbSub} numberOfLines={1}>{code}{c.title ? `  ·  ${c.title}` : ''}</Text>
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
      <TouchableOpacity style={styles.rich} onPress={() => onOpenCandidate(c, statuses[c.user_id])} activeOpacity={0.92}>
        <View style={styles.richTop}>
          <View style={styles.richPhotoBox}>
            {photo ? <Image source={{ uri: photo }} style={styles.richPhoto} resizeMode="cover" /> : <View style={[styles.richPhoto, styles.photoPh]}><Text style={styles.photoIcon}>👤</Text></View>}
            <PhotoWatermark size={16} margin={4} />
            {flag ? <Image source={flag} style={styles.richFlag} resizeMode="cover" /> : null}
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
          try { await offerCandidate(c.user_id); await cancelInterview(c.user_id); await reloadProcess(); }
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

  // Mülakat(yaklaşan) vs Sonuçlanan: slot saati geçmişse "sonuçlanan".
  const slotMs = (iso) => { const p = fromISO(iso); return p ? new Date(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.hhmm.split(':')[0]), Number(p.hhmm.split(':')[1])).getTime() : 0; };
  const nowMs = Date.now();
  const isConcluded = (c) => c.ivStatus === 'scheduled' && c.ivSlot && slotMs(c.ivSlot) < nowMs;
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

      {/* Header menüsü: Dil seçimi + Çıkış */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.menuSheet, { paddingBottom: insets.bottom + 14 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            {/* Marka — Turquz logosu */}
            <View style={styles.menuBrand}>
              <Image source={require('../assets/turquz-logo.png')} style={styles.menuBrandLogo} resizeMode="contain" />
              <View style={styles.menuBrandRule} />
            </View>
            <Text style={styles.menuTitle}>{t('set_language')}</Text>
            <ScrollView style={styles.menuLangList} keyboardShouldPersistTaps="handled">
              {LANGUAGES_SUPPORTED.map((l) => (
                <TouchableOpacity key={l.code} style={[styles.menuLangRow, l.code === lang && styles.menuLangRowOn]} onPress={() => { setLang(l.code); setMenuOpen(false); }} activeOpacity={0.7}>
                  <Text style={[styles.menuLangName, l.code === lang && styles.menuLangNameOn]}>{l.name}</Text>
                  {l.code === lang ? <Text style={styles.menuCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.menuSep} />
            <TouchableOpacity style={styles.menuLogout} onPress={() => { setMenuOpen(false); onLogout?.(); }} activeOpacity={0.85}>
              <View style={styles.menuLogoutIcon}><LogoutIcon color="#b5413a" size={18} /></View>
              <Text style={styles.menuLogoutText}>{t('set_logout')}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.menuLogoutHint}>→</Text>
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

      {/* Süreç alt sekmeleri */}
      {view === 'process' ? (
        <View style={styles.subTabs}>
          {['interviews', 'concluded', 'inprocess'].map((sv) => (
            <TouchableOpacity key={sv} style={[styles.subChip, subView === sv && styles.subChipOn]} onPress={() => setSubView(sv)} activeOpacity={0.85}>
              <Text style={[styles.subChipText, subView === sv && styles.subChipTextOn]}>{t(sv === 'interviews' ? 'sub_interviews' : sv === 'concluded' ? 'sub_concluded' : 'sub_inprocess')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {view !== 'pool' ? (
        listLoading ? (
          <ActivityIndicator color="#c2a25a" style={{ marginTop: 50 }} />
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

      {/* Durum segmenti + gelişmiş filtre (huni) — arama header'da */}
      <View style={styles.filterRow}>
      <View style={[styles.statusSeg, { flex: 1, marginHorizontal: 0, marginTop: 0, marginBottom: 0 }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[styles.segItem, filter === f && styles.segItemOn]} onPress={() => setFilter(f)} activeOpacity={0.85}>
            {f !== 'all' ? <View style={[styles.segDot, { backgroundColor: TAB_DOT[f] }]} /> : null}
            <Text style={[styles.segItemText, filter === f && styles.segItemTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t(`agency_filter_${f}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
        <TouchableOpacity style={styles.filterIconBtn} onPress={() => setSheetVisible(true)} activeOpacity={0.8}>
          <FilterIcon color="#fff" knobFill={GOLD} size={20} />
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
          data={data}
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
          ListEmptyComponent={<Text style={styles.empty}>{t('agency_empty')}</Text>}
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
        onApply={(f) => { setAdvFilters(f); setSheetVisible(false); }}
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
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
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
  // Header menüsü (alt sayfa)
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.45)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#fbf8f1', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 12 },
  menuHandle: { alignSelf: 'center', width: 44, height: 4.5, borderRadius: 3, backgroundColor: '#e0d6bd', marginBottom: 6 },
  menuBrand: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  menuBrandLogo: { width: 128, height: 88 },
  menuBrandRule: { width: 46, height: 2.5, borderRadius: 2, backgroundColor: GOLD, marginTop: 12, opacity: 0.85 },
  menuTitle: { fontSize: 12, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 6 },
  menuLangList: { maxHeight: 300 },
  menuLangRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 13, marginBottom: 3 },
  menuLangRowOn: { backgroundColor: '#f3ecdc' },
  menuLangName: { fontSize: 16, fontWeight: '600', color: '#2a3342' },
  menuLangNameOn: { fontWeight: '800', color: '#9a7b1f' },
  menuCheck: { fontSize: 16, fontWeight: '900', color: GOLD },
  menuSep: { height: 1, backgroundColor: '#ece4d2', marginTop: 10, marginBottom: 6, marginHorizontal: 4 },
  menuLogout: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff', shadowColor: '#16202e', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  menuLogoutIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fbeae8', alignItems: 'center', justifyContent: 'center' },
  menuLogoutText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },
  menuLogoutHint: { color: '#c9a9a4', fontSize: 19, fontWeight: '800' },
  menu: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, zIndex: 5 },
  segTrack: { flexDirection: 'row', backgroundColor: '#202c3d', borderRadius: 999, padding: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', shadowColor: '#0c1320', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  menuItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  menuItemOn: { backgroundColor: GOLD, shadowColor: '#a8842f', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  menuText: { fontSize: 13.5, fontWeight: '800', color: '#9aa6b6', letterSpacing: 0.3 },
  menuTextOn: { color: '#16202e' },
  subTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: 'transparent' },
  subChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ebe4d5' },
  subChipOn: { backgroundColor: '#16202e', shadowColor: '#0c1320', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  subChipText: { fontSize: 12.5, fontWeight: '800', color: '#737373' },
  subChipTextOn: { color: '#fff' },
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
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ebe4d5', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  sortArrow: { color: GOLD, fontSize: 14, fontWeight: '900' },
  sortPillText: { color: INK, fontWeight: '800', fontSize: 12.5 },
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
  statusSeg: { flexDirection: 'row', marginHorizontal: 16, marginTop: 2, marginBottom: 10, backgroundColor: '#ebe4d5', borderRadius: 999, padding: 4 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 999 },
  segItemOn: { backgroundColor: '#fff', shadowColor: '#16202e', shadowOpacity: 0.13, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  segDot: { width: 6, height: 6, borderRadius: 3 },
  segItemText: { fontSize: 11.5, fontWeight: '800', color: '#a99e86', letterSpacing: 0.2 },
  segItemTextOn: { color: '#16202e' },
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

  filterIconBtn: { width: 46, height: 44, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
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
  fbScrimA: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', backgroundColor: 'rgba(10,15,22,0.22)' },
  fbScrimB: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', backgroundColor: 'rgba(10,15,22,0.34)' },
  fbScrimC: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '20%', backgroundColor: 'rgba(10,15,22,0.5)' },
  fbFlag: { position: 'absolute', top: 11, left: 11, width: 30, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  fbInfo: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 13, paddingBottom: 13, paddingTop: 4 },
  fbPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4.5, marginBottom: 8 },
  fbName: { color: '#fff', fontSize: 16.5, fontWeight: '800', letterSpacing: 0.2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  fbSub: { color: '#e7cf9a', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, marginTop: 3, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },

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
