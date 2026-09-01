// Favori: 1) işletme 2) turizm departmanı — Otellerim ile aynı kapak kart tasarımı.
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Image, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers, touchEmployer, getEmployerCoverUrl, saveEmployer } from '../lib/employers';
import { listFavoriteCandidates, listFavoriteDepartmentCounts, listFavoriteEmployerCounts } from '../lib/favorites';
import { loadAgencyRoster, groupRosterByDepartment, loadFormerForEmployer, loadEmployerRoster } from '../lib/employerRoster';
import AgencyHotelsPanel from './AgencyHotelsPanel';
import { langOptions, POSITIONS_BY_SECTOR } from '../cv/options';
import { candidateCode, maskedName } from '../lib/candidateCode';
import AgencyDeskNotes from './AgencyDeskNotes';
import InterviewModal from './InterviewModal';
import HotelCoverArt from './HotelCoverArt';
import { C } from '../lib/theme';
import { offerCandidate, withdrawCandidate } from '../lib/roles';
import { notifyOffer } from '../lib/push';

const BG = '#0A1121';
const CARD = '#121B2E';
const GOLD = '#C8B88E';
const GOLD_D = '#A89468';
const BORDER = 'rgba(168,148,104,0.28)';
const TEXT_SEC = '#8E98A8';
const INK_DARK = '#2A2418';
const COVER_CACHE = new Map();

function CoverBanner({ uri, height = 132 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: '100%', height }} resizeMode="cover" />;
  }
  return <HotelCoverArt height={height} />;
}

function FavPill({ count, label }) {
  if (!count) return null;
  return (
    <View style={styles.pillFav}>
      <Text style={styles.pillFavStar}>★</Text>
      <Text style={styles.pillFavText}>{label}</Text>
    </View>
  );
}

function StaffPill({ count, label }) {
  if (!count) return null;
  return (
    <View style={styles.pillStaff}>
      <Text style={styles.pillStaffText}>{label}</Text>
    </View>
  );
}

/**
 * @param {'add'|'filter'} purpose
 * @param {{ employerId: string, department: string }[]} markedSlots
 */
export default function FavoriteEmployerSheet({
  visible, agencyId, purpose = 'add', markedSlots = [],
  initialEmployerId = null, initialEmployerName = '', initialDepartment = null, initialCoverUrl = null,
  initialHubTab = null, onInitialHubTabConsumed = null,
  candidateStatuses = {}, onSelect, onOpenCandidate, onOpenPipeline, onInitialRestoreConsumed, onClose, light = false, embedded = false, contentPadBottom = null,
}) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const opts = langOptions(lang);
  const deptOptions = opts.POSITIONS_BY_SECTOR?.tourism
    || POSITIONS_BY_SECTOR.tourism.map((v) => ({ value: v, label: v }));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('hotel');
  const [picked, setPicked] = useState(null);
  const [deptCounts, setDeptCounts] = useState({});
  const [hotelCounts, setHotelCounts] = useState({});
  const [coverUrls, setCoverUrls] = useState({});
  const [pickedCoverUrl, setPickedCoverUrl] = useState(null);
  const [favTotal, setFavTotal] = useState(null);
  const [deptLoading, setDeptLoading] = useState(false);
  const [expandedDept, setExpandedDept] = useState(null);
  const [deptCandidates, setDeptCandidates] = useState({});
  const [deptCandLoading, setDeptCandLoading] = useState(null);
  const [interviewCandidate, setInterviewCandidate] = useState(null);
  const [offerStates, setOfferStates] = useState({});
  const [offerBusy, setOfferBusy] = useState(null);
  const [hubTab, setHubTab] = useState('staff');
  const [staffCounts, setStaffCounts] = useState({});
  const [staffForPicked, setStaffForPicked] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [expandedStaffDept, setExpandedStaffDept] = useState(null);
  const [formerForPicked, setFormerForPicked] = useState([]);
  const [expandedFormer, setExpandedFormer] = useState(false);
  const [pendingHubTab, setPendingHubTab] = useState(null);
  const [hotelAdding, setHotelAdding] = useState(false);
  const openGen = useRef(0);
  const deptScrollRef = useRef(null);
  const scrollRestoreTimer = useRef(null);
  const restoreStarted = useRef(false);

  const markedEmp = useMemo(() => new Set((markedSlots || []).map((s) => s.employerId)), [markedSlots]);
  const markedDeptForPicked = useMemo(() => {
    if (!picked?.id) return new Set();
    return new Set(
      (markedSlots || []).filter((s) => s.employerId === picked.id).map((s) => s.department),
    );
  }, [markedSlots, picked]);

  const loadCoverUrls = useCallback(async (list) => {
    if (!agencyId || !list?.length) {
      setCoverUrls({});
      return;
    }
    const withCover = list.filter((r) => r.hasCover);
    if (!withCover.length) {
      setCoverUrls({});
      return;
    }
    const entries = await Promise.all(
      withCover.map(async (r) => {
        const cacheKey = `${agencyId}:${r.id}:${r.coverImagePath}`;
        const cached = COVER_CACHE.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) return [r.id, cached.url];
        try {
          const url = await getEmployerCoverUrl(agencyId, r.id, 3600, r.coverImagePath);
          if (url) COVER_CACHE.set(cacheKey, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
          return url ? [r.id, url] : null;
        } catch {
          return null;
        }
      }),
    );
    setCoverUrls(Object.fromEntries(entries.filter(Boolean)));
  }, [agencyId]);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const [list, counts, roster] = await Promise.all([
        listEmployers(agencyId),
        purpose === 'filter' ? listFavoriteEmployerCounts(agencyId) : Promise.resolve({}),
        purpose === 'filter' ? loadAgencyRoster(agencyId) : Promise.resolve({ staffCounts: {} }),
      ]);
      setRows(list || []);
      setHotelCounts(counts || {});
      setStaffCounts(roster?.staffCounts || {});
      loadCoverUrls(list || []).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [agencyId, purpose, loadCoverUrls]);

  const openDeptStep = useCallback(async (employer, departmentToOpen = null, knownCoverUrl = null) => {
    if (!employer?.id) return;
    const gen = ++openGen.current;
    setPicked(employer);
    setStep('dept');
    setDeptLoading(true);
    setFavTotal(null);
    setDeptCounts({});
    setExpandedDept(departmentToOpen || null);
    setDeptCandidates({});
    setDeptCandLoading(null);
    setPickedCoverUrl(knownCoverUrl || null);
    if (purpose === 'filter') {
      setHubTab('staff');
      setStaffForPicked([]);
      setExpandedStaffDept(null);
      setRosterLoading(true);
    }

    // Son kullanılan zamanı beklemeden ekranı aç; bu yazma işlemi arka planda tamamlanır.
    touchEmployer(agencyId, employer.id).catch(() => {});
    const coverPromise = knownCoverUrl
      ? Promise.resolve(knownCoverUrl)
      : employer.hasCover
        ? getEmployerCoverUrl(agencyId, employer.id, 3600, employer.coverImagePath).catch(() => null)
        : Promise.resolve(null);
    const countsPromise = listFavoriteDepartmentCounts(agencyId, employer.id)
      .catch(() => ({ departments: [], totalPeople: 0 }));
    const candidatesPromise = departmentToOpen
      ? listFavoriteCandidates(agencyId, employer.id, departmentToOpen).catch(() => [])
      : Promise.resolve(null);

    const rosterPromise = purpose === 'filter'
      ? Promise.all([
        loadAgencyRoster(agencyId).catch(() => ({ staffCounts: {}, staffByEmployer: {} })),
        loadEmployerRoster(agencyId, employer.id).catch(() => []),
      ])
      : Promise.resolve(null);

    const formerPromise = purpose === 'filter'
      ? loadFormerForEmployer(agencyId, employer.id).catch(() => [])
      : Promise.resolve([]);

    try {
      const [coverUrl, counts, candidates, rosterPack, former] = await Promise.all([
        coverPromise,
        countsPromise,
        candidatesPromise,
        rosterPromise,
        formerPromise,
      ]);
      if (gen !== openGen.current) return;
      const { departments, totalPeople } = counts;
      let fullRoster = null;
      let staffList = [];
      if (purpose === 'filter' && rosterPack) {
        [fullRoster, staffList] = rosterPack;
        staffList = staffList || fullRoster?.staffByEmployer?.[employer.id] || [];
      }
      setPickedCoverUrl(coverUrl);
      const map = {};
      (departments || []).forEach((r) => { map[r.department] = r.count; });
      setDeptCounts(map);
      setFavTotal(totalPeople || 0);
      if (purpose === 'filter' && fullRoster) {
        setStaffCounts(fullRoster.staffCounts || {});
        setStaffForPicked(staffList);
        setHubTab(pendingHubTab || (staffList.length > 0 ? 'staff' : 'favorites'));
        if (pendingHubTab) setPendingHubTab(null);
        setFormerForPicked(former || []);
        setExpandedFormer(false);
      }
      if (departmentToOpen) {
        if (gen === openGen.current) setDeptCandidates({ [departmentToOpen]: candidates || [] });
        if (gen === openGen.current) setDeptCandLoading(null);
      }
    } finally {
      if (gen === openGen.current) {
        setDeptLoading(false);
        if (purpose === 'filter') setRosterLoading(false);
      }
    }
  }, [agencyId, pendingHubTab, purpose]);

  useEffect(() => {
    if (initialHubTab) setPendingHubTab(initialHubTab);
  }, [initialHubTab, visible]);

  useEffect(() => {
    if (!visible) {
      restoreStarted.current = false;
      return undefined;
    }
    if (initialEmployerId) {
      openGen.current += 1;
      refresh();
      restoreStarted.current = true;
      openDeptStep({ id: initialEmployerId, name: initialEmployerName || '' }, initialDepartment, initialCoverUrl).catch(() => {});
      onInitialHubTabConsumed?.();
      onInitialRestoreConsumed?.();
    } else if (!restoreStarted.current) {
      openGen.current += 1;
      refresh();
      setStep('hotel');
      setPicked(null);
      setPickedCoverUrl(null);
      setDeptCounts({});
      setFavTotal(null);
      setExpandedDept(null);
      setDeptCandidates({});
      setDeptCandLoading(null);
    }
    return undefined;
  }, [visible, initialEmployerId, initialEmployerName, initialDepartment, initialCoverUrl, refresh, openDeptStep, onInitialRestoreConsumed]);

  useEffect(() => () => {
    if (scrollRestoreTimer.current) clearTimeout(scrollRestoreTimer.current);
  }, []);

  const scheduleDepartmentScroll = useCallback((offsetY) => {
    const y = Number(offsetY);
    if (!Number.isFinite(y)) return;
    if (scrollRestoreTimer.current) clearTimeout(scrollRestoreTimer.current);
    scrollRestoreTimer.current = setTimeout(() => {
      const scroll = deptScrollRef.current;
      if (scroll && typeof scroll.scrollTo === 'function') {
        scroll.scrollTo({ y: Math.max(0, y - 8), animated: false });
      }
      scrollRestoreTimer.current = null;
    }, 80);
  }, []);

  const pickDept = (department) => {
    if (!picked || !department) return;
    if (purpose === 'filter') {
      if (expandedDept === department) {
        setExpandedDept(null);
        return;
      }
      setExpandedDept(department);
      if (deptCandidates[department]) return;
      setDeptCandLoading(department);
      listFavoriteCandidates(agencyId, picked.id, department)
        .then((list) => setDeptCandidates((prev) => ({ ...prev, [department]: list || [] })))
        .finally(() => setDeptCandLoading(null));
      return;
    }
    onSelect?.({ employer: picked, department });
  };

  const goBackToHotels = () => {
    openGen.current += 1;
    setStep('hotel');
    setPicked(null);
    setPickedCoverUrl(null);
    setFavTotal(null);
    setDeptCounts({});
    setExpandedDept(null);
    setDeptCandidates({});
    setDeptCandLoading(null);
    setDeptLoading(false);
    setHubTab('staff');
    setStaffForPicked([]);
    setExpandedStaffDept(null);
    setRosterLoading(false);
  };

  const goBack = () => {
    if (step === 'dept') {
      goBackToHotels();
      return;
    }
    onClose?.();
  };

  const addEmployer = async () => {
    if (!agencyId || hotelAdding) return;
    setHotelAdding(true);
    try {
      const row = await saveEmployer(agencyId, {
        name: t('hotels_new_name'),
        title: t('hotels_new_name'),
        address: '—',
      });
      await refresh();
      setPendingHubTab('info');
      await openDeptStep(row);
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setHotelAdding(false);
    }
  };

  const isOfferSent = (candidate) => (
    offerStates[candidate?.user_id] ?? candidateStatuses?.[candidate?.user_id]?.status === 'offered'
  );

  const quickOffer = (candidate) => {
    if (!candidate?.user_id || offerBusy) return;
    const sent = isOfferSent(candidate);
    if (sent) {
      Alert.alert(t('offer_withdraw_btn'), t('agency_withdraw_confirm'), [
        { text: t('consent_cancel'), style: 'cancel' },
        {
          text: t('offer_withdraw_btn'),
          style: 'destructive',
          onPress: async () => {
            setOfferBusy(candidate.user_id);
            try {
              await withdrawCandidate(candidate.user_id, 'offer_withdraw');
              setOfferStates((prev) => ({ ...prev, [candidate.user_id]: false }));
            } catch (e) {
              Alert.alert(t('offer_withdraw_btn'), e?.message || 'error');
            } finally {
              setOfferBusy(null);
            }
          },
        },
      ]);
      return;
    }
    Alert.alert(t('agency_offer'), `${t('agency_offer')}?`, [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('agency_offer'),
        onPress: async () => {
          setOfferBusy(candidate.user_id);
          try {
            await offerCandidate(candidate.user_id);
            notifyOffer(candidate.user_id, 'offer', agencyId);
            setOfferStates((prev) => ({ ...prev, [candidate.user_id]: true }));
          } catch (e) {
            const msg = String(e?.message || e || '');
            Alert.alert(
              t('agency_offer'),
              msg.includes('employer_incomplete')
                ? (t('employer_need_details') || 'Otel bilgilerini tamamlayın.')
                : msg || 'error',
            );
          } finally {
            setOfferBusy(null);
          }
        },
      },
    ]);
  };

  const title = step === 'dept'
    ? t('fav_title_dept')
    : (purpose === 'filter' && embedded ? t('hotels_working_title') : (purpose === 'filter' ? t('hotels_title') : t('fav_title_add')));
  const sub = step === 'dept'
    ? (purpose === 'filter' ? t('fav_sub_dept_filter') : t('fav_sub_dept_add'))
    : (purpose === 'filter' ? t('fav_sub_filter') : t('fav_sub_add'));
  const listBottom = contentPadBottom ?? (insets.bottom + (purpose === 'add' ? 88 : 24));
  const staffGrouped = useMemo(
    () => groupRosterByDepartment(staffForPicked, deptOptions),
    [staffForPicked, deptOptions],
  );
  const pickedStaffN = staffForPicked.length;
  const pickedFavN = favTotal ?? 0;

  const renderRosterRow = (c) => {
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const name = maskedName(c.data) || code;
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const statusLabel = c.rosterStatus === 'transit' ? t('employer_roster_transit') : t('employer_roster_active');
    return (
      <View key={c.user_id} style={styles.candidateRow}>
        <TouchableOpacity
          style={styles.candidateMain}
          onPress={() => onOpenCandidate?.(c, {
            _returnToHotels: true,
            _returnEmployerId: picked?.id,
            _returnEmployerName: picked?.name,
            _returnDepartment: null,
            _returnCoverUrl: pickedCoverUrl || coverUrls[picked?.id] || null,
          })}
          disabled={!onOpenCandidate}
          activeOpacity={0.8}
        >
          <View style={styles.candidateAvatar}>
            {photo ? <Image source={{ uri: photo }} style={styles.candidateAvatarImg} /> : <Text style={styles.candidateAvatarText}>👤</Text>}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.candidateName, light && lightStyles.candidateName]} numberOfLines={1}>{name}</Text>
            <Text style={[styles.candidateMeta, light && lightStyles.candidateMeta]} numberOfLines={1}>
              {code}{c.title ? `  ·  ${c.title}` : ''}
            </Text>
          </View>
          <View style={styles.rosterStatusPill}>
            <Text style={styles.rosterStatusText}>{statusLabel}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHotelCard = (e) => {
    const on = markedEmp.has(e.id);
    const fn = hotelCounts[e.id] || 0;
    const sn = staffCounts[e.id] || 0;
    const coverUri = coverUrls[e.id];
    return (
      <TouchableOpacity
        key={e.id}
        style={[styles.hotelCard, light && lightStyles.hotelCard, on && styles.hotelCardOn]}
        onPress={() => openDeptStep(e)}
        activeOpacity={0.88}
      >
        <CoverBanner uri={coverUri} height={128} />
        <LinearGradient colors={['transparent', light ? 'rgba(20,32,51,0.12)' : 'rgba(18,27,46,0.35)']} style={styles.cardGrad} pointerEvents="none" />
        <View style={styles.hotelCardBody}>
          <View style={styles.hotelCardTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, light && lightStyles.rowTitle]} numberOfLines={1}>{e.name}</Text>
              <Text style={[styles.rowSub, light && lightStyles.rowSub]} numberOfLines={1}>{e.title || '—'}</Text>
            </View>
            <Text style={[styles.chev, light && lightStyles.chev]}>›</Text>
          </View>
          <View style={styles.pillRow}>
            {on ? (
              <View style={styles.pillMarked}>
                <Text style={styles.pillMarkedTxt}>★ {t('fav_btn')}</Text>
              </View>
            ) : null}
            <FavPill count={fn} label={t('fav_count', { n: String(fn) })} />
            <StaffPill count={sn} label={t('employer_staff_count', { n: String(sn) })} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const shell = (
      <View style={[styles.wrap, light && lightStyles.wrap]}>
        <View style={[styles.header, light && lightStyles.header, { paddingTop: embedded ? 8 : insets.top + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.backChevron, light && lightStyles.backChevron]}>{backChevron}</Text>
          </TouchableOpacity>
          <View style={styles.headerMid}>
            {title ? <Text style={[styles.title, light && lightStyles.title]} numberOfLines={1}>{title}</Text> : null}
            {step === 'dept' ? (
              <Text style={[styles.backHint, light && lightStyles.backHint]} numberOfLines={1}>{t('fav_back_hotels')}</Text>
            ) : null}
          </View>
          {purpose === 'add' ? (
            <TouchableOpacity style={styles.doneBtn} onPress={() => onClose?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.doneText, light && lightStyles.doneText]}>{t('fav_done')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.closeHit} onPress={() => onClose?.()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.closeX, light && lightStyles.closeX]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {step === 'hotel' ? (
            <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.list, { paddingBottom: listBottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
          >
            {purpose !== 'filter' ? (
              <>
                <Text style={[styles.kicker, light && lightStyles.kicker]}>{t('hotels_title').toUpperCase()}</Text>
                <Text style={[styles.lead, light && lightStyles.lead]}>{sub}</Text>
              </>
            ) : null}
            {purpose === 'filter' ? (
              <>
                <Text style={[styles.kicker, light && lightStyles.kicker]}>{t('hotels_working_title').toUpperCase()}</Text>
                <Text style={[styles.lead, light && lightStyles.lead]}>{t('agency_hotels_hub_hint')}</Text>
              </>
            ) : null}
            {purpose === 'filter' ? (
              <TouchableOpacity
                style={[styles.addHotelBtn, light && lightStyles.addHotelBtn, (hotelAdding || loading) && { opacity: 0.6 }]}
                onPress={addEmployer}
                disabled={hotelAdding || loading}
                activeOpacity={0.9}
              >
                {hotelAdding ? <ActivityIndicator color={GOLD} /> : <Text style={[styles.addHotelBtnText, light && lightStyles.addHotelBtnText]}>+ {t('hotels_add')}</Text>}
              </TouchableOpacity>
            ) : null}
            {loading ? (
              <ActivityIndicator color={GOLD} style={{ marginTop: 32 }} />
            ) : (
              <>
                {rows.map((e) => renderHotelCard(e))}
                {rows.length === 0 ? (
                  <Text style={[styles.empty, light && lightStyles.empty]}>{t('fav_need_hotel')}</Text>
                ) : null}
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView
            ref={deptScrollRef}
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
            contentContainerStyle={[styles.list, { paddingBottom: listBottom }]}
          >
            <View style={styles.deptHero}>
              <CoverBanner uri={pickedCoverUrl} height={140} />
              <LinearGradient colors={['transparent', light ? 'rgba(10,17,33,0.72)' : 'rgba(10,17,33,0.92)']} style={styles.deptHeroGrad} pointerEvents="none" />
              <View style={styles.deptHeroBottom}>
                <Text style={styles.deptHeroTitle} numberOfLines={2}>{picked?.name}</Text>
                <View style={styles.heroStatRow}>
                  {pickedStaffN > 0 ? (
                    <View style={styles.heroStatPill}>
                      <Text style={styles.heroStatNum}>{String(pickedStaffN)}</Text>
                      <Text style={styles.heroStatLbl}>{t('employer_hub_tab_staff')}</Text>
                    </View>
                  ) : null}
                  {pickedFavN > 0 ? (
                    <View style={[styles.heroStatPill, styles.heroStatPillFav]}>
                      <Text style={styles.heroStatNum}>{String(pickedFavN)}</Text>
                      <Text style={styles.heroStatLbl}>{t('employer_hub_tab_favorites')}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
            {purpose === 'filter' ? (
              <View style={[styles.hubTabs, light && lightStyles.hubTabs]}>
                {[
                  { id: 'staff', label: t('employer_hub_tab_staff'), n: pickedStaffN },
                  { id: 'favorites', label: t('employer_hub_tab_favorites'), n: pickedFavN },
                  { id: 'info', label: t('employer_hub_tab_info'), n: 0 },
                ].map((tab) => {
                  const onTab = hubTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.hubTab, onTab && styles.hubTabOn, light && lightStyles.hubTab, onTab && light && lightStyles.hubTabOn]}
                      onPress={() => setHubTab(tab.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.hubTabText, onTab && styles.hubTabTextOn, light && lightStyles.hubTabText, onTab && light && lightStyles.hubTabTextOn]}>
                        {tab.label}{tab.n > 0 ? ` (${tab.n})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            {purpose === 'filter' && hubTab === 'staff' ? (
              <>
                <Text style={[styles.lead, light && lightStyles.lead]}>{t('employer_hub_sub_staff')}</Text>
                {onOpenPipeline && picked?.id ? (
                  <TouchableOpacity
                    style={[styles.pipelineLink, light && lightStyles.pipelineLink]}
                    onPress={() => onOpenPipeline(picked)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pipelineLinkText, light && lightStyles.pipelineLinkText]}>{t('employer_hub_open_pipeline')}</Text>
                  </TouchableOpacity>
                ) : null}
                {rosterLoading || deptLoading ? (
                  <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
                ) : pickedStaffN === 0 && formerForPicked.length === 0 ? (
                  <Text style={[styles.empty, light && lightStyles.empty]}>{t('employer_roster_empty')}</Text>
                ) : (
                  <>
                    {pickedStaffN > 0 ? deptOptions.map((o) => {
                      const list = staffGrouped.buckets[o.value] || [];
                      if (!list.length) return null;
                      const open = expandedStaffDept === o.value;
                      return (
                        <View key={`staff-${o.value}`} style={[styles.deptCard, light && lightStyles.deptCard, open && styles.deptCardOpen]}>
                          <TouchableOpacity
                            onPress={() => setExpandedStaffDept(open ? null : o.value)}
                            activeOpacity={0.85}
                          >
                            <View style={styles.deptRow}>
                              <Text style={[styles.deptName, light && lightStyles.deptName]} numberOfLines={2}>
                                {o.label}
                              </Text>
                              <Text style={[styles.deptHint, light && lightStyles.deptHint]}>{list.length}</Text>
                            </View>
                          </TouchableOpacity>
                          {open ? list.map(renderRosterRow) : null}
                        </View>
                      );
                    }) : null}
                    {pickedStaffN > 0 && staffGrouped.other.length > 0 ? (
                      <View style={[styles.deptCard, light && lightStyles.deptCard, expandedStaffDept === '__other__' && styles.deptCardOpen]}>
                        <TouchableOpacity onPress={() => setExpandedStaffDept(expandedStaffDept === '__other__' ? null : '__other__')} activeOpacity={0.85}>
                          <View style={styles.deptRow}>
                            <Text style={[styles.deptName, light && lightStyles.deptName]}>—</Text>
                            <Text style={[styles.deptHint, light && lightStyles.deptHint]}>{staffGrouped.other.length}</Text>
                          </View>
                        </TouchableOpacity>
                        {expandedStaffDept === '__other__' ? staffGrouped.other.map(renderRosterRow) : null}
                      </View>
                    ) : null}
                    {formerForPicked.length > 0 ? (
                      <View style={[styles.deptCard, light && lightStyles.deptCard, expandedFormer && styles.deptCardOpen]}>
                        <TouchableOpacity onPress={() => setExpandedFormer(!expandedFormer)} activeOpacity={0.85}>
                          <View style={styles.deptRow}>
                            <Text style={[styles.deptName, light && lightStyles.deptName]}>{t('employer_roster_former')}</Text>
                            <Text style={[styles.deptHint, light && lightStyles.deptHint]}>{formerForPicked.length}</Text>
                          </View>
                        </TouchableOpacity>
                        {expandedFormer ? formerForPicked.map((c) => {
                          const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
                          const name = maskedName(c.data) || code;
                          const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
                          return (
                            <View key={c.episode_id || c.user_id} style={styles.candidateRow}>
                              <TouchableOpacity
                                style={styles.candidateMain}
                                onPress={() => onOpenCandidate?.(c, {
                                  _returnToHotels: true,
                                  _returnEmployerId: picked?.id,
                                  _returnEmployerName: picked?.name,
                                  _returnDepartment: null,
                                  _returnCoverUrl: pickedCoverUrl || coverUrls[picked?.id] || null,
                                  former: true,
                                })}
                                disabled={!onOpenCandidate}
                                activeOpacity={0.8}
                              >
                                <View style={styles.candidateAvatar}>
                                  {photo ? <Image source={{ uri: photo }} style={styles.candidateAvatarImg} /> : <Text style={styles.candidateAvatarText}>👤</Text>}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[styles.candidateName, light && lightStyles.candidateName]} numberOfLines={1}>{name}</Text>
                                  <Text style={[styles.candidateMeta, light && lightStyles.candidateMeta]} numberOfLines={1}>
                                    {code}{c.job_position || c.title ? `  ·  ${c.job_position || c.title}` : ''}
                                  </Text>
                                </View>
                                <View style={[styles.rosterStatusPill, styles.rosterStatusFormer]}>
                                  <Text style={styles.rosterStatusTextFormer}>{t('employer_roster_former')}</Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          );
                        }) : null}
                      </View>
                    ) : null}
                  </>
                )}
              </>
            ) : purpose === 'filter' && hubTab === 'info' && picked?.id ? (
              <AgencyHotelsPanel
                agencyId={agencyId}
                fixedEmployerId={picked.id}
                embedInHub
                contentPadBottom={listBottom}
                onEmployerUpdated={(emp) => {
                  setPicked(emp);
                  refresh();
                }}
              />
            ) : (
              <>
            <Text style={[styles.lead, light && lightStyles.lead]}>{sub}</Text>
            {picked?.id && purpose !== 'filter' ? (
              <AgencyDeskNotes agencyId={agencyId} employerId={picked.id} compact dark={!light} />
            ) : null}
            {picked?.id && purpose === 'filter' && hubTab === 'favorites' ? (
              <AgencyDeskNotes agencyId={agencyId} employerId={picked.id} compact dark={!light} />
            ) : null}
            {deptLoading ? (
              <ActivityIndicator color={GOLD} style={{ marginVertical: 24 }} />
            ) : (
              deptOptions.map((o) => {
                const n = deptCounts[o.value] || 0;
                const on = markedDeptForPicked.has(o.value);
                const label = purpose === 'filter'
                  ? t('fav_dept_count', { label: o.label, n: String(n) })
                  : o.label;
                const open = purpose === 'filter' && expandedDept === o.value;
                const candidates = deptCandidates[o.value] || [];
                return (
                  <View
                    key={o.value}
                    style={[styles.deptCard, light && lightStyles.deptCard, on && styles.deptCardOn, open && styles.deptCardOpen, purpose === 'filter' && n === 0 && styles.deptCardDim]}
                    onLayout={(event) => {
                      if (initialDepartment === o.value && open) {
                        scheduleDepartmentScroll(event.nativeEvent?.layout?.y);
                      }
                    }}
                  >
                    <TouchableOpacity onPress={() => pickDept(o.value)} activeOpacity={0.85} disabled={purpose === 'filter' && n === 0}>
                      <View style={styles.deptRow}>
                        {purpose === 'add' ? (
                          <Text style={styles.deptStar}>{on ? '★' : '☆'}</Text>
                        ) : null}
                        <Text style={[styles.deptName, light && lightStyles.deptName]} numberOfLines={2}>{label}</Text>
                        <Text style={[styles.deptHint, light && lightStyles.deptHint]}>
                          {purpose === 'add' ? (on ? t('fav_remove') : t('fav_add_tap')) : (n > 0 ? (open ? 'Listeyi kapat' : t('fav_open_list')) : '—')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {open ? (
                      deptCandLoading === o.value ? (
                        <ActivityIndicator color={GOLD} style={{ marginVertical: 12 }} />
                      ) : candidates.length ? (
                        candidates.map((c) => {
                          const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
                          const name = maskedName(c.data) || code;
                          const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
                          return (
                            <View key={c.user_id} style={styles.candidateRow}>
                              <TouchableOpacity
                                style={styles.candidateMain}
                                onPress={() => onOpenCandidate?.(c, {
                                  _returnToHotels: true,
                                  _returnEmployerId: picked?.id,
                                  _returnEmployerName: picked?.name,
                                  _returnDepartment: o.value,
                                  _returnCoverUrl: pickedCoverUrl || coverUrls[picked?.id] || null,
                                })}
                                disabled={!onOpenCandidate}
                                activeOpacity={0.8}
                              >
                                <View style={styles.candidateAvatar}>
                                  {photo ? <Image source={{ uri: photo }} style={styles.candidateAvatarImg} /> : <Text style={styles.candidateAvatarText}>👤</Text>}
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={[styles.candidateName, light && lightStyles.candidateName]} numberOfLines={1}>{name}</Text>
                                  <Text style={[styles.candidateMeta, light && lightStyles.candidateMeta]} numberOfLines={1}>
                                    {code}{c.title ? `  ·  ${c.title}` : ''}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              {purpose === 'filter' ? (
                                <View style={styles.candidateActions}>
                                  <TouchableOpacity
                                    style={[styles.quickBtn, light && lightStyles.quickBtn]}
                                    onPress={() => setInterviewCandidate(c)}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={[styles.quickBtnText, light && lightStyles.quickBtnText]}>{t('hotels_quick_interview')}</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.quickBtn, styles.quickBtnOffer, offerBusy === c.user_id && styles.quickBtnBusy]}
                                    onPress={() => quickOffer(c)}
                                    disabled={offerBusy === c.user_id}
                                    activeOpacity={0.85}
                                  >
                                    <Text style={styles.quickBtnOfferText}>
                                      {isOfferSent(c) ? t('offer_withdraw_short') : t('hotels_quick_offer')}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              ) : null}
                            </View>
                          );
                        })
                      ) : (
                        <Text style={[styles.candidateEmpty, light && lightStyles.candidateEmpty]}>{t('fav_empty')}</Text>
                      )
                    ) : null}
                  </View>
                );
              })
            )}
              </>
            )}
          </ScrollView>
        )}

        {purpose === 'add' && step === 'dept' ? (
          <View style={[styles.footer, light && lightStyles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity style={[styles.footerBack, light && lightStyles.footerBack]} onPress={goBackToHotels} activeOpacity={0.85}>
              <Text style={[styles.footerBackText, light && lightStyles.footerBackText]}>{backChevron} {t('fav_back_hotels')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerDone} onPress={() => onClose?.()} activeOpacity={0.85}>
              <Text style={[styles.footerDoneText, light && lightStyles.footerDoneText]}>{t('fav_done')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
  );

  return (
    <>
      {embedded ? (visible ? shell : null) : (
        <Modal visible={visible} animationType="slide" onRequestClose={goBack}>
          {shell}
        </Modal>
      )}
      <InterviewModal
        visible={!!interviewCandidate}
        role="agency"
        userId={interviewCandidate?.user_id}
        agencyId={agencyId}
        employerId={picked?.id || null}
        candidateLabel={interviewCandidate ? [maskedName(interviewCandidate.data), candidateCode(interviewCandidate.data?.nationality || interviewCandidate.nationality, interviewCandidate.reg_no)].filter(Boolean).join(' · ') : ''}
        onClose={() => setInterviewCandidate(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10, gap: 4,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: GOLD, fontWeight: '700', marginTop: -3 },
  headerMid: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: '#f0ece4', textAlign: 'center' },
  backHint: { fontSize: 11, fontWeight: '700', color: GOLD_D, marginTop: 2 },
  doneBtn: { paddingHorizontal: 8, paddingVertical: 6, minWidth: 52, alignItems: 'flex-end' },
  doneText: { fontSize: 14, fontWeight: '800', color: GOLD },
  closeHit: { width: 36, alignItems: 'flex-end' },
  closeX: { fontSize: 16, fontWeight: '800', color: TEXT_SEC },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, color: GOLD_D, marginBottom: 4 },
  lead: { fontSize: 13, fontWeight: '600', color: TEXT_SEC, lineHeight: 18, marginBottom: 14 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  hotelCard: {
    backgroundColor: CARD, borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  hotelCardOn: { borderColor: GOLD, borderWidth: 1.5 },
  cardGrad: { position: 'absolute', left: 0, right: 0, top: 88, height: 48 },
  hotelCardBody: { padding: 14 },
  hotelCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#f0ece4' },
  rowSub: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 3 },
  chev: { fontSize: 22, color: GOLD, fontWeight: '600', marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pillMarked: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(168,148,104,0.55)', backgroundColor: 'rgba(168,148,104,0.12)',
  },
  pillMarkedTxt: { fontSize: 11, fontWeight: '700', color: GOLD },
  pillFav: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillFavStar: { fontSize: 10, color: INK_DARK, fontWeight: '800' },
  pillFavText: { fontSize: 11, fontWeight: '700', color: INK_DARK },
  pillStaff: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(74,184,199,0.45)', backgroundColor: 'rgba(74,184,199,0.14)',
  },
  pillStaffText: { fontSize: 11, fontWeight: '700', color: '#7EC8D8' },
  heroStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroStatPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    backgroundColor: 'rgba(74,184,199,0.18)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,184,199,0.35)',
  },
  heroStatPillFav: { backgroundColor: 'rgba(168,148,104,0.2)', borderColor: BORDER },
  heroStatNum: { fontSize: 16, fontWeight: '800', color: '#9ADCE8' },
  heroStatLbl: { fontSize: 11, fontWeight: '700', color: '#D8DEE6' },
  hubTabs: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 4,
  },
  hubTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  hubTabOn: { backgroundColor: GOLD },
  hubTabText: { fontSize: 13, fontWeight: '800', color: TEXT_SEC },
  hubTabTextOn: { color: INK_DARK },
  rosterStatusPill: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(74,184,199,0.16)', borderWidth: 1, borderColor: 'rgba(74,184,199,0.3)',
  },
  rosterStatusText: { fontSize: 10, fontWeight: '800', color: '#7EC8D8' },
  rosterStatusFormer: { backgroundColor: 'rgba(138,147,160,0.14)', borderColor: 'rgba(138,147,160,0.35)' },
  rosterStatusTextFormer: { fontSize: 10, fontWeight: '800', color: '#9AA3B0' },
  pipelineLink: {
    alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(74,184,199,0.35)', backgroundColor: 'rgba(74,184,199,0.1)',
  },
  pipelineLinkText: { fontSize: 12, fontWeight: '800', color: '#7EC8D8' },
  addHotelBtn: {
    marginBottom: 12, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    backgroundColor: GOLD_BTN,
  },
  addHotelBtnText: { color: INK_DARK, fontWeight: '800', fontSize: 14 },
  empty: { textAlign: 'center', color: TEXT_SEC, fontWeight: '600', marginVertical: 24, lineHeight: 20 },
  deptHero: { height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: CARD },
  deptHeroGrad: { ...StyleSheet.absoluteFillObject },
  deptHeroBottom: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  deptHeroTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 6 },
  favTotalPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 6,
    backgroundColor: 'rgba(168,148,104,0.2)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: BORDER,
  },
  favTotalNum: { fontSize: 18, fontWeight: '800', color: GOLD },
  favTotalLbl: { fontSize: 12, fontWeight: '600', color: '#D8DEE6' },
  deptCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8,
  },
  deptCardOn: { borderColor: GOLD, backgroundColor: 'rgba(168,148,104,0.1)' },
  deptCardOpen: { paddingBottom: 8 },
  deptCardDim: { opacity: 0.5 },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deptStar: { fontSize: 18, color: GOLD, width: 24, textAlign: 'center' },
  deptName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#f0ece4' },
  deptHint: { fontSize: 12, fontWeight: '700', color: GOLD_D, maxWidth: 90, textAlign: 'right' },
  candidateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  candidateMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  candidateAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(168,148,104,0.16)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  candidateAvatarImg: { width: '100%', height: '100%' },
  candidateAvatarText: { fontSize: 16 },
  candidateName: { fontSize: 14, fontWeight: '700', color: '#f0ece4' },
  candidateMeta: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 2 },
  candidateEmpty: { color: TEXT_SEC, fontSize: 12.5, fontWeight: '600', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  candidateActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quickBtn: {
    borderWidth: 1, borderColor: 'rgba(168,148,104,0.55)', backgroundColor: 'rgba(168,148,104,0.12)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 7,
  },
  quickBtnText: { color: GOLD, fontSize: 10, fontWeight: '800' },
  quickBtnOffer: { backgroundColor: GOLD, borderColor: GOLD },
  quickBtnOfferText: { color: INK_DARK, fontSize: 10, fontWeight: '800' },
  quickBtnBusy: { opacity: 0.55 },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: CARD, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  footerBack: {
    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  footerBackText: { fontSize: 14, fontWeight: '700', color: '#f0ece4' },
  footerDone: {
    flex: 1, backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  footerDoneText: { fontSize: 14, fontWeight: '800', color: INK_DARK },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { backgroundColor: C.bg },
  backChevron: { color: C.goldText },
  title: { color: C.ink },
  backHint: { color: C.goldText },
  doneText: { color: C.goldText },
  closeX: { color: C.ink2 },
  kicker: { color: C.goldText },
  lead: { color: C.ink2 },
  hotelCard: { backgroundColor: C.card, borderColor: C.hair },
  rowTitle: { color: C.ink },
  rowSub: { color: C.ink2 },
  chev: { color: C.goldText },
  empty: { color: C.ink2 },
  deptCard: { backgroundColor: C.card, borderColor: C.hair },
  deptName: { color: C.ink },
  deptHint: { color: C.goldText },
  candidateRow: { borderTopColor: C.hair },
  candidateName: { color: C.ink },
  candidateMeta: { color: C.ink2 },
  candidateEmpty: { color: C.ink2, borderTopColor: C.hair },
  hubTabs: { backgroundColor: C.cardAlt, borderWidth: 1, borderColor: C.hair },
  hubTab: {},
  hubTabOn: { backgroundColor: C.ink },
  hubTabText: { color: C.ink2 },
  hubTabTextOn: { color: '#F7F2E8' },
  pipelineLink: { borderColor: 'rgba(11,31,58,0.18)', backgroundColor: 'rgba(11,31,58,0.06)' },
  pipelineLinkText: { color: C.ink },
  addHotelBtn: { backgroundColor: C.gold },
  addHotelBtnText: { color: C.ink },
  quickBtn: { backgroundColor: 'rgba(168,148,104,0.1)', borderColor: 'rgba(168,148,104,0.45)' },
  quickBtnText: { color: C.goldText },
  footer: { backgroundColor: C.card, borderTopColor: C.hair },
  footerBack: { borderColor: C.hair },
  footerBackText: { color: C.ink },
  footerDoneText: { color: '#f7f2e8' },
});
