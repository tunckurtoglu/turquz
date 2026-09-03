// screens/AgencyHomeScreen.js
// Acente paneli — havuz: koyu liste kartları (mock dil); diğer sekmeler mevcut.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, FlatList, SectionList, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Keyboard, Modal, Pressable, useWindowDimensions, Animated, Linking, Platform } from 'react-native';
import Svg, { Line, Circle, Path, Polyline, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listCandidates, listCandidateIds, listStatuses, offerCandidate, findCandidateByCode, findCandidatesByName, listInterviewCandidates, listStaff, listInProcess, listInTransit, declineInterview, getCandidateById } from '../lib/roles';
import { listFormerStaff, scanEmploymentLifecycle, isEmploymentNotif, candidateIdFromNotif } from '../lib/employment';
import { updateMyProfile, getSession } from '../lib/auth';
import { candidateCode, parseCode, maskedName } from '../lib/candidateCode';
import { matchesCandidateQuery, foldSearch } from '../lib/candidateSearch';
import { formatLastSeen, lastSeenTier } from '../lib/lastSeenFormat';
import { slotDateKey, slotTime, weekdayOf, fromISO, formatCountdown, cancelInterview, interviewRespondDeadlineMs, IV_RESPOND_MS } from '../lib/interviews';
import { callWindow, JOIN_PERIOD_MIN } from '../lib/livekitCall';
import { scanOps, notifyOffer } from '../lib/push';
import { Select } from '../components/Select';
import { DAYS, monthOptions, FLIGHT_YEARS, langOptions } from '../cv/options';
import AgencyFilterSheet from '../components/AgencyFilterSheet';
import NotificationBell from '../components/NotificationBell';
import PhotoWatermark from '../components/PhotoWatermark';
import AgencyOpsDesk from '../components/AgencyOpsDesk';
import ContactIcon from '../components/ContactIcon';
import AgencyProfilePlaceholder from '../components/AgencyProfilePlaceholder';
import TurquzWordmark from '../components/TurquzWordmark';
import AgencyNoticeSheet from '../components/AgencyNoticeSheet';
import AgencyChatInboxSheet from '../components/AgencyChatInboxSheet';
import AgencyRemindersSheet from '../components/AgencyRemindersSheet';
import AnnouncementsListSheet from '../components/AnnouncementsListSheet';
import ContactSheet from '../components/ContactSheet';
import { LANGUAGES_ALPHA, nameOf } from '../i18n/languages';
import { getAgencyNotifPrefs, setAgencyNotifPrefs } from '../lib/agencyNotifPrefs';
import {
  getAgencyProfile, saveAgencyTaxPlate, getAgencyTaxPlateUrl, updateAgencyCompanyName,
  saveAgencyProfilePhoto, getAgencyProfilePhotoUrl,
} from '../lib/agencyProfile';
import { agencyCode } from '../lib/agencyCode';
import { syncChatLang } from '../lib/processChat';
import { enrichProcessProgress, unreadChatCount, loadAgencyOps } from '../lib/ops';
import { attachEmployers, groupByEmployer, withFormerEmployerFields } from '../lib/employerAttach';
import { urgentTotal } from '../lib/opsUi';
import { unreadAnnouncementCount } from '../lib/notifications';
import { listRatingStats } from '../lib/ratings';
import RatingBadge from '../components/RatingBadge';
import { listFavoriteCandidates, removeFavorite, addFavorite, hasFavoriteSlot, listAllFavoritedCandidateIds } from '../lib/favorites';
import {
  readAgencyHomeUi, writeAgencyHomeUi, resetAgencyHomeUi,
  PIPELINE_PHASES, phaseOfPipelineStage,
  normalizeAgencyView, normalizePipelineStage,
  isProcessPipelineStage, isStaffPipelineStage, stageFromOpsNav,
} from '../lib/agencyHomeUi';
import AgencyArrivals from '../components/AgencyArrivals';
import { supabase } from '../lib/supabase';
import { listFlights, parseArriveAt } from '../lib/flights';
import ProcessChatSheet from '../components/ProcessChatSheet';
import { C } from '../lib/theme';
import { loadDefaultExport } from '../lib/loadDefaultExport';

// Ağır FavoriteEmployerSheet panel açılışını kırabiliyor.
// İşletme sekmesi: hafif liste (agency_employers). Favori ekleme modalı ayrı.
let _liteComp = null;
let _litePromise = null;
function warmEmployersLite() {
  if (typeof _liteComp === 'function') return Promise.resolve(_liteComp);
  if (!_litePromise) {
    _litePromise = loadDefaultExport(
      () => require('../components/AgencyEmployersLite'),
      'İşletme listesi',
    ).then((C) => { _liteComp = C; return C; })
      .catch((e) => { _litePromise = null; throw e; });
  }
  return _litePromise;
}

let _hubComp = null;
let _hubPromise = null;
function warmFavoriteHub() {
  if (typeof _hubComp === 'function') return Promise.resolve(_hubComp);
  if (!_hubPromise) {
    _hubPromise = loadDefaultExport(
      () => require('../components/FavoriteEmployerSheet'),
      'İşletme merkezi',
    ).then((C) => { _hubComp = C; return C; })
      .catch((e) => { _hubPromise = null; throw e; });
  }
  return _hubPromise;
}

function LazyEmployersLite(props) {
  const [Comp, setComp] = useState(() => (typeof _liteComp === 'function' ? _liteComp : null));
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof Comp === 'function') return undefined;
    let live = true;
    warmEmployersLite()
      .then((C) => { if (live) setComp(() => C); })
      .catch((e) => { if (live) setErr(String(e?.message || e)); });
    return () => { live = false; };
  }, [Comp, tick]);
  if (err) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#8E98A8', textAlign: 'center', marginBottom: 14 }}>{err}</Text>
        <TouchableOpacity
          onPress={() => { setErr(''); setComp(null); setTick((n) => n + 1); }}
          style={{ backgroundColor: '#c2a25a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}
        >
          <Text style={{ color: '#0e141c', fontWeight: '800' }}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (typeof Comp !== 'function') {
    return <View style={{ paddingTop: 48 }}><ActivityIndicator color="#c2a25a" /></View>;
  }
  return <Comp {...props} />;
}

function LazyFavoriteHub(props) {
  const [Sheet, setSheet] = useState(() => (typeof _hubComp === 'function' ? _hubComp : null));
  const [hubErr, setHubErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof Sheet === 'function') return undefined;
    let live = true;
    warmFavoriteHub()
      .then((C) => { if (live) setSheet(() => C); })
      .catch((e) => { if (live) setHubErr(String(e?.message || e)); });
    return () => { live = false; };
  }, [Sheet, tick]);

  if (hubErr) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#8E98A8', textAlign: 'center', marginBottom: 14 }}>{hubErr}</Text>
        <TouchableOpacity
          onPress={() => { setHubErr(''); setSheet(null); setTick((n) => n + 1); }}
          style={{ backgroundColor: '#c2a25a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}
        >
          <Text style={{ color: '#0e141c', fontWeight: '800' }}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (typeof Sheet !== 'function') {
    return (
      <View style={{ paddingTop: 48 }}>
        <ActivityIndicator color="#c2a25a" />
      </View>
    );
  }
  return <Sheet {...props} />;
}

const PAGE = 24;
const FOOTER_CONTENT_PAD = 78;
const MATCH_GOLD = '#A07D35';
const MATCH_GOLD_BTN = '#C8B88E';
const MATCH_BORDER = '#D8CDBB';
const MATCH_DIVIDER = '#E6DED1';
const PIPE_BG = '#0A1121';
const PIPE_CARD = '#121B2E';
const PIPE_GOLD = '#A89468';
const PIPE_GOLD_BTN = '#C8B88E';
const PIPE_BORDER = 'rgba(168,148,104,0.28)';
const PIPE_TEXT_SEC = '#8E98A8';
const PIPE_INK = '#f0ece4';
const OFFER_RESPONSE_MS = 24 * 60 * 60 * 1000;

function isTodayArrival(value) {
  const parsed = parseArriveAt(value);
  if (!parsed?.dt) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return parsed.dt >= start && parsed.dt < end;
}

async function optimizeAgencyPhoto(uri) {
  const actions = [{ resize: { width: 640 } }];
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.84, format: ImageManipulator.SaveFormat.WEBP, base64: true,
    });
    return { dataUri: `data:image/webp;base64,${out.base64}`, mime: 'image/webp' };
  } catch {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.84, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return { dataUri: `data:image/jpeg;base64,${out.base64}`, mime: 'image/jpeg' };
  }
}

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

// Marka — iki V'li amblem, büyük içi boş elmas çerçeve içinde.
const MARK_GOLD = '#C2A25A';
const MARK_TURQUOISE = '#4AB8C7';
// FİLTRE kutusu ana rengi
const FILTRE_GOLD = '#E4B35D';
const FILTRE_GOLD_DARK = '#E4B35D';
const FILTRE_GOLD_LIGHT = '#EBC57A';

// Klasik huni filtre ikonu — mock’taki ince çizgili FİLTRE ikonu
function FunnelIcon({ color = '#1a2030', size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16l-6.5 8.2v5.3l-3 1.5v-6.8L4 5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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

function ClockIcon({ color = MATCH_GOLD, size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.7" />
      <Path d="M12 7.5v4.8l3.2 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function VideoIcon({ color = MATCH_GOLD, size = 15 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="6.5" width="11.5" height="11" rx="2" stroke={color} strokeWidth="1.7" />
      <Path d="M15 10.2l5.5-3.2v9.8L15 13.8" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  );
}

function HotelIcon({ color = MATCH_GOLD, size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" stroke={color} strokeWidth="1.5" />
      <Path d="M4 10h16M9 10V6h6v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Rect x="8" y="14" width="3" height="3" rx="0.4" fill={color} opacity="0.55" />
      <Rect x="13" y="14" width="3" height="3" rx="0.4" fill={color} opacity="0.55" />
    </Svg>
  );
}

function PipelineCategoryIcon({ kind, color = '#6B7480', size = 23 }) {
  const common = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'interviews') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3.5" y="6.5" width="12" height="11" rx="2" {...common} />
        <Path d="M15.5 10.2 21 7v10l-5.5-3.2" {...common} />
        <Circle cx="9.5" cy="12" r="2.2" {...common} />
      </Svg>
    );
  }
  if (kind === 'offered') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="m3.5 9.5 3.8-3 4.1 1.6 1.6-1.1 4 1.3 3.5 3" {...common} />
        <Path d="m6.4 11.2 3.4 3.4c.7.7 1.8.7 2.5 0l1.1-1.1 1.2 1.1c.7.7 1.8.7 2.5 0l2.7-2.7" {...common} />
        <Path d="m10.1 8.1 2.1 2.1c.7.7 1.8.7 2.5 0l1.1-1" {...common} />
      </Svg>
    );
  }
  if (kind === 'inprocess') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 3.5h8l4 4v13H6z" {...common} />
        <Path d="M14 3.5v4h4M9 12h6M9 15.5h6" {...common} />
      </Svg>
    );
  }
  if (kind === 'arrivals') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="m3 14.5 18-5.8-6.2 5.3 2.1 3.2-1.9.6-3-2.8-4.1 3.2-1.8-.6 2-4.1-5.1-1.2z" {...common} />
      </Svg>
    );
  }
  if (kind === 'staff') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="8" r="3" {...common} />
        <Path d="M3.8 19.5c.5-3.1 2.2-4.7 5.2-4.7s4.7 1.6 5.2 4.7" {...common} />
        <Path d="M15.3 5.7a2.8 2.8 0 0 1 0 5.5M16 14.9c2.3.4 3.7 1.9 4.2 4.6" {...common} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 5.5h12v13H6zM9 3.5v4M15 3.5v4M9 11h6M9 14.5h4" {...common} />
    </Svg>
  );
}

function OfferCountdownRing({ msLeft, totalMs, label }) {
  const size = 76;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, msLeft / totalMs));
  const offset = circ * (1 - pct);
  return (
    <View style={matchStyles.cdWrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(168,148,104,0.18)" strokeWidth={3} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={MATCH_GOLD}
            strokeWidth={3}
            fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <Text style={matchStyles.cdTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {formatCountdown(msLeft)}
        </Text>
      </View>
      <Text style={matchStyles.cdLbl}>{label}</Text>
    </View>
  );
}

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

function formatMatchDate(iso, lang) {
  const p = fromISO(iso);
  if (!p) return '';
  const mo = monthOptions(lang).find((o) => Number(o.value) === Number(p.m));
  return `${Number(p.d)} ${mo?.label || p.m} ${p.y}`;
}

function candPosition(c) {
  return (c.title || c.data?.title || c.data?.positions?.[0] || '').trim();
}

function shortCandName(data, code) {
  const n = maskedName(data);
  if (!n) return code;
  const parts = n.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  return n;
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

function FooterMatchesIcon({ color = '#c5ccd6', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="8.2" cy="7.2" r="2.6" stroke={color} strokeWidth="1.7" />
      <Path d="M3.8 18.2c.4-2.8 2.2-4.4 4.4-4.4s4 1.6 4.4 4.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Circle cx="15.8" cy="7.2" r="2.6" stroke={color} strokeWidth="1.7" />
      <Path d="M11.4 18.2c.4-2.8 2.2-4.4 4.4-4.4s4 1.6 4.4 4.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function FooterAnnounceIcon({ color = '#c5ccd6', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.5 10.2v3.6c0 .55.45 1 1 1h1.8l5.2 3.1V6.1L6.3 9.2H5.5c-.55 0-1 .45-1 1Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path d="M15.8 8.4a4.8 4.8 0 0 1 0 7.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M18.6 6a8.2 8.2 0 0 1 0 12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function FooterMessagesIcon({ color = '#c5ccd6', size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 5.5h14a2.2 2.2 0 0 1 2.2 2.2v7.2a2.2 2.2 0 0 1-2.2 2.2h-7.1L7.2 20.3c-.55.38-1.3-.02-1.3-.68V17.1A2.2 2.2 0 0 1 5 14.9V7.7A2.2 2.2 0 0 1 5 5.5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <Path d="M8.5 11.2h7M8.5 8.6h4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function FooterContactIcon({ color = '#c5ccd6', size = 22 }) {
  return <ContactIcon color={color} size={size} />;
}

export default function AgencyHomeScreen({ userId, onOpenCandidate, onLogout, fontsReady, agencyReturn, onAgencyReturnConsumed }) {
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const savedUi = readAgencyHomeUi();
  const [advFilters, setAdvFilters] = useState(() => savedUi.advFilters || {});
  const [sheetVisible, setSheetVisible] = useState(false);
  const [filterFocus, setFilterFocus] = useState(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
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
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineSearchOpen, setPipelineSearchOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolSearchOpen, setPoolSearchOpen] = useState(false);
  const [codeChips, setCodeChips] = useState([]); // koda göre eklenenler {user_id, code, photo}
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const searchSeqRef = useRef(0);
  const poolSnapshotRef = useRef([]);
  const poolSearchActiveRef = useRef(false);
  const codeInputRef = useRef('');
  const poolListRef = useRef(null);
  const filterKey = JSON.stringify(advFilters);
  const activeCount = countFilters(advFilters);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [agencyPhotoUrl, setAgencyPhotoUrl] = useState('');
  const [taxBusy, setTaxBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Kimlik kartı içi profil düzenleme
  const [profOpen, setProfOpen] = useState(false);
  const [profFirst, setProfFirst] = useState('');
  const [profLast, setProfLast] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profCompany, setProfCompany] = useState('');
  const [profPhotoPreview, setProfPhotoPreview] = useState('');
  const [profBusy, setProfBusy] = useState(false);
  const [profErr, setProfErr] = useState('');

  const refreshAgencyProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await getAgencyProfile(userId);
      setAgencyProfile(p);
      if (p?.profilePhotoPath) {
        try {
          setAgencyPhotoUrl(await getAgencyProfilePhotoUrl(userId, p.profilePhotoPath));
        } catch {
          setAgencyPhotoUrl('');
        }
      } else {
        setAgencyPhotoUrl('');
      }
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { refreshAgencyProfile(); }, [refreshAgencyProfile]);

  // İşletme listesini panel açıldıktan sonra ısıt
  useEffect(() => {
    const t = setTimeout(() => { warmEmployersLite().catch(() => {}); }, 800);
    return () => clearTimeout(t);
  }, []);

  const openSettings = () => {
    setLangOpen(false);
    setProfOpen(false);
    setProfPhotoPreview('');
    setMenuOpen(true);
    refreshAgencyProfile();
  };

  const openProfile = async () => {
    try {
      const { session } = await getSession();
      const m = session?.user?.user_metadata || {};
      const p = agencyProfile || await getAgencyProfile(userId);
      setProfFirst(m.first_name || p?.contactFirstName || '');
      setProfLast(m.last_name || p?.contactLastName || '');
      setProfPhone(m.phone || p?.phoneAuthorized || '');
      setProfCompany(p?.companyName || '');
    } catch (e) {
      setProfFirst(''); setProfLast(''); setProfPhone(''); setProfCompany('');
    }
    setProfErr(''); setProfPhotoPreview(''); setProfOpen(true);
  };
  const saveProfile = async () => {
    const f = profFirst.trim(), l = profLast.trim(), p = profPhone.trim();
    const c = profCompany.trim();
    if (!c) { setProfErr('Şirket / işletme adı zorunludur.'); return; }
    if (!f || !l || !p) { setProfErr('Ad, soyad ve telefon zorunludur.'); return; }
    if (p.replace(/\D/g, '').length < 10) { setProfErr('Geçerli bir telefon numarası girin.'); return; }
    setProfErr(''); setProfBusy(true);
    const { error } = await updateMyProfile({ firstName: f, lastName: l, phone: p });
    if (error) { setProfBusy(false); setProfErr(error.message || 'Kaydedilemedi'); return; }
    try {
      await updateAgencyCompanyName(userId, c);
      if (profPhotoPreview) {
        const mime = profPhotoPreview.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/webp';
        await saveAgencyProfilePhoto(userId, profPhotoPreview, mime);
      }
      await refreshAgencyProfile();
    } catch (e) {
      setProfBusy(false);
      setProfErr(e?.message || 'Şirket adı kaydedilemedi');
      return;
    }
    setProfBusy(false);
    setProfPhotoPreview('');
    setProfOpen(false);
  };

  const pickAgencyPhoto = async () => {
    if (photoBusy || profBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('perm_needed'), t('perm_msg'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      setPhotoBusy(true);
      const optimized = await optimizeAgencyPhoto(res.assets[0].uri);
      setProfPhotoPreview(optimized.dataUri);
    } catch (e) {
      Alert.alert(t('err_title') || 'Hata', e?.message || t('err_photo') || 'Fotoğraf seçilemedi');
    } finally {
      setPhotoBusy(false);
    }
  };

  const pickTaxPdf = async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const { readFileBase64 } = await import('../lib/readFileBase64');
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
      const base64 = await readFileBase64(asset.uri);
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

  const [poolSearchActive, setPoolSearchActive] = useState(false); // arama sonuçları listeleniyor
  const [pipeStepFilter, setPipeStepFilter] = useState(null); // 1–6 | null
  const [pipelineEmployerFilter, setPipelineEmployerFilter] = useState(null);
  const [hotelsInitialTab, setHotelsInitialTab] = useState(null);
  const [view, setView] = useState(() => {
    const savedView = normalizeAgencyView(savedUi.view);
    return savedView === 'hotels' ? 'ops' : savedView;
  }); // ops | pool | pipeline
  useEffect(() => {
    if (agencyReturn?.view === 'hotels') setView('hotels');
  }, [agencyReturn]);
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(show, () => setKbOpen(true));
    const s2 = Keyboard.addListener(hide, () => setKbOpen(false));
    return () => { s1.remove(); s2.remove(); };
  }, []);

  const [pipelineStage, setPipelineStage] = useState(() => normalizePipelineStage(savedUi.pipelineStage, savedUi));
  const [ivList, setIvList] = useState([]);
  const [inProcessList, setInProcessList] = useState([]);
  const [offeredList, setOfferedList] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [ivSortDesc, setIvSortDesc] = useState(true);   // yeni -> eski
  // Havuz sıralaması: son görünürlük (yeniden eskiye) | eskiden yeniye | CV tarihi
  const [poolSort, setPoolSort] = useState(() => savedUi.poolSort || 'online'); // online | online_old
  const [formerList, setFormerList] = useState([]);
  const [transitList, setTransitList] = useState([]);
  const [arrivalFlights, setArrivalFlights] = useState([]);
  const [arrivalVisibleCount, setArrivalVisibleCount] = useState(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState({ s: null, e: null }); // seçili tarih aralığı (Date)
  const [draftFrom, setDraftFrom] = useState({ d: '', m: '', y: '' });
  const [draftTo, setDraftTo] = useState({ d: '', m: '', y: '' });
  const [nowTick, setNowTick] = useState(Date.now());
  const [chatBadge, setChatBadge] = useState(0);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const [remindWarn, setRemindWarn] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [footerTab, setFooterTab] = useState(null); // 'matches' | 'announcements' | null
  const [chatPeer, setChatPeer] = useState(null); // { id, label } — inbox’tan açılan sohbet
  const remindBlink = React.useRef(new Animated.Value(1)).current;

  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const [ratingMap, setRatingMap] = useState({}); // user_id -> { avg, count }
  const [favOn, setFavOn] = useState(() => !!(savedUi.favOn && savedUi.favEmployerId && savedUi.favDepartment));
  const [favEmployerId, setFavEmployerId] = useState(() => savedUi.favEmployerId || null);
  const [favEmployerName, setFavEmployerName] = useState(() => savedUi.favEmployerName || '');
  const [favDepartment, setFavDepartment] = useState(() => savedUi.favDepartment || null);
  const [favDepartmentLabel, setFavDepartmentLabel] = useState(() => savedUi.favDepartmentLabel || '');
  const [favPickOpen, setFavPickOpen] = useState(false);
  const [favSheetPurpose, setFavSheetPurpose] = useState('filter'); // filter | add
  const [pendingFavIds, setPendingFavIds] = useState([]);
  const [favSlotSet, setFavSlotSet] = useState(() => new Set());

  const refreshFavSlots = useCallback(async () => {
    if (!userId) { setFavSlotSet(new Set()); return; }
    const ids = await listAllFavoritedCandidateIds(userId);
    setFavSlotSet(new Set(ids));
  }, [userId]);

  useEffect(() => { refreshFavSlots(); }, [refreshFavSlots]);

  // Aday detayına gidip gelince unmount olmasın diye UI durumunu sakla.
  useEffect(() => {
    writeAgencyHomeUi({
      view, pipelineStage, poolSort, advFilters, favOn,
      favEmployerId, favEmployerName, favDepartment, favDepartmentLabel,
    });
  }, [view, pipelineStage, poolSort, advFilters, favOn, favEmployerId, favEmployerName, favDepartment, favDepartmentLabel]);

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
    if (!(view === 'pipeline' && pipelineStage === 'interviews') && footerTab !== 'matches') return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, pipelineStage, footerTab]);

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
    const st = await listStatuses(userId);
    setStatuses(st);
    const ids = Object.keys(st).filter((id) => st[id]?.status === 'offered' && st[id]?.accepted_by === userId);
    if (!ids.length) { setOfferedList([]); return; }
    const rows = await Promise.all(ids.map((id) => getCandidateById(id)));
    const list = rows.filter(Boolean).map((r) => ({ ...r, st: st[r.user_id] }));
    setOfferedList(await attachEmployers(userId, list));
  }, [userId]);

  // Eşleşmeler sekmesi: teklif + mülakat listelerini yükle.
  useEffect(() => {
    if (footerTab !== 'matches' || !userId) return undefined;
    let alive = true;
    (async () => {
      setListLoading(true);
      await Promise.all([reloadOffered(), reloadProcess()]);
      if (alive) setListLoading(false);
    })();
    return () => { alive = false; };
  }, [footerTab, userId, reloadOffered, reloadProcess]);

  // Eşleşmeler rozeti: mülakat önerisi + yaklaşan görüşmeler.
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    (async () => {
      await Promise.all([reloadProcess(), reloadOffered()]);
      if (!alive) return;
    })();
    return () => { alive = false; };
  }, [userId, reloadProcess, reloadOffered]);

  useEffect(() => {
    if (view === 'pool' || view === 'ops' || view === 'hotels') return undefined;
    let alive = true;
    (async () => {
      setListLoading(true);
      const needProcess = view === 'pipeline' && isProcessPipelineStage(pipelineStage);
      const needStaff = view === 'pipeline';
      if (needStaff) setArrivalFlights([]);
      if (needProcess) {
        await reloadProcess();
        if (pipelineStage === 'offered') await reloadOffered();
      }
      if (needStaff) {
        const [rows, former, transit, flights] = await Promise.all([
          listStaff(userId),
          listFormerStaff(userId),
          listInTransit(userId),
          listFlights(),
        ]);
        if (alive) {
          const [staffAttached, transitAttached] = await Promise.all([
            attachEmployers(userId, rows),
            attachEmployers(userId, transit),
          ]);
          setStaffList(staffAttached);
          const activeIds = new Set([
            ...(rows || []).map((r) => r.user_id),
            ...(transit || []).map((r) => r.user_id),
          ].filter(Boolean));
          setFormerList(withFormerEmployerFields(former)
            .filter((r) => !activeIds.has(r.candidate_id || r.user_id))
            .map((r) => ({
              ...r,
              user_id: r.user_id || r.candidate_id,
              data: r.data || {},
              former: true,
            })));
          setTransitList(transitAttached);
          setArrivalFlights(flights || []);
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
          if (row?.type === 'chat_message' || row?.type === 'announcement' || row?.type === 'agency_notice') tick();
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

  useEffect(() => { poolSearchActiveRef.current = poolSearchActive; }, [poolSearchActive]);
  useEffect(() => { codeInputRef.current = codeInput; }, [codeInput]);
  useEffect(() => {
    if (!poolSearchActive) poolSnapshotRef.current = items;
  }, [items, poolSearchActive]);

  useEffect(() => {
    // Havuz sekmesi açık değilken ağır listeyi çekme — giriş/açılış OOM çökmesi.
    if (view !== 'pool') return undefined;
    let alive = true;
    (async () => {
      if (!poolSearchActiveRef.current) setLoading(true);
      try {
        let rows;
        if (favOn && favEmployerId && favDepartment) {
          rows = await listFavoriteCandidates(userId, favEmployerId, favDepartment);
          const ids = (rows || []).map((r) => r.user_id);
          const st = await listStatuses(userId, { forUserIds: ids });
          if (!alive) return;
          poolSnapshotRef.current = rows;
          if (poolSearchActiveRef.current) {
            const q = String(codeInputRef.current || '').trim();
            setItems(q ? rows.filter((r) => matchesCandidateQuery(r, q)) : rows);
            setStatuses(st); setHasMore(false); setLoading(false);
            return;
          }
          setItems(rows); setStatuses(st); setPage(0); setHasMore(false); setLoading(false);
          return;
        }
        const poolRows = await listCandidates({ filters: advFilters, from: 0, to: PAGE - 1, sort: poolSort });
        const ids = (poolRows || []).map((r) => r.user_id);
        const st = await listStatuses(userId, { forUserIds: ids });
        if (!alive) return;
        poolSnapshotRef.current = poolRows;
        if (poolSearchActiveRef.current) {
          const q = String(codeInputRef.current || '').trim();
          setItems(q ? poolRows.filter((r) => matchesCandidateQuery(r, q)) : poolRows);
          setStatuses(st); setLoading(false);
          return;
        }
        setItems(poolRows); setStatuses(st); setPage(0); setHasMore(poolRows.length === PAGE); setLoading(false);
      } catch (e) {
        console.warn('[pool]', e?.message || e);
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filterKey, poolSort, favOn, favEmployerId, favDepartment, userId]);

  // Havuz + süreç listelerindeki adayların açık puan özeti
  useEffect(() => {
    if (poolSearchActive) return undefined; // canlı aramada ekstra istek/jank yok
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
  }, [items, ivList, inProcessList, staffList, poolSearchActive]);

  const loadMore = useCallback(async () => {
    if (favOn || poolSearchActive || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const next = page + 1;
    const rows = await listCandidates({ filters: advFilters, from: next * PAGE, to: next * PAGE + PAGE - 1, sort: poolSort });
    setItems((prev) => {
      const nextItems = [...prev, ...rows];
      if (!poolSearchActiveRef.current) poolSnapshotRef.current = nextItems;
      return nextItems;
    }); setPage(next); setHasMore(rows.length === PAGE); setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, loading, page, filterKey, poolSort, favOn, poolSearchActive]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (favOn && favEmployerId && favDepartment) {
      const rows = await listFavoriteCandidates(userId, favEmployerId, favDepartment);
      const ids = (rows || []).map((r) => r.user_id);
      const st = await listStatuses(userId, { forUserIds: ids });
      setItems(rows); setStatuses(st); setPage(0); setHasMore(false);
      poolSnapshotRef.current = rows;
      setRefreshing(false);
      return;
    }
    const rows = await listCandidates({ filters: advFilters, from: 0, to: PAGE - 1, sort: poolSort });
    const ids = (rows || []).map((r) => r.user_id);
    const st = await listStatuses(userId, { forUserIds: ids });
    setItems(rows); setStatuses(st); setPage(0); setHasMore(rows.length === PAGE);
    poolSnapshotRef.current = rows;
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
    'work_start_confirm', 'work_start_remind', 'transit_stalled',
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

  // Kod veya isimle aday bul: seçim modunda seçime ekle; aksi halde havuzda listele (asla direkt profil açma).
  // live=true: yazarken debounce — yerel sonuçlarla birleştir; klavyeyi kapatma.
  const mergeSearchRows = (a, b) => {
    const seen = new Set();
    const out = [];
    [...(a || []), ...(b || [])].forEach((r) => {
      if (!r?.user_id || seen.has(r.user_id)) return;
      seen.add(r.user_id);
      out.push(r);
    });
    return out;
  };

  const handleCode = async (rawOverride, { live = false, localRows = [] } = {}) => {
    const raw = String(rawOverride != null ? rawOverride : codeInput || '').trim();
    if (!raw) { setCodeError(true); return; }
    const seq = ++searchSeqRef.current;
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
      if (seq !== searchSeqRef.current) return; // eski istek — yoksay
      const merged = mergeSearchRows(localRows, rows);
      if (!merged.length) {
        if (!selectMode) {
          if (view !== 'pool') setView('pool');
          setItems([]);
          setPage(0);
          setHasMore(false);
          setPoolSearchActive(true);
          if (!live || foldSearch(raw).length >= 2) setCodeError(true);
        } else {
          setCodeError(true);
        }
        return;
      }
      if (!live) Keyboard.dismiss();
      if (selectMode) {
        setSelectedIds((prev) => {
          const next = [...prev];
          merged.forEach((row) => { if (!next.includes(row.user_id)) next.push(row.user_id); });
          return next;
        });
        setCodeChips((prev) => {
          const next = [...prev];
          merged.forEach((row) => {
            if (next.find((c) => c.user_id === row.user_id)) return;
            const code = candidateCode(row.nationality || row.data?.nationality, row.reg_no);
            next.push({ user_id: row.user_id, code, photo: row.data?.photo || row.data?.photoClose || row.data?.photoFull });
          });
          return next;
        });
      } else {
        if (view !== 'pool') setView('pool');
        setItems(merged);
        setPage(0);
        setHasMore(false);
        setPoolSearchActive(true);
        setCodeError(false);
      }
    } catch (e) {
      if (seq !== searchSeqRef.current) return;
      console.warn('[pool-search]', e?.message || e);
      if (!(live && localRows.length)) setCodeError(true);
    } finally {
      if (seq === searchSeqRef.current) setCodeBusy(false);
    }
  };

  const clearPoolSearch = () => {
    searchSeqRef.current += 1;
    setCodeInput('');
    codeInputRef.current = '';
    setCodeError(false);
    setCodeBusy(false);
    setPoolSearchActive(false);
    const snap = poolSnapshotRef.current || [];
    setItems(snap);
    setPage(Math.max(0, Math.ceil(snap.length / PAGE) - 1));
    setHasMore(snap.length >= PAGE && snap.length % PAGE === 0);
    Keyboard.dismiss();
  };

  // Yazarken anında yerel filtre + kısa debounce ile sunucu (Kiril/sayfa dışı adaylar).
  useEffect(() => {
    if (view !== 'pool' || selectMode) return undefined;
    const raw = String(codeInput || '').trim();
    if (!raw) {
      if (poolSearchActive) {
        setPoolSearchActive(false);
        const snap = poolSnapshotRef.current || [];
        setItems(snap);
        setPage(Math.max(0, Math.ceil(snap.length / PAGE) - 1));
        setHasMore(snap.length >= PAGE && snap.length % PAGE === 0);
      }
      setCodeError(false);
      return undefined;
    }
    const isCode = !!parseCode(raw);
    const local = (poolSnapshotRef.current || []).filter((r) => matchesCandidateQuery(r, raw));
    setPoolSearchActive(true);
    setItems(local);
    setHasMore(false);
    setPage(0);
    setCodeError(false);
    poolListRef.current?.scrollToOffset?.({ offset: 0, animated: false });

    if (!isCode && foldSearch(raw).length < 1) return undefined;
    // Tek karakter: önce yerel; sunucu 1+ (RPC) / kod her zaman
    const delay = isCode ? 120 : (foldSearch(raw).length < 2 ? 280 : 160);
    const tmr = setTimeout(() => { handleCode(raw, { live: true, localRows: local }); }, delay);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeInput, view, selectMode]);

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

  // Toplu favori: işletme + departman seç → seçili adayları ekle.
  const openBulkFav = () => {
    if (!selectedIds.length) return;
    setPendingFavIds(selectedIds.slice());
    setFavSheetPurpose('add');
    setFavPickOpen(true);
  };

  // Havuzda müsait adaylara rozet yok — sadece teklifli / süreçte belirgin olsun.
  const PILL = {
    offered: { box: styles.pillOffered, dot: styles.dotOffered, txt: styles.pillTextOffered, label: t('agency_filter_offered') },
    active: { box: styles.pillActive, dot: styles.dotActive, txt: styles.pillTextActive, label: t('agency_filter_active') },
  };

  const clearFavFilter = () => {
    setFavOn(false);
    setFavEmployerId(null);
    setFavEmployerName('');
    setFavDepartment(null);
    setFavDepartmentLabel('');
  };

  const openPoolFilter = (section = null) => {
    setFilterFocus(section);
    setSheetVisible(true);
  };

  const patchAdv = (patch) => {
    setAdvFilters((prev) => {
      const next = { ...(prev || {}), ...patch };
      Object.keys(next).forEach((k) => {
        if (next[k] == null || next[k] === '' || (Array.isArray(next[k]) && !next[k].length)) delete next[k];
      });
      return next;
    });
  };

  const rmAdvList = (key, val) => {
    setAdvFilters((prev) => {
      const next = { ...(prev || {}) };
      next[key] = (next[key] || []).filter((x) => x !== val);
      if (!next[key].length) delete next[key];
      return next;
    });
  };

  const clearAllPoolFilters = () => {
    setAdvFilters({});
    clearFavFilter();
    if (poolSearchActive || codeInput) clearPoolSearch();
  };

  const poolFilterChips = (() => {
    const f = advFilters || {};
    const opts = langOptions(lang);
    const posLbl = (v) => {
      for (const sec of (opts.POSITION_SECTORS || [])) {
        const hit = (opts.POSITIONS_BY_SECTOR?.[sec.value] || []).find((o) => o.value === v);
        if (hit) return hit.label;
      }
      return v;
    };
    const pickLbl = (list, v) => (list || []).find((o) => o.value === v)?.label || v;
    const out = [];
    if (poolSearchActive && codeInput.trim()) {
      out.push({ id: 'search', label: `🔍 ${codeInput.trim()}`, rm: clearPoolSearch });
    }
    if (f.codeNation || f.regNo) {
      out.push({ id: 'code', label: candidateCode(f.codeNation, f.regNo), rm: () => patchAdv({ codeNation: undefined, regNo: undefined }) });
    }
    if (f.ageMin || f.ageMax) {
      out.push({
        id: 'age',
        label: t('agency_age_chip', { min: String(f.ageMin || '…'), max: String(f.ageMax || '…') }),
        rm: () => patchAdv({ ageMin: undefined, ageMax: undefined }),
      });
    }
    if (f.gender) out.push({ id: 'gender', label: t(`gender_${f.gender}`), rm: () => patchAdv({ gender: undefined }) });
    if (f.employmentStatus) out.push({ id: 'emp', label: t(`es_${f.employmentStatus}`), rm: () => patchAdv({ employmentStatus: undefined }) });
    if (f.turquzCertified) out.push({ id: 'cert', label: t('f_turquz_certified'), rm: () => patchAdv({ turquzCertified: undefined }) });
    (f.availableMonths || []).forEach((v) => out.push({ id: `m-${v}`, label: pickLbl(opts.WORK_AVAILABILITY, v), rm: () => rmAdvList('availableMonths', v) }));
    (f.positions || []).forEach((v) => out.push({ id: `p-${v}`, label: posLbl(v), rm: () => rmAdvList('positions', v) }));
    (f.languages || []).forEach((v) => out.push({ id: `l-${v}`, label: pickLbl(opts.LANGUAGES, v), rm: () => rmAdvList('languages', v) }));
    (f.skills || []).forEach((v) => out.push({ id: `s-${v}`, label: pickLbl(opts.SKILLS, v), rm: () => rmAdvList('skills', v) }));
    (f.nationalities || []).forEach((v) => out.push({ id: `n-${v}`, label: pickLbl(opts.NATIONALITIES, v) || v, rm: () => rmAdvList('nationalities', v) }));
    if (favOn && favEmployerName) {
      out.push({
        id: 'fav',
        label: favDepartmentLabel ? `${favEmployerName} · ${favDepartmentLabel}` : favEmployerName,
        rm: clearFavFilter,
      });
    }
    return out;
  })();

  const onFavFilterPick = ({ employer, department }) => {
    if (!employer?.id || !department) return;
    if (favSheetPurpose === 'add' && pendingFavIds.length) {
      const ids = pendingFavIds.slice();
      (async () => {
        setBulkBusy(true);
        try {
          for (const id of ids) {
            // eslint-disable-next-line no-await-in-loop
            await addFavorite(userId, employer.id, department, id);
          }
          setFavPickOpen(false);
          setPendingFavIds([]);
          if (selectMode) exitSelect();
          tapHaptic();
          await refreshFavSlots();
          Alert.alert(t('fav_title_add'), t('fav_bulk_done', { n: String(ids.length) }));
        } catch (e) {
          Alert.alert(t('fav_title_add'), e?.message || 'error');
        } finally {
          setBulkBusy(false);
        }
      })();
      return;
    }
    const opts = langOptions(lang);
    const deptLabel = (opts.POSITIONS_BY_SECTOR?.tourism || [])
      .find((o) => o.value === department)?.label || department;
    setFavEmployerId(employer.id);
    setFavEmployerName(employer.name || employer.title || '');
    setFavDepartment(department);
    setFavDepartmentLabel(deptLabel);
    setFavOn(true);
    setFavPickOpen(false);
    setPoolSearchActive(false);
    setCodeInput('');
  };

  const removeFromFavList = async (candidateId) => {
    if (!userId || !candidateId) return;
    setFavSlotSet((prev) => {
      const next = new Set(prev);
      next.delete(candidateId);
      return next;
    });
    try {
      // Tek aday için kayıtlı favori slotunu (otel + departman) tamamen kaldır.
      await removeFavorite(userId, candidateId);
      if (favOn) setItems((prev) => prev.filter((r) => r.user_id !== candidateId));
      await refreshFavSlots();
      tapHaptic();
    } catch (e) {
      await refreshFavSlots();
      Alert.alert(t('fav_remove'), e?.message || 'error');
    }
  };

  const openAddFavOne = (candidateId) => {
    if (!candidateId) return;
    setPendingFavIds([candidateId]);
    setFavSheetPurpose('add');
    setFavPickOpen(true);
  };

  const fmtPoolDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  };

  const renderItem = ({ item: c }) => {
    const cat = category(c.user_id);
    const pill = PILL[cat] || null;
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality];
    const sel = isSelected(c.user_id);
    const name = maskedName(c.data) || code;
    const showUnfav = favOn && !selectMode;
    const isFavCand = favSlotSet.has(c.user_id);
    const applied = fmtPoolDate(c.updated_at);
    return (
      <TouchableOpacity
        style={[styles.poolRow, sel && styles.poolRowSel]}
        onPress={() => onCardPress(c)}
        onLongPress={() => onCardLongPress(c)}
        delayLongPress={300}
        activeOpacity={0.88}
      >
        <View style={styles.poolAvatarWrap}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.poolAvatar} resizeMode="cover" />
          ) : (
            <View style={[styles.poolAvatar, styles.poolAvatarPh]}>
              <Text style={styles.poolAvatarIcon}>👤</Text>
            </View>
          )}
          {flag ? <Image source={flag} style={styles.poolCornerFlag} resizeMode="cover" /> : null}
        </View>

        <View style={styles.poolRowMain}>
          <View style={styles.poolCodeRow}>
            <Text style={styles.poolRowCode} numberOfLines={1}>{code}</Text>
          </View>
          <Text style={styles.poolRowName} numberOfLines={1}>{name}</Text>
          {c.title ? <Text style={styles.poolRowTitle} numberOfLines={1}>{c.title}</Text> : null}
          {applied ? (
            <Text style={styles.poolRowDate} numberOfLines={1}>
              {t('pool_applied_on', { d: applied })}
            </Text>
          ) : null}
          {pill ? (
            <View style={[styles.poolRowPill, pill.box]}>
              <View style={[styles.dot, pill.dot]} />
              <Text style={[styles.pillText, pill.txt]} numberOfLines={1}>{pill.label}</Text>
            </View>
          ) : null}
          {ratingMap[c.user_id] ? (
            <View style={{ marginTop: 6 }}>
              <RatingBadge avg={ratingMap[c.user_id].avg} count={ratingMap[c.user_id].count} compact onDark />
            </View>
          ) : null}
          <Text style={styles.poolRowSeen} numberOfLines={1}>{formatLastSeen(c.last_seen_at, t)}</Text>
        </View>

        <View style={styles.poolRowAside}>
          {selectMode ? (
            <View style={[styles.poolCheck, sel && styles.poolCheckOn]}>
              {sel ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          ) : showUnfav ? (
            <TouchableOpacity
              onPress={(e) => { e?.stopPropagation?.(); removeFromFavList(c.user_id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('fav_remove')}
              style={styles.poolStarBtn}
            >
              <Text style={styles.poolStarOn}>★</Text>
            </TouchableOpacity>
          ) : isFavCand ? (
            <TouchableOpacity
              onPress={(e) => { e?.stopPropagation?.(); removeFromFavList(c.user_id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('fav_btn')}
              style={styles.poolStarBtn}
            >
              <Text style={styles.poolStarOn}>★</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => openAddFavOne(c.user_id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('fav_title_add')}
              style={styles.poolStarBtn}
            >
              <Text style={styles.poolStarOff}>☆</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.poolRowChev}>›</Text>
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
      || pipelineStage === 'staff'
    );

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds([]);
    setCodeChips([]);
    setPoolSearchOpen(false);
    setPoolSearch('');
    setArrivalVisibleCount(null);
  }, [view, pipelineStage]);

  // Premium kart — moda göre rozet/aksiyon değişir.
  const renderRich = ({ item: c }) => {
    const isPipeline = view === 'pipeline';
    const isFavorite = favSlotSet.has(c.user_id);
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const flag = NATION_FLAG[c.data?.nationality || c.nationality];
    const position = candPosition(c);
    const sel = isSelected(c.user_id);
    const seenTier = lastSeenTier(c.last_seen_at);
    const seenOnline = seenTier === 'fresh' || seenTier === 'recent';
    let badgeLabel = ''; let badgeStyle = styles.pipeBMuted; let dotColor = PIPE_TEXT_SEC;
    let dateDay = ''; let dateTime = ''; let strip = 'none'; // none | gold | red

    if (mode === 'interviews') {
      if (isConcluded(c)) {
        badgeLabel = t('pipe_arch_concluded'); badgeStyle = styles.pipeBMuted; dotColor = PIPE_TEXT_SEC;
        if (c.ivSlot) { dateDay = `${weekdayOf(c.ivSlot, lang)}, ${slotDateKey(c.ivSlot)}`; dateTime = slotTime(c.ivSlot); strip = 'gold'; }
      } else if (c.ivStatus === 'scheduled') {
        badgeLabel = t('iv_will_attend'); badgeStyle = styles.pipeBGreen; dotColor = '#5dd39e';
        dateDay = `${weekdayOf(c.ivSlot, lang)}, ${slotDateKey(c.ivSlot)}`; dateTime = slotTime(c.ivSlot); strip = 'gold';
      } else {
        badgeLabel = t('iv_waiting_label'); badgeStyle = styles.pipeBAmber; dotColor = PIPE_GOLD_BTN;
      }
    } else if (mode === 'offered') {
      badgeLabel = t('agency_filter_offered') || 'Teklifli'; badgeStyle = styles.pipeBAmber; dotColor = PIPE_GOLD_BTN;
    } else if (mode === 'inprocess') {
      const turn = c.turn === 'agency'
        ? (t('turn_agency') || 'Sıra sizde')
        : (t('turn_candidate') || 'Aday bekleniyor');
      const step = c.titleKey ? (t(c.titleKey) || `Adım ${c.pipeStep}`) : (c.pipeStep ? `Adım ${c.pipeStep}` : '');
      badgeLabel = step ? `${step} · ${turn}` : (t('in_process_label') || 'Süreçte');
      badgeStyle = c.turn === 'agency' ? styles.pipeBAmber : styles.pipeBGreen;
      dotColor = c.turn === 'agency' ? PIPE_GOLD_BTN : '#5dd39e';
    } else { // staff
      const end = c.work_end_at ? new Date(c.work_end_at) : null;
      const expired = end ? Date.now() >= end.getTime() : false;
      badgeLabel = expired ? t('staff_expired') : t('staff_active');
      badgeStyle = expired ? styles.pipeBRed : styles.pipeBGreen;
      dotColor = expired ? '#f08080' : '#5dd39e';
      if (end) { dateDay = `${weekdayOf(end.toISOString(), lang)}, ${fmtRange(end)}`; strip = expired ? 'red' : 'gold'; }
    }

    const agencyTurn = mode === 'inprocess' && c.turn === 'agency';

    return (
      <TouchableOpacity
        style={[styles.rich, isPipeline && pipeLightStyles.rich, agencyTurn && styles.richAgencyTurn, sel && styles.richSel]}
        onPress={() => {
          if (canNoticeSelect && selectMode) { tapHaptic(); toggleSelect(c.user_id); return; }
          onOpenCandidate(c, mode === 'staff'
            ? { ...(statuses[c.user_id] || {}), status: c.former ? 'new' : 'hired', docs_unlocked: !c.former }
            : statuses[c.user_id]);
        }}
        onLongPress={canNoticeSelect ? () => {
          pressHaptic();
          if (selectMode) exitSelect();
          else { setSelectMode(true); toggleSelect(c.user_id); }
        } : undefined}
        delayLongPress={300}
        activeOpacity={0.88}
      >
        <View style={styles.richTop}>
          <View style={[styles.richPhotoBox, isPipeline && pipeLightStyles.richPhotoBox]}>
            {photo ? <Image source={{ uri: photo }} style={styles.richPhoto} resizeMode="cover" /> : <View style={[styles.richPhoto, styles.photoPh, isPipeline && pipeLightStyles.photoPh]}><Text style={styles.photoIcon}>👤</Text></View>}
            <PhotoWatermark size={16} margin={4} />
          </View>
          <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
            <Text style={[styles.richName, isPipeline && pipeLightStyles.richName]} numberOfLines={1}>{maskedName(c.data) || code}</Text>
            <View style={styles.richMetaRow}>
              {flag ? <Image source={flag} style={styles.richInlineFlag} resizeMode="cover" /> : null}
              <Text style={[styles.richCode, isPipeline && pipeLightStyles.richCode]} numberOfLines={1}>
                {code}
                {position ? ` · ${position}` : ''}
              </Text>
            </View>
            {isPipeline && c.employerLabel ? (
              <Text style={pipeLightStyles.richEmployer} numberOfLines={1}>{c.employerLabel}</Text>
            ) : null}
            <View style={[styles.badge, badgeStyle, isPipeline && pipeLightStyles.badge]}>
              <View style={[styles.badgeDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.badgeText, { color: dotColor }, isPipeline && pipeLightStyles.badgeText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{badgeLabel}</Text>
            </View>
            {isPipeline && mode === 'inprocess' ? (
              <View style={pipeLightStyles.progressTrack}>
                <View style={[pipeLightStyles.progressFill, { width: `${Math.min(100, Math.max(12, ((c.pipeStep || 1) / 6) * 100))}%` }]} />
              </View>
            ) : null}
          </View>
          {canNoticeSelect && selectMode ? (
            <View style={[styles.checkbox, isPipeline && pipeLightStyles.checkbox, styles.richCheck, sel && styles.checkboxOn, sel && isPipeline && pipeLightStyles.checkboxOn]}>
              {sel ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          ) : (
            <View style={pipeLightStyles.cardAside}>
              {isPipeline ? (
                <TouchableOpacity
                  onPress={() => openAddFavOne(c.user_id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={isFavorite ? t('fav_btn') : t('fav_title_add')}
                >
                  <Text style={[pipeLightStyles.pipelineStar, isFavorite && pipeLightStyles.pipelineStarOn]}>
                    {isFavorite ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Text style={[styles.richChev, isPipeline && pipeLightStyles.richChev]}>›</Text>
            </View>
          )}
        </View>

        {strip !== 'none' && dateDay ? (
          <View style={[styles.dateStrip, isPipeline && pipeLightStyles.dateStrip, strip === 'red' && styles.dateStripRed]}>
            <CalIcon color={strip === 'red' ? '#f08080' : PIPE_GOLD_BTN} />
            <Text style={[styles.dateStripText, isPipeline && pipeLightStyles.dateStripText, strip === 'red' && { color: '#f08080' }]} numberOfLines={1}>
              {mode === 'staff'
                ? t(c.former ? 'staff_departed_on' : 'staff_until', { date: dateDay })
                : dateDay}
            </Text>
            {dateTime ? (
              <>
                <View style={styles.dateSep} />
                <Text style={[styles.dateStripTime, isPipeline && pipeLightStyles.dateStripTime]}>🕒 {dateTime}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        {strip === 'none' && seenOnline && mode !== 'staff' ? (
          <View style={styles.richOnlineRow}>
            <View style={styles.richOnlineDot} />
            <Text style={[styles.richOnlineTxt, isPipeline && pipeLightStyles.richOnlineTxt]} numberOfLines={1}>{formatLastSeen(c.last_seen_at, t)}</Text>
          </View>
        ) : null}

        {/* Planlanmış mülakat: geri sayım + katıl */}
        {mode === 'interviews' && !isConcluded(c) && c.ivStatus === 'scheduled' && c.ivSlot ? (() => {
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

        {/* Tamamlanan mülakat: Teklif / Reddet */}
        {mode === 'interviews' && isConcluded(c) ? (
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
  const confirmOfferTo = async (c) => {
    const ok = await hasFavoriteSlot(userId, c.user_id);
    if (!ok) {
      Alert.alert(t('offer_fav_required_title'), t('offer_fav_required_body'), [
        { text: t('agency_cancel'), style: 'cancel' },
        { text: t('fav_title_add'), onPress: () => openAddFavOne(c.user_id) },
      ]);
      return;
    }
    Alert.alert(t('offer_btn'), maskedName(c.data) || candidateCode(c.data?.nationality, c.reg_no), [
      { text: t('agency_cancel'), style: 'cancel' },
      { text: t('offer_btn'), onPress: async () => {
          try {
            await offerCandidate(c.user_id);
            notifyOffer(c.user_id, 'offer');
            await cancelInterview(c.user_id);
            if (footerTab === 'matches') await reloadOffered();
            await reloadProcess();
          } catch (e) {
            const msg = (e?.message || '').includes('favorite_required')
              ? t('offer_fav_required_body')
              : (e?.message || 'error');
            Alert.alert(t('offer_btn'), msg);
          }
        } },
    ]);
  };
  const offerFromList = (c) => { confirmOfferTo(c); };
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
  const filterIv = (arr) => arr
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

  // Tarih ARALIĞI filtresi (planlananlar) + sıralama. ivSortDate ISO -> lexik sıralanır.
  const dayOf = (iso) => { const p = fromISO(iso); return p ? new Date(Number(p.y), Number(p.m) - 1, Number(p.d)).getTime() : null; };
  const rangeActive = !!(range.s || range.e);
  const sMs = range.s ? new Date(range.s.getFullYear(), range.s.getMonth(), range.s.getDate()).getTime() : null;
  const eMs = range.e ? new Date(range.e.getFullYear(), range.e.getMonth(), range.e.getDate()).getTime() : null;
  const shownUpcoming = filterIv(upcomingIv);
  const shownConcluded = filterIv(concludedIv);
  if (ivSortDesc) { shownUpcoming.reverse(); shownConcluded.reverse(); }
  const shownIv = [...shownUpcoming, ...shownConcluded];

  const matchesProposed = ivList.filter((c) => c.ivStatus === 'proposed' && !isOffered(c.user_id) && !isAccepted(c.user_id));
  const matchesUpcoming = upcomingIv.filter((c) => c.ivStatus === 'scheduled' && !isOffered(c.user_id) && !isAccepted(c.user_id));
  const matchesConcluded = concludedIv.filter((c) => !isOffered(c.user_id) && !isAccepted(c.user_id));
  const matchesHasAny = matchesProposed.length || offeredList.length || matchesUpcoming.length || matchesConcluded.length;
  const matchesBadge = matchesProposed.length + matchesUpcoming.length;

  const renderMatchOfferCard = (c) => {
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const name = shortCandName(c.data, code);
    const position = candPosition(c);
    const expY = estimateExpYears(c.data);
    const employer = c.employerLabel || '';
    const offeredAt = c.st?.offered_at ? new Date(c.st.offered_at).getTime() : 0;
    const deadline = offeredAt ? offeredAt + OFFER_RESPONSE_MS : 0;
    const left = deadline ? Math.max(0, deadline - nowTick) : 0;
  return (
      <View key={c.user_id} style={matchStyles.card}>
        <View style={matchStyles.cardTop}>
          <View style={matchStyles.candRow}>
            {photo ? (
              <Image source={{ uri: photo }} style={matchStyles.avatar} resizeMode="cover" />
            ) : (
              <View style={[matchStyles.avatar, matchStyles.avatarPh]}><Text style={matchStyles.avatarPhTxt}>👤</Text></View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={matchStyles.candName} numberOfLines={1}>{name}</Text>
              {expY ? (
                <Text style={matchStyles.candMeta} numberOfLines={1}>{t('matches_exp_years', { n: expY })}</Text>
              ) : null}
              {position ? <Text style={matchStyles.candRole} numberOfLines={1}>{position}</Text> : null}
            </View>
          </View>
          {employer ? (
            <View style={matchStyles.hotelCol}>
              <HotelIcon size={24} />
              <Text style={matchStyles.hotelName} numberOfLines={2}>{employer.toUpperCase()}</Text>
              <Text style={matchStyles.hotelStars}>★★★★★</Text>
            </View>
          ) : null}
        </View>
        <View style={matchStyles.cardDivider} />
        <View style={matchStyles.statusRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={matchStyles.statusLbl}>{t('matches_offer_status')}</Text>
            <Text style={matchStyles.statusVal}>{t('matches_offer_pending')}</Text>
            <Text style={matchStyles.statusSub}>{t('matches_offer_evaluating')}</Text>
          </View>
          {deadline ? (
            <OfferCountdownRing msLeft={left} totalMs={OFFER_RESPONSE_MS} label={t('matches_time_left')} />
          ) : null}
        </View>
        <TouchableOpacity
          style={matchStyles.ctaGold}
          onPress={() => onOpenCandidate(c, statuses[c.user_id])}
          activeOpacity={0.9}
        >
          <Text style={matchStyles.ctaGoldText}>{t('matches_view_offer')}</Text>
          <Text style={matchStyles.ctaGoldChev}>›</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMatchIvCard = (c) => {
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const name = shortCandName(c.data, code);
    const position = candPosition(c);
    const win = c.ivSlot ? callWindow(c.ivSlot, { minutes: c.ivMinutes || JOIN_PERIOD_MIN, extraSecs: c.ivExtraSecs || 0 }) : null;
    const joinable = win?.joinable;
    return (
      <View key={c.user_id} style={matchStyles.ivCard}>
        <View style={matchStyles.ivTop}>
          {photo ? (
            <Image source={{ uri: photo }} style={matchStyles.ivAvatar} resizeMode="cover" />
          ) : (
            <View style={[matchStyles.ivAvatar, matchStyles.avatarPh]}><Text style={matchStyles.avatarPhTxt}>👤</Text></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={matchStyles.candName} numberOfLines={1}>{name}</Text>
            {position ? <Text style={matchStyles.candRole} numberOfLines={1}>{position}</Text> : null}
          </View>
        </View>
        {c.ivSlot ? (
          <View style={matchStyles.ivMetaRow}>
            <View style={matchStyles.ivMetaItem}>
              <CalIcon color={MATCH_GOLD} size={14} />
              <Text style={matchStyles.ivMetaText}>{formatMatchDate(c.ivSlot, lang)}</Text>
            </View>
            <View style={matchStyles.ivMetaItem}>
              <ClockIcon color={MATCH_GOLD} size={14} />
              <Text style={matchStyles.ivMetaText}>{slotTime(c.ivSlot)}</Text>
            </View>
          </View>
        ) : null}
        <View style={matchStyles.ivActRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={[matchStyles.ctaOutline, !joinable && { opacity: 0.45 }]}
            onPress={() => joinable && onOpenCandidate(c, { ...(statuses[c.user_id] || {}), _openIvJoin: true })}
            disabled={!joinable}
            activeOpacity={0.9}
          >
            <VideoIcon color={MATCH_GOLD} size={14} />
            <Text style={matchStyles.ctaOutlineText}>{t('matches_join_iv')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMatchProposedCard = (c) => {
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const name = shortCandName(c.data, code);
    const position = candPosition(c);
    const deadline = interviewRespondDeadlineMs({ respond_by: c.ivRespondBy, created_at: c.ivCreatedAt });
    const left = deadline ? Math.max(0, deadline - nowTick) : 0;
    return (
      <View key={c.user_id} style={matchStyles.card}>
        <View style={matchStyles.candRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={matchStyles.avatar} resizeMode="cover" />
          ) : (
            <View style={[matchStyles.avatar, matchStyles.avatarPh]}><Text style={matchStyles.avatarPhTxt}>👤</Text></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={matchStyles.candName} numberOfLines={1}>{name}</Text>
            {position ? <Text style={matchStyles.candRole} numberOfLines={1}>{position}</Text> : null}
          </View>
        </View>
        <View style={matchStyles.cardDivider} />
        <View style={matchStyles.statusRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={matchStyles.statusLbl}>{t('matches_proposed_iv')}</Text>
            <Text style={matchStyles.statusVal}>{t('matches_proposed_status')}</Text>
            <Text style={matchStyles.statusSub}>{t('matches_proposed_sub')}</Text>
          </View>
          {deadline ? (
            <OfferCountdownRing msLeft={left} totalMs={IV_RESPOND_MS} label={t('matches_time_left')} />
          ) : null}
        </View>
        <TouchableOpacity
          style={matchStyles.ctaGold}
          onPress={() => onOpenCandidate(c, statuses[c.user_id])}
          activeOpacity={0.9}
        >
          <Text style={matchStyles.ctaGoldText}>{t('matches_view_candidate')}</Text>
          <Text style={matchStyles.ctaGoldChev}>›</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMatchConcludedCard = (c) => {
    const photo = c.data?.photo || c.data?.photoClose || c.data?.photoFull;
    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
    const name = shortCandName(c.data, code);
    const position = candPosition(c);
    return (
      <View key={c.user_id} style={matchStyles.card}>
        <View style={matchStyles.candRow}>
          {photo ? (
            <Image source={{ uri: photo }} style={matchStyles.avatar} resizeMode="cover" />
          ) : (
            <View style={[matchStyles.avatar, matchStyles.avatarPh]}><Text style={matchStyles.avatarPhTxt}>👤</Text></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={matchStyles.candName} numberOfLines={1}>{name}</Text>
            {position ? <Text style={matchStyles.candRole} numberOfLines={1}>{position}</Text> : null}
            {c.employerLabel ? <Text style={matchStyles.candMeta} numberOfLines={1}>{c.employerLabel}</Text> : null}
          </View>
        </View>
        <View style={matchStyles.cardDivider} />
        <Text style={matchStyles.statusLbl}>{t('matches_concluded_iv')}</Text>
        <Text style={matchStyles.statusSub}>{t('matches_concluded_sub')}</Text>
        <View style={matchStyles.concActRow}>
          <TouchableOpacity style={matchStyles.concReject} onPress={() => rejectFromList(c)} activeOpacity={0.85}>
            <Text style={matchStyles.concRejectText}>{t('reject_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={matchStyles.concOffer} onPress={() => offerFromList(c)} activeOpacity={0.9}>
            <Text style={matchStyles.concOfferText}>{t('offer_btn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const noneEmp = t('employer_group_none') || 'İşletme atanmamış';
  const closePipelineSearch = () => {
    setPipelineSearchOpen(false);
    setPipelineSearch('');
    Keyboard.dismiss();
  };
  const closePoolSearch = () => {
    setPoolSearchOpen(false);
    setPoolSearch('');
    Keyboard.dismiss();
  };
  const poolMatches = (c) => {
    const q = foldSearch(poolSearch);
    if (!q) return true;
    const haystack = foldSearch([
      candidateCode(c.data?.nationality || c.nationality, c.reg_no),
      maskedName(c.data),
      c.title,
    ].filter(Boolean).join(' '));
    return haystack.includes(q);
  };
  const pipelineMatches = (c) => {
    const q = foldSearch(pipelineSearch);
    if (!q) return true;
    const haystack = foldSearch([
      candidateCode(c.data?.nationality || c.nationality, c.reg_no),
      maskedName(c.data),
      candPosition(c),
      c.employerLabel,
    ].filter(Boolean).join(' '));
    return haystack.includes(q);
  };
  const pipelineEmployerMatches = (c) => {
    if (!pipelineEmployerFilter?.id) return true;
    return c.employerId === pipelineEmployerFilter.id
      || c.employerKey === pipelineEmployerFilter.id;
  };
  const pipelineRowMatches = (c) => pipelineMatches(c) && pipelineEmployerMatches(c);
  const richListData = mode === 'staff' ? staffList : mode === 'inprocess'
    ? (pipeStepFilter
      ? inProcessList.filter((c) => (pipeStepFilter === 6 ? (c.pipeStep || 0) >= 6 : c.pipeStep === pipeStepFilter))
      : inProcessList)
    : mode === 'offered' ? offeredList : shownIv;
  const filteredRichListData = richListData.filter(pipelineRowMatches);
  const richSections = mode === 'interviews'
    ? [
      shownUpcoming.filter(pipelineRowMatches).length ? { key: 'iv-up', title: t('pipe_iv_upcoming'), data: shownUpcoming.filter(pipelineRowMatches) } : null,
      shownConcluded.filter(pipelineRowMatches).length ? { key: 'iv-done', title: t('pipe_arch_concluded'), data: shownConcluded.filter(pipelineRowMatches) } : null,
    ].filter(Boolean)
    : groupByEmployer(filteredRichListData, { noneLabel: noneEmp });
  const formerSections = groupByEmployer(formerList.filter(pipelineRowMatches), { noneLabel: noneEmp });
  const noticeListIds = canNoticeSelect
    ? filteredRichListData.map((c) => c.user_id).filter(Boolean)
    : [];
  const selectAllNotice = () => {
    if (!noticeListIds.length) return;
    if (noticeListIds.every((id) => selectedIds.includes(id))) setSelectedIds([]);
    else setSelectedIds(noticeListIds.slice());
  };

  const renderEmpHeader = ({ section }) => (
    <View style={[styles.empSec, view === 'pipeline' && pipeLightStyles.empSec]}>
      <Text style={[styles.empSecChev, view === 'pipeline' && pipeLightStyles.empSecChev]}>▾</Text>
      <Text style={[styles.empSecTitle, view === 'pipeline' && pipeLightStyles.empSecTitle]} numberOfLines={1}>{section.title}</Text>
      <View style={[styles.empSecN, view === 'pipeline' && pipeLightStyles.empSecN]}>
        <Text style={[styles.empSecNTxt, view === 'pipeline' && pipeLightStyles.empSecNTxt]}>{section.data.length}</Text>
      </View>
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

  const poolVisibleItems = poolSearchOpen ? items.filter(poolMatches) : items;
  const poolCountShown = poolVisibleItems.length;
  const poolCountMore = hasMore && !poolSearchActive && !favOn && !poolSearchOpen;
  const poolSearchBase = poolSearchActive ? (poolSnapshotRef.current?.length ?? poolCountShown) : null;
  const poolCountRatio = poolSearchActive && poolSearchBase != null && poolSearchBase !== poolCountShown;

  const arrivalCandidateIds = new Set(
    (arrivalFlights || [])
      .filter((f) => !!parseArriveAt(f.arrive_at))
      .map((f) => f.user_id)
      .filter(Boolean),
  );
  const pipelineArrivals = (() => {
    const byId = {};
    (staffList || []).forEach((c) => {
      if (arrivalCandidateIds.has(c.user_id)) byId[c.user_id] = { ...c, arrivalStatus: 'hired' };
    });
    (transitList || []).forEach((c) => {
      if (arrivalCandidateIds.has(c.user_id)) byId[c.user_id] = { ...c, arrivalStatus: 'transit' };
    });
    return Object.values(byId);
  })();
  const arrivalTodayIds = new Set(
    (arrivalFlights || [])
      .filter((f) => isTodayArrival(f.arrive_at))
      .map((f) => f.user_id)
      .filter(Boolean),
  );
  const arrivalDefaultCount = pipelineArrivals
    .filter((c) => arrivalTodayIds.has(c.user_id))
    .filter(pipelineRowMatches)
    .length;
  const pipelineCategoryItems = [
    { id: 'interviews', labelKey: 'sub_interviews', icon: 'interviews', count: shownIv.filter(pipelineRowMatches).length },
    { id: 'offered', labelKey: 'agency_filter_offered', icon: 'offered', count: offeredList.filter(pipelineRowMatches).length },
    { id: 'inprocess', labelKey: 'sub_inprocess', icon: 'inprocess', count: inProcessList.filter(pipelineRowMatches).length },
    { id: 'arrivals', labelKey: 'staff_tab_arrivals', icon: 'arrivals', count: pipelineStage === 'arrivals' ? (arrivalVisibleCount ?? 0) : arrivalDefaultCount },
    { id: 'staff', labelKey: 'staff_tab_list', icon: 'staff', count: staffList.filter(pipelineRowMatches).length },
    { id: 'former', labelKey: 'staff_tab_former', icon: 'former', count: formerList.filter(pipelineRowMatches).length },
  ];
  const pipelineCountShown = pipelineStage === 'former'
    ? formerList.filter(pipelineRowMatches).length
    : pipelineStage === 'arrivals'
      ? (arrivalVisibleCount ?? 0)
      : filteredRichListData.length;
  return (
    <View style={[styles.wrap, view === 'pool' && styles.wrapPool, view === 'hotels' && styles.wrapHotels, view === 'pipeline' && styles.wrapPipeline]}>
      <View style={[styles.hero, view === 'pool' && styles.heroPool, view === 'pipeline' && styles.heroPipeline, { paddingTop: insets.top + 8 }]}>
        <View style={styles.heroRow}>
          <TouchableOpacity
            style={styles.heroSide}
            onPress={openSettings}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('settings')}
          >
            <MenuIcon color="#e7dcc4" size={22} />
          </TouchableOpacity>

          <View style={styles.heroBrandCenter} pointerEvents="none">
            <View style={styles.heroBrandTexts}>
              <TurquzWordmark
                size={20}
                letterSpacing={3.8}
                fontFamily="Cinzel_600SemiBold"
                fontsReady={fontsReady}
              />
              <Text style={[styles.heroBrandSub, fontsReady && styles.heroBrandSubFont]} numberOfLines={1}>
                {t('agency_panel_kicker')}
              </Text>
            </View>
          </View>

          <View style={[styles.heroSide, styles.heroSideRight]}>
            <NotificationBell userId={userId} color="#e7dcc4" onNavigate={onNotifNavigate} forAgency />
          </View>
        </View>

        {/* Bugün / Adaylar / Havuz / Oteller — sade metin, çerçevesiz */}
        <View style={[styles.heroNav, view === 'pool' && styles.heroNavPool, view === 'pipeline' && styles.heroNavPipeline]}>
          {[
            { id: 'ops', label: t('nav_today') },
            { id: 'pipeline', label: t('nav_candidates') },
            { id: 'pool', label: t('nav_pool') },
            { id: 'hotels', label: t('nav_hotels') },
          ].map((v) => {
            const on = view === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                style={styles.menuItem}
                onPress={() => {
                  setMessagesOpen(false);
                  if (v.id === 'hotels') {
                    setFooterTab(null);
                    setFavPickOpen(false);
                    setView('hotels');
                    setFavSheetPurpose('filter');
                    return;
                  }
                  setFooterTab(null);
                  setView(v.id);
                  if (v.id !== 'pool') {
                    setCodeInput('');
                    setCodeError(false);
                    setPoolSearchActive(false);
                    Keyboard.dismiss();
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.menuText,
                    view === 'pool' && styles.menuTextPool,
                    view === 'pipeline' && styles.menuTextPipeline,
                    on && styles.menuTextOn,
                    on && view === 'pool' && styles.menuTextOnPool,
                    on && view === 'pipeline' && styles.menuTextOnPipeline,
                  ]}
                  numberOfLines={1}
                >
                  {v.label}
                </Text>
                {on ? <View style={[styles.menuUnderline, view === 'pool' && styles.menuUnderlinePool, view === 'pipeline' && styles.menuUnderlinePipeline]} /> : <View style={styles.menuUnderlineSpacer} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {view === 'pool' || view === 'hotels' || view === 'pipeline' || footerTab === 'matches' || footerTab === 'announcements' ? null : <View style={styles.accent} />}

      {/* Ayarlar: kimlik/profil + dil + bildirim + hesap */}
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
                <View style={styles.idCardHead}>
                  <View style={styles.idLogo}>
                    {(profPhotoPreview || agencyPhotoUrl) ? (
                      <Image source={{ uri: profPhotoPreview || agencyPhotoUrl }} style={styles.idPhoto} />
                    ) : (
                      <AgencyProfilePlaceholder size={56} />
                    )}
                    {profOpen ? (
                      <TouchableOpacity style={styles.idPhotoEdit} onPress={pickAgencyPhoto} disabled={photoBusy} activeOpacity={0.8}>
                        {photoBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.idPhotoEditText}>✎</Text>}
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.idName} numberOfLines={2}>
                      {profOpen ? (profCompany || t('agency_company_fallback') || 'Acente') : (agencyProfile?.companyName || t('agency_company_fallback') || 'Acente')}
                    </Text>
                    <Text style={styles.idCode}>{agencyCode(agencyProfile?.regNo)}</Text>
                    <View style={styles.idBadge}>
                      <Text style={styles.idBadgeText}>{t('agency_panel_kicker') || 'Acente hesabı'}</Text>
                    </View>
                  </View>
                  {!profOpen ? (
                    <TouchableOpacity style={styles.idEditBtn} onPress={openProfile} activeOpacity={0.8}>
                      <Text style={styles.idEditIcon}>✎</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {!profOpen ? (
                  <Text style={styles.idHint}>{t('agency_id_hint') || 'Acente kimlik kodunuz'}</Text>
                ) : (
                  <View style={styles.profileEditForm}>
                    <Text style={styles.profileEditHint}>Profil bilgilerinizi ve fotoğrafınızı güncelleyin.</Text>
                    <Text style={styles.profLbl}>{t('agency_company_name') || 'Şirket / işletme adı'} *</Text>
                    <TextInput
                      style={styles.profInput}
                      value={profCompany}
                      onChangeText={setProfCompany}
                      placeholder="Örn. ABC Turizm Ltd."
                      placeholderTextColor="#9aa1ac"
                    />
                    <View style={styles.profileNameRow}>
                      <View style={styles.profileNameField}>
                        <Text style={styles.profLbl}>Ad</Text>
                        <TextInput style={styles.profInput} value={profFirst} onChangeText={setProfFirst} placeholder="Ad" placeholderTextColor="#9aa1ac" />
                      </View>
                      <View style={styles.profileNameField}>
                        <Text style={styles.profLbl}>Soyad</Text>
                        <TextInput style={styles.profInput} value={profLast} onChangeText={setProfLast} placeholder="Soyad" placeholderTextColor="#9aa1ac" />
                      </View>
                    </View>
                    <Text style={styles.profLbl}>Telefon</Text>
                    <TextInput
                      style={styles.profInput}
                      value={profPhone}
                      onChangeText={setProfPhone}
                      placeholder="+90 5xx xxx xx xx"
                      placeholderTextColor="#9aa1ac"
                      keyboardType="phone-pad"
                    />
                    <Text style={styles.profLbl}>{t('agency_tax_section') || 'Vergi levhası'}</Text>
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
                    {profErr ? <Text style={styles.profErr}>{profErr}</Text> : null}
                    <View style={styles.profileEditActions}>
                      <TouchableOpacity style={styles.profCancel} onPress={() => { setProfPhotoPreview(''); setProfOpen(false); }} activeOpacity={0.7}>
                        <Text style={styles.profCancelText}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.profSave, (profBusy || taxBusy) && { opacity: 0.6 }]} onPress={saveProfile} disabled={profBusy || taxBusy} activeOpacity={0.85}>
                        <Text style={styles.profSaveText}>{profBusy ? '…' : 'Kaydet'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.actionRow, { marginTop: 12 }]}
                onPress={() => {
                  setMenuOpen(false);
                  setHotelsInitialTab('info');
                  setView('hotels');
                }}
                activeOpacity={0.85}
              >
                <View style={styles.settingsHotelsIcon}><Text style={styles.settingsHotelsIconText}>⌂</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.settingsHotelsTitle}>{t('hotels_working_title')}</Text>
                  <Text style={styles.settingsHotelsDesc}>{t('agency_hotels_hub_hint')}</Text>
                </View>
                <Text style={styles.menuLogoutHint}>›</Text>
              </TouchableOpacity>

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

              <Text style={[styles.menuSection, { marginTop: 18 }]}>{t('set_account')}</Text>
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

      {!messagesOpen && !footerTab && view === 'pipeline' ? (() => {
        const phaseId = phaseOfPipelineStage(pipelineStage);
        const phaseDef = PIPELINE_PHASES.find((ph) => ph.id === phaseId);
        const phaseStageIds = new Set((phaseDef?.stages || []).map((stage) => stage.id));
        const visiblePipelineCategoryItems = pipelineCategoryItems.filter((cat) => phaseStageIds.has(cat.id));
        return (
          <View style={[styles.pipeChrome, pipeLightStyles.chrome]}>
            <View style={[styles.pipeNav, pipeLightStyles.nav]}>
            <View style={[styles.pipePhaseTrack, pipeLightStyles.phaseTrack]}>
              {PIPELINE_PHASES.map((ph) => {
                const on = phaseId === ph.id;
                return (
                  <TouchableOpacity
                    key={ph.id}
                    style={[styles.pipePhase, pipeLightStyles.phase, on && styles.pipePhaseOn, on && pipeLightStyles.phaseOn]}
                    onPress={() => {
                      if (on) return;
                      setPipelineStage(ph.defaultStage);
                      setArrivalVisibleCount(null);
                      setPipeStepFilter(null);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pipePhaseText, pipeLightStyles.phaseText, on && styles.pipePhaseTextOn, on && pipeLightStyles.phaseTextOn]} numberOfLines={1}>
                      {t(ph.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={pipeLightStyles.categoryRail}
              keyboardShouldPersistTaps="handled"
            >
              {visiblePipelineCategoryItems.map((cat) => {
                const on = pipelineStage === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.pipeCategory, pipeLightStyles.category, on && pipeLightStyles.categoryOn]}
                    onPress={() => { setArrivalVisibleCount(null); setPipelineStage(cat.id); setPipeStepFilter(null); }}
                    activeOpacity={0.85}
                  >
                    <PipelineCategoryIcon kind={cat.icon} color={on ? C.goldText : C.ink2} size={23} />
                    <Text style={[styles.pipeCategoryText, pipeLightStyles.categoryText, on && pipeLightStyles.categoryTextOn]} numberOfLines={1}>
                      {t(cat.labelKey)}
                    </Text>
                    <Text style={[styles.pipeCategoryCount, pipeLightStyles.categoryCount, on && pipeLightStyles.categoryCountOn]}>
                      {cat.count}
                    </Text>
                    {on ? <View style={pipeLightStyles.categoryLine} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={[styles.pipelineToolbar, pipeLightStyles.pipelineToolbar]}>
              {pipelineSearchOpen ? (
                <View style={[pipeLightStyles.searchField, pipeLightStyles.pipelineSearchField]}>
                  <SearchIcon color={C.goldText} size={17} />
                  <TextInput
                    value={pipelineSearch}
                    onChangeText={setPipelineSearch}
                    placeholder={t('pipeline_search_ph') || 'Aday ara veya kod gir'}
                    placeholderTextColor={C.ink2}
                    style={pipeLightStyles.searchInput}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={closePipelineSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={pipeLightStyles.searchClear}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.pipelineCount}>
                    <Text style={[styles.pipelineCountNumber, pipeLightStyles.pipelineCountNumber]}>{pipelineCountShown}</Text>
                    <Text style={[styles.pipelineCountLabel, pipeLightStyles.pipelineCountLabel]}>{t('count_candidates')}</Text>
                  </View>
                  <View style={styles.pipelineToolbarActions}>
                    <TouchableOpacity
                      style={[styles.pipelineFilter, pipeLightStyles.pipelineSearchBtn]}
                      onPress={() => setPipelineSearchOpen(true)}
                      activeOpacity={0.85}
                      accessibilityLabel={t('pipeline_search_ph') || 'Aday ara'}
                    >
                      <SearchIcon color={C.goldText} size={17} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pipelineSort, pipeLightStyles.pipelineSort]}
                      onPress={() => setIvSortDesc((s) => !s)}
                      activeOpacity={0.85}
                    >
                      <Text style={pipeLightStyles.pipelineSortIcon}>{ivSortDesc ? '↓' : '↑'}</Text>
                      <Text style={[styles.pipelineSortText, pipeLightStyles.pipelineSortText]} numberOfLines={1}>
                        {t('pipeline_sort_updated')}
                      </Text>
                    </TouchableOpacity>
                    {pipelineStage === 'interviews' ? (
                      <TouchableOpacity
                        style={[styles.pipelineFilter, pipeLightStyles.pipelineFilter, rangeActive && pipeLightStyles.pipelineFilterOn]}
                        onPress={openRange}
                        activeOpacity={0.85}
                        accessibilityLabel={t('range_title')}
                      >
                        <FunnelIcon color={rangeActive ? C.goldText : C.ink} size={16} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </View>
          </View>
        );
      })() : null}

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

      {messagesOpen && !chatPeer ? (
        <AgencyChatInboxSheet
          embedded
          visible
          agencyId={userId}
          onClose={() => {
            setChatPeer(null);
            setMessagesOpen(false);
            unreadChatCount(userId).then(setChatBadge).catch(() => {});
          }}
          onBadgeChange={(n) => setChatBadge(n || 0)}
          onOpen={(c) => {
            const code = candidateCode(c.nationality || c.data?.nationality, c.reg_no);
            const name = maskedName(c.data);
            const label = [name, code].filter(Boolean).join(' · ') || code;
            setChatPeer({
              id: c.user_id,
              label,
              name: name || code,
              code,
              photo: c.data?.photo || c.data?.photoClose || c.data?.photoFull || null,
            });
          }}
        />
      ) : view === 'hotels' ? (
        <LazyEmployersLite
          agencyId={userId}
          contentPadBottom={insets.bottom + FOOTER_CONTENT_PAD}
          onClose={() => setView('ops')}
          onOpenPipeline={(emp) => {
            setPipelineEmployerFilter({ id: emp.id, name: emp.name || '' });
            setView('pipeline');
            setPipelineStage('staff');
            setPipeStepFilter(null);
          }}
        />
      ) : footerTab === 'announcements' && !hubCompose ? (
        <AnnouncementsListSheet
          embedded
          visible
          userId={userId}
          agencyId={userId}
          reloadAt={hubNonce}
          onClose={() => {
            setFooterTab(null);
            unreadAnnouncementCount(userId).then(setAnnounceUnread).catch(() => {});
          }}
          onRead={() => { unreadAnnouncementCount(userId).then(setAnnounceUnread).catch(() => {}); }}
          onCompose={() => { setHubNotice(null); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
          onComposeGroup={(b) => {
            setHubNotice(null);
            setHubIds((b.people || []).map((p) => p.userId));
            setHubPeople(b.people || []);
            setHubCompose(true);
          }}
          onOpenSent={(row) => { setHubNotice(row); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
          contentPadBottom={insets.bottom + FOOTER_CONTENT_PAD}
        />
      ) : footerTab === 'matches' ? (
        listLoading ? (
          <ActivityIndicator color={MATCH_GOLD} style={{ marginTop: 50 }} />
        ) : (
          <ScrollView
            style={matchStyles.scroll}
            contentContainerStyle={[matchStyles.content, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD }]}
            showsVerticalScrollIndicator={false}
          >
            {matchesProposed.length ? (
              <View style={matchStyles.section}>
                <Text style={matchStyles.sectionTitle}>{t('matches_proposed_iv')}</Text>
                {matchesProposed.map((c) => renderMatchProposedCard(c))}
              </View>
            ) : null}
            {offeredList.length ? (
              <View style={matchStyles.section}>
                <Text style={matchStyles.offerSectionTitle}>{t('matches_offer_pending')}</Text>
                {offeredList.map((c) => {
                  const pos = candPosition(c);
                  const sub = [c.employerLabel, pos].filter(Boolean).join(' • ');
                  return (
                    <View key={c.user_id}>
                      {sub ? <Text style={matchStyles.offerSectionSub} numberOfLines={2}>{sub}</Text> : null}
                      {renderMatchOfferCard(c)}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {matchesUpcoming.length ? (
              <View style={matchStyles.section}>
                <Text style={matchStyles.sectionTitle}>{t('matches_upcoming_iv')}</Text>
                {matchesUpcoming.map((c) => renderMatchIvCard(c))}
              </View>
            ) : null}
            {matchesConcluded.length ? (
              <View style={matchStyles.section}>
                <Text style={matchStyles.sectionTitle}>{t('matches_concluded_iv')}</Text>
                {matchesConcluded.map((c) => renderMatchConcludedCard(c))}
              </View>
            ) : null}
            {!matchesHasAny ? (
              <View style={matchStyles.emptyWrap}>
                <Text style={matchStyles.empty}>{t('matches_empty')}</Text>
                <TouchableOpacity
                  onPress={() => { setFooterTab(null); setView('ops'); pressHaptic(); }}
                  activeOpacity={0.85}
                >
                  <Text style={matchStyles.emptyLink}>{t('matches_empty_ops')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        )
      ) : view === 'ops' ? (
        <AgencyOpsDesk
          agencyId={userId}
          light
          padBottom={kbOpen ? 16 : insets.bottom + FOOTER_CONTENT_PAD}
          onOpen={(c, st) => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), ...(st || {}) })}
          onNavigateCat={(cat, sub) => {
            if (cat === 'messages') {
              setMessagesOpen(true);
              return;
            }
            if (cat === 'hotels') {
              setFavPickOpen(false);
              setView('hotels');
              setFavSheetPurpose('filter');
              return;
            }
            if (cat === 'pool' || cat === 'ops') {
              setView(cat);
              setPipeStepFilter(null);
              return;
            }
            setView('pipeline');
            setArrivalVisibleCount(null);
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
      ) : view !== 'pool' ? (
        listLoading ? (
          <ActivityIndicator color={view === 'pipeline' ? PIPE_GOLD_BTN : '#c2a25a'} style={{ marginTop: 50 }} />
        ) : view === 'pipeline' && pipelineStage === 'former' ? (
          <SectionList
            sections={formerSections}
            keyExtractor={(c) => c.episode_id || c.candidate_id}
            stickySectionHeadersEnabled
            renderSectionHeader={renderEmpHeader}
            contentContainerStyle={[styles.richContent, view === 'pipeline' && pipeLightStyles.richContent, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD }]}
            ListEmptyComponent={<Text style={[styles.pipeEmpty, pipeLightStyles.pipeEmpty]}>{t('staff_former_empty')}</Text>}
            renderItem={({ item }) => renderRich({ item })}
          />
        ) : view === 'pipeline' && pipelineStage === 'arrivals' ? (
          <AgencyArrivals
            light
            candidates={pipelineArrivals.filter(pipelineRowMatches)}
            flightRows={arrivalFlights}
            onCountChange={setArrivalVisibleCount}
            contentPadBottom={insets.bottom + FOOTER_CONTENT_PAD}
            onOpen={(c) => onOpenCandidate(c, { ...(statuses[c.user_id] || {}), status: c.arrivalStatus === 'transit' ? 'in_transit' : 'hired', docs_unlocked: true })}
          />
        ) : (
          <>
            {view === 'pipeline' && pipelineEmployerFilter ? (
              <View style={styles.pipeFilterBar}>
                <Text style={styles.pipeFilterText} numberOfLines={1}>
                  {t('employer_hub_pipeline_filter', { name: pipelineEmployerFilter.name || '—' })}
                </Text>
                <TouchableOpacity onPress={() => setPipelineEmployerFilter(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.pipeFilterClear}>{t('ops_pipe_clear')}</Text>
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
              contentContainerStyle={[styles.richContent, view === 'pipeline' && pipeLightStyles.richContent, { paddingBottom: insets.bottom + FOOTER_CONTENT_PAD + (selectMode ? 64 : 0) }]}
              ListEmptyComponent={(
                <Text style={[styles.pipeEmpty, view === 'pipeline' && pipeLightStyles.pipeEmpty]}>
                  {mode === 'offered'
                    ? (t('offered_empty') || 'Yanıt bekleyen teklif yok.')
                    : t(mode === 'staff' ? 'staff_empty' : mode === 'inprocess' ? 'inprocess_empty' : 'interviews_empty')}
                </Text>
              )}
            />
          </>
        )
      ) : (
      <>
      {/* Havuz — filtre, sıralama ve kompakt aday araması */}
      <View style={styles.poolChrome}>
        {selectMode ? (
          <View style={[styles.poolSearchWrap, styles.poolSearchWrapDark]}>
            <View style={[styles.poolSearchField, styles.poolSearchFieldDark, codeError && styles.poolSearchFieldErrDark]}>
              <SearchIcon color="#8a93a3" size={18} />
              <TextInput
                style={[styles.poolSearchInput, styles.poolSearchInputDark]}
                value={codeInput}
                onChangeText={(v) => { setCodeInput(v); setCodeError(false); }}
                placeholder={t('agency_code_ph')}
                placeholderTextColor="#6b7380"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => handleCode(undefined, {
                  live: false,
                  localRows: (poolSnapshotRef.current || []).filter((r) => matchesCandidateQuery(r, codeInput)),
                })}
                returnKeyType="search"
              />
              {codeBusy ? (
                <ActivityIndicator color={GOLD} style={{ marginRight: 4 }} />
              ) : codeInput ? (
                <TouchableOpacity onPress={clearPoolSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.poolSearchClearDark}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <>
          {poolSearchOpen ? (
            <View style={styles.poolExpandedSearch}>
              <SearchIcon color={C.goldText} size={18} />
              <TextInput
                value={poolSearch}
                onChangeText={setPoolSearch}
                placeholder={t('pipeline_search_ph') || 'Aday ara veya kod gir'}
                placeholderTextColor="#8a93a3"
                style={styles.poolExpandedSearchInput}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={closePoolSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.poolExpandedSearchClear}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            <View style={styles.poolHeadRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.poolHeadTitle, fontsReady && styles.poolHeadTitleFont]}>{t('agency_title')}</Text>
                <Text style={[styles.poolHeadSub, fontsReady && styles.poolHeadSubFont]} numberOfLines={1}>
                  {loading
                    ? '…'
                    : `${t('pool_count_total')} ${poolCountRatio ? `${poolCountShown} / ${poolSearchBase}` : `${poolCountShown}${poolCountMore ? '+' : ''}`} ${t('count_candidates')}`}
                </Text>
              </View>
              <View style={styles.poolHeadActions}>
              <TouchableOpacity
                onPress={() => setPoolSearchOpen(true)}
                activeOpacity={0.88}
                style={styles.poolSearchIconBtn}
                accessibilityLabel={t('pipeline_search_ph') || 'Aday ara'}
              >
                <SearchIcon color="#E4B35D" size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openPoolFilter(null)}
                activeOpacity={0.88}
                style={styles.poolFilterCtaWrap}
              >
                <LinearGradient
                  colors={[FILTRE_GOLD_LIGHT, FILTRE_GOLD_DARK]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[styles.poolFilterCta, (activeCount > 0 || poolSearchActive) && styles.poolFilterCtaOn]}
                >
                  <FunnelIcon color="#1a2030" size={11} />
                  <Text style={[styles.poolFilterCtaText, fontsReady && styles.poolFilterCtaTextFont]}>
                    {(lang === 'tr' ? 'FİLTRE' : t('agency_filter_btn')).toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US')}
                  </Text>
                  {(activeCount > 0 || poolSearchActive) ? (
                    <View style={styles.poolFilterCtaBadge}>
                      <Text style={styles.poolFilterCtaBadgeText}>{activeCount + (poolSearchActive ? 1 : 0)}</Text>
                    </View>
                  ) : null}
                </LinearGradient>
              </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.poolChipRow}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.poolChip, !activeCount && !favOn && styles.poolChipOn]}
                onPress={clearAllPoolFilters}
                activeOpacity={0.85}
              >
                <Text style={[styles.poolChipText, !activeCount && !favOn && styles.poolChipTextOn]}>{t('pool_chip_all')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.poolChip} onPress={() => setSortSheetOpen(true)} activeOpacity={0.85}>
                <Text style={styles.poolChipText}>{t('sort_by')}</Text>
                <Text style={styles.poolChipChev}>▾</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.poolChip, (advFilters?.positions?.length) && styles.poolChipOn]} onPress={() => openPoolFilter('positions')} activeOpacity={0.85}>
                <Text style={[styles.poolChipText, (advFilters?.positions?.length) && styles.poolChipTextOn]}>{t('pool_chip_position')}</Text>
                <Text style={styles.poolChipChev}>▾</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.poolChip, favOn && styles.poolChipOn]}
                onPress={() => { setFavSheetPurpose('filter'); setFavPickOpen(true); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.poolChipText, favOn && styles.poolChipTextOn]}>★ {t('fav_filter_btn')}</Text>
              </TouchableOpacity>
            </ScrollView>
            </>
            )}

            {!poolSearchOpen && poolFilterChips.length ? (
              <View style={styles.poolApplied}>
                {poolFilterChips.map((ch) => (
                  <TouchableOpacity key={ch.id} style={styles.poolAppliedChip} onPress={ch.rm} activeOpacity={0.85}>
                    <Text style={styles.poolAppliedText} numberOfLines={1}>{ch.label}</Text>
                    <Text style={styles.poolAppliedX}>✕</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={clearAllPoolFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.poolAppliedClear}>{t('agency_clear_all')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
        </>
      </View>

      {selectMode ? (
        <View style={[styles.selectPanel, styles.selectPanelDark]}>
          <View style={styles.selectRow}>
            <TouchableOpacity style={[styles.selectAllBtn, styles.selectAllBtnDark]} onPress={selectAllFiltered} activeOpacity={0.8}>
              <Text style={[styles.selectAllText, styles.selectAllTextDark]}>☑ {t('agency_select_all')}</Text>
            </TouchableOpacity>
            <Text style={[styles.selectCount, styles.selectCountDark]}>{t('agency_selected', { n: selectedIds.length })}</Text>
          </View>
          {codeChips.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
              {codeChips.map((ch) => (
                <TouchableOpacity key={ch.user_id} style={styles.codeChipDark} onPress={() => removeChip(ch.user_id)} activeOpacity={0.8}>
                  {ch.photo ? <Image source={{ uri: ch.photo }} style={styles.codeChipImg} /> : null}
                  <Text style={styles.codeChipTextDark}>{ch.code}</Text>
                  <Text style={styles.codeChipXDark}>✕</Text>
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
          ref={poolListRef}
          data={poolVisibleItems}
          keyExtractor={(c) => c.user_id}
          renderItem={renderItem}
          contentContainerStyle={[styles.poolListContent, {
            paddingBottom: kbOpen ? 28 : insets.bottom + (view === 'pool' ? 20 : FOOTER_CONTENT_PAD),
          }]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          onEndReached={poolSearchOpen ? undefined : loadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<Text style={styles.poolEmpty}>{favOn ? t('fav_empty') : ((poolSearchActive || poolSearch) ? (t('agency_code_notfound') || t('agency_empty')) : t('agency_empty'))}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#c2a25a" style={{ marginVertical: 16 }} /> : null}
        />
      )}

      {selectMode ? (
        <View style={[styles.bulkBar, styles.bulkBarDark, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={[styles.bulkText, styles.bulkTextDark]}>{t('agency_selected', { n: selectedIds.length })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={exitSelect} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>{t('agency_cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, (bulkBusy || !selectedIds.length) && { opacity: 0.5 }]} onPress={openBulkFav} disabled={bulkBusy || !selectedIds.length} activeOpacity={0.9}>
              {bulkBusy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.bulkBtnText}>{t('fav_title_add')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      </>
      )}

      {!selectMode && !kbOpen ? (() => {
        const FOOTER_GOLD = '#E4B35D';
        const FOOTER_MUTED = '#C7D0DB';
        const activeFooter = messagesOpen
          ? 'messages'
          : contactOpen
            ? 'contact'
          : footerTab === 'matches'
            ? 'matches'
            : footerTab === 'announcements'
              ? 'announcements'
              : null;
        const tabs = [
          {
            id: 'matches',
            label: t('nav_matches'),
            Icon: FooterMatchesIcon,
            badge: matchesBadge,
            onPress: () => { setView('ops'); setFooterTab('matches'); setMessagesOpen(false); },
          },
          {
            id: 'announcements',
            label: t('home_announce_short'),
            Icon: FooterAnnounceIcon,
            badge: announceUnread,
            onPress: () => { setView('ops'); setFooterTab('announcements'); setMessagesOpen(false); },
          },
          {
            id: 'messages',
            label: t('nav_messages'),
            Icon: FooterMessagesIcon,
            badge: chatBadge,
            onPress: () => { setView('ops'); setFooterTab(null); setMessagesOpen(true); },
          },
          {
            id: 'contact',
            label: t('home_support_short'),
            Icon: FooterContactIcon,
            badge: 0,
            onPress: () => { setView('ops'); setFooterTab(null); setMessagesOpen(false); setContactOpen(true); },
          },
        ];
        return (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.footerGold} />
            {tabs.map((tab) => {
              const on = activeFooter === tab.id;
              const color = on ? FOOTER_GOLD : FOOTER_MUTED;
              return (
                <TouchableOpacity key={tab.id} style={styles.footerTab} onPress={tab.onPress} activeOpacity={0.8}>
                  <View style={styles.footerIconPlain}>
                    <tab.Icon color={color} size={22} />
                    {tab.badge > 0 ? (
                      <View style={styles.footerBadge}>
                        <Text style={styles.footerBadgeText}>{tab.badge > 9 ? '9+' : tab.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.footerLabel, on && styles.footerLabelOn]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {tab.label}
                  </Text>
                  {on ? <View style={styles.footerUnderline} /> : <View style={styles.footerUnderlineSpacer} />}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })() : null}

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

      <ProcessChatSheet
        visible={!!chatPeer}
        light
        onClose={() => {
          setChatPeer(null);
          unreadChatCount(userId).then(setChatBadge).catch(() => {});
        }}
        onRead={() => unreadChatCount(userId).then(setChatBadge).catch(() => {})}
        candidateId={chatPeer?.id}
        peerLabel={chatPeer?.label}
        peerPhoto={chatPeer?.photo}
        peerName={chatPeer?.name}
        peerCode={chatPeer?.code}
      />

      <AgencyRemindersSheet
        visible={remindersOpen}
        light
        onClose={() => setRemindersOpen(false)}
        agencyId={userId}
        onPick={(a) => {
          if (a?.cat === 'messages' || a?.filter === 'chat') setMessagesOpen(true);
          else setView('ops');
        }}
      />
      <ContactSheet visible={contactOpen} onClose={() => setContactOpen(false)} showFaq={false} />

      <AgencyFilterSheet
        visible={sheetVisible}
        light
        initial={advFilters}
        focusSection={filterFocus}
        onApply={(f) => {
          setAdvFilters(f || {});
          setFilterFocus(null);
          setSheetVisible(false);
        }}
        onClose={() => { setFilterFocus(null); setSheetVisible(false); }}
      />

      <Modal visible={sortSheetOpen} transparent animationType="fade" onRequestClose={() => setSortSheetOpen(false)}>
        <Pressable style={styles.rangeBackdrop} onPress={() => setSortSheetOpen(false)}>
          <Pressable style={styles.rangeSheet} onPress={() => {}}>
            <View style={styles.rangeHandle} />
            <Text style={styles.rangeTitle}>{t('sort_by')}</Text>
            {[
              { value: 'online', key: 'sort_online_desc' },
              { value: 'online_old', key: 'sort_online_asc' },
            ].map((o) => {
              const on = poolSort === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.sortOpt, on && styles.sortOptOn]}
                  onPress={() => { setPoolSort(o.value); setSortSheetOpen(false); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sortOptText, on && styles.sortOptTextOn]}>{t(o.key)}</Text>
                  {on ? <Text style={styles.sortOptTick}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {favPickOpen ? (
      <LazyFavoriteHub
        visible={favPickOpen}
        light
        agencyId={userId}
        purpose={favSheetPurpose}
        initialEmployerId={favSheetPurpose === 'filter' && favOn ? favEmployerId : null}
        initialEmployerName={favSheetPurpose === 'filter' && favOn ? favEmployerName : ''}
        onSelect={onFavFilterPick}
        onClose={() => { setFavPickOpen(false); setPendingFavIds([]); }}
      />
      ) : null}

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
  wrapPool: { backgroundColor: '#F5F1E9' },
  wrapPipeline: { backgroundColor: '#F5F1E9' },
  wrapHotels: { backgroundColor: '#0A1121' },
  menuTextPool: { color: 'rgba(235,241,247,0.82)' },
  menuTextPipeline: { color: 'rgba(235,241,247,0.82)' },
  menuTextOnPool: { color: '#F3D08A' },
  menuTextOnPipeline: { color: '#F3D08A' },
  menuItemOnPool: {},
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingBottom: 16, backgroundColor: '#0f1826', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 7, zIndex: 2 },
  hero: { paddingLeft: 14, paddingRight: 14, paddingBottom: 10, backgroundColor: '#0f1826', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 8, zIndex: 2 },
  heroPool: { backgroundColor: '#152032', paddingBottom: 9, shadowOpacity: 0 },
  heroPipeline: { backgroundColor: '#0f1826', paddingBottom: 8, shadowOpacity: 0 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroSide: { width: 40, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 2 },
  heroSideRight: { alignItems: 'flex-end', paddingRight: 2 },
  heroBrandCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    transform: [{ translateX: -12 }],
  },
  heroBrandMarkRow: { alignItems: 'center', justifyContent: 'center', gap: 0 },
  heroLogoMark: { width: 34, height: 34 },
  heroBrandTexts: { alignItems: 'center', justifyContent: 'center', marginTop: -1, paddingLeft: 0 },
  heroNav: {
    marginTop: 18, marginHorizontal: 4, paddingTop: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  heroNavPool: { marginTop: 17 },
  heroNavPipeline: { marginTop: 16 },
  heroBrandName: {
    color: MARK_TURQUOISE, fontSize: 20, fontWeight: '400', letterSpacing: 3.8,
    includeFontPadding: false, textAlign: 'left',
  },
  heroBrandNameFont: { fontFamily: 'Cinzel_600SemiBold', fontWeight: '400', letterSpacing: 4.0 },
  heroBrandSub: {
    color: MARK_GOLD, fontSize: 8.5, fontWeight: '700', letterSpacing: 1.0,
    marginTop: 2, textTransform: 'uppercase', textAlign: 'left',
  },
  heroBrandSubFont: { fontFamily: 'Inter_700Bold', fontWeight: '700', letterSpacing: 1.05 },
  heroBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 8, minWidth: 0 },
  heroTitles: { flex: 1, minWidth: 0, marginLeft: -2 },
  heroSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroSearchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  heroSearchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.4, padding: 0 },
  heroSearchGo: { color: '#dcc187', fontWeight: '800', fontSize: 13.5 },
  heroSearchClose: { color: '#e7dcc4', fontSize: 20, fontWeight: '700' },
  poolSearchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2, gap: 6 },
  poolSearchField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#d9dde3',
  },
  poolSearchFieldErr: { borderColor: '#e8a090', backgroundColor: '#fff8f6' },
  poolSearchInput: { flex: 1, color: INK, fontSize: 15.5, fontWeight: '600', padding: 0 },
  poolSearchClear: { color: '#8a93a0', fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  poolSearchMeta: { color: '#5a6575', fontSize: 12.5, fontWeight: '700', paddingHorizontal: 2 },
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
  hotelManageSheet: { flex: 1, backgroundColor: C.bg },
  hotelManageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 10, backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.hair,
  },
  hotelManageTitle: { color: INK, fontSize: 20, fontWeight: '900' },
  menuHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 3, backgroundColor: '#ddd2b8', marginBottom: 10 },
  menuHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  menuHeadTitle: { fontSize: 20, fontWeight: '900', color: INK, letterSpacing: 0.2 },
  menuCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ebe4d5', alignItems: 'center', justifyContent: 'center' },
  menuCloseX: { fontSize: 15, fontWeight: '800', color: '#5c6570' },
  menuScroll: { flexGrow: 0 },
  menuScrollContent: { paddingBottom: 8 },
  menuSection: { fontSize: 11.5, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10, marginLeft: 2 },
  idCard: {
    backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
  },
  idCardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  idLogo: {
    width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f1826', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
    overflow: 'hidden',
  },
  idPhoto: { width: '100%', height: '100%' },
  idPhotoEdit: {
    position: 'absolute', right: 3, bottom: 3, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,24,38,0.86)',
  },
  idPhotoEditText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  idEditBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3ECDC', borderWidth: 1, borderColor: 'rgba(194,162,90,0.3)',
  },
  idEditIcon: { color: '#8A6A1F', fontSize: 16, fontWeight: '900' },
  idCode: { marginTop: 4, fontSize: 14, fontWeight: '800', color: '#A07D35', letterSpacing: 0.9 },
  idName: { fontSize: 18, fontWeight: '900', color: INK },
  idBadge: {
    alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, backgroundColor: '#F3ECDC',
  },
  idBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#8A6A1F', letterSpacing: 0.45 },
  idHint: { marginTop: 11, fontSize: 11.5, fontWeight: '600', color: '#8A929C' },
  profileEditForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eee6d9', paddingTop: 4 },
  profileEditHint: { color: '#737d89', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  profileNameRow: { flexDirection: 'row', gap: 10 },
  profileNameField: { flex: 1 },
  profileEditActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
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
  settingsHotelsIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3ECDC', alignItems: 'center', justifyContent: 'center' },
  settingsHotelsIconText: { color: '#8A6A1F', fontSize: 21, fontWeight: '800', marginTop: -2 },
  settingsHotelsTitle: { color: INK, fontWeight: '800', fontSize: 15 },
  settingsHotelsDesc: { color: '#8a929c', fontWeight: '600', fontSize: 12, marginTop: 3 },
  menuLogoutIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fbeae8', alignItems: 'center', justifyContent: 'center' },
  menuLogoutText: { color: '#b5413a', fontWeight: '800', fontSize: 15 },
  menuLogoutHint: { color: '#c9a9a4', fontSize: 22, fontWeight: '300' },
  profOverlay: { flex: 1, backgroundColor: 'rgba(10,16,24,0.6)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  profCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 22 },
  profTitle: { fontSize: 19, fontWeight: '900', color: '#1b2533', marginBottom: 14 },
  profLbl: { fontSize: 12.5, fontWeight: '700', color: '#737373', marginBottom: 5, marginTop: 10 },
  profInput: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 16, color: '#1b2533' },
  profErr: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: 10 },
  profSave: { flex: 1, backgroundColor: '#c2a25a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center', marginTop: 0 },
  profSaveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  profCancel: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  profCancelText: { color: '#9aa1ac', fontSize: 14, fontWeight: '700' },
  segTrack: { flexDirection: 'row', flexGrow: 1 },
  menuItem: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
    paddingVertical: 3, paddingHorizontal: 2,
  },
  menuItemOn: {},
  menuText: {
    fontSize: 12.5, fontWeight: '600', color: 'rgba(154,166,182,0.72)',
    letterSpacing: 0.2, textAlign: 'center',
  },
  menuTextOn: { color: '#E8D5A8', fontWeight: '700' },
  menuUnderline: {
    marginTop: 4, width: 16, height: 2, borderRadius: 1, backgroundColor: GOLD,
  },
  menuUnderlinePool: { backgroundColor: MARK_GOLD },
  menuUnderlinePipeline: { backgroundColor: PIPE_GOLD_BTN },
  menuUnderlineSpacer: { marginTop: 4, width: 16, height: 2 },
  navBadge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#b42318', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  pipeChrome: { backgroundColor: PIPE_BG, paddingBottom: 4 },
  pipeIntro: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  pipeKicker: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase',
    color: PIPE_GOLD,
  },
  pipeLead: { marginTop: 4, fontSize: 13, fontWeight: '600', color: PIPE_TEXT_SEC, lineHeight: 18 },
  pipeStats: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    backgroundColor: PIPE_CARD, borderRadius: 12, borderWidth: 1, borderColor: PIPE_BORDER,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  pipeStatsTxt: { fontSize: 12.5, fontWeight: '700', color: PIPE_INK, textAlign: 'center' },
  pipeNav: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  pipePhaseTrack: {
    flexDirection: 'row', backgroundColor: PIPE_CARD, borderRadius: 999, padding: 4, gap: 4,
    borderWidth: 1, borderColor: PIPE_BORDER,
  },
  pipePhase: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pipePhaseOn: { backgroundColor: PIPE_GOLD_BTN },
  pipePhaseText: { fontSize: 14, fontWeight: '800', color: PIPE_TEXT_SEC, letterSpacing: 0.2 },
  pipePhaseTextOn: { color: PIPE_BG },
  pipeStageRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6, paddingHorizontal: 0 },
  pipeStage: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 8, paddingHorizontal: 2 },
  pipeStageText: { fontSize: 13, fontWeight: '700', color: PIPE_TEXT_SEC, textAlign: 'center' },
  pipeStageTextOn: { color: PIPE_INK, fontWeight: '800' },
  pipeStageLine: { marginTop: 6, height: 2.5, width: 22, borderRadius: 2, backgroundColor: PIPE_GOLD_BTN },
  pipeCategory: {
    width: 104, minHeight: 76, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingHorizontal: 8, paddingVertical: 9, marginRight: 8,
  },
  pipeCategoryIcon: { fontSize: 20, lineHeight: 23, color: PIPE_TEXT_SEC, marginBottom: 3 },
  pipeCategoryText: { fontSize: 12, fontWeight: '800', color: PIPE_TEXT_SEC, textAlign: 'center' },
  pipeCategoryCount: { fontSize: 11, fontWeight: '800', color: PIPE_TEXT_SEC, marginTop: 3 },
  pipelineToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, paddingHorizontal: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PIPE_BORDER,
  },
  pipelineCount: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  pipelineCountNumber: { fontSize: 17, fontWeight: '900', color: PIPE_INK },
  pipelineCountLabel: { fontSize: 12, fontWeight: '700', color: PIPE_TEXT_SEC },
  pipelineToolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pipelineSort: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36,
    paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: PIPE_BORDER,
  },
  pipelineSortText: { fontSize: 11.5, fontWeight: '800', color: PIPE_INK, maxWidth: 112 },
  pipelineFilter: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: PIPE_BORDER,
  },
  formerActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 12 },
  formerActBtn: {
    flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, backgroundColor: '#16202e',
  },
  formerActBtnGold: { backgroundColor: GOLD },
  formerActText: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  formerActTextGold: { fontSize: 13.5, fontWeight: '800', color: '#1b2533' },
  subTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: 'transparent' },
  pipeFilterBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, backgroundColor: PIPE_CARD, borderWidth: 1, borderColor: PIPE_BORDER,
  },
  pipeFilterText: { flex: 1, fontSize: 13, fontWeight: '700', color: PIPE_INK },
  pipeFilterClear: { fontSize: 12, fontWeight: '800', color: PIPE_GOLD_BTN },
  subChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ebe4d5', maxWidth: '100%' },
  subChipOn: { backgroundColor: '#16202e' },
  subChipText: { fontSize: 12.5, fontWeight: '800', color: '#737373' },
  subChipTextOn: { color: '#fff' },
  ivJoinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  ivCdText: { flex: 1, color: PIPE_GOLD_BTN, fontWeight: '800', fontSize: 12.5 },
  ivJoinMini: { backgroundColor: PIPE_GOLD_BTN, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  ivJoinMiniText: { color: PIPE_BG, fontWeight: '900', fontSize: 12.5 },
  concActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  concNote: { marginTop: 12, borderRadius: 11, paddingVertical: 11, alignItems: 'center', backgroundColor: 'rgba(18,27,46,0.85)', borderWidth: 1, borderColor: PIPE_BORDER },
  concNoteOk: { color: '#5dd39e', fontWeight: '800', fontSize: 13.5 },
  concNotePend: { color: PIPE_GOLD_BTN, fontWeight: '800', fontSize: 13.5 },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(179,45,45,0.15)', borderWidth: 1, borderColor: 'rgba(240,128,128,0.35)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  rejectBtnText: { color: '#f08080', fontWeight: '800', fontSize: 13.5 },
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
  sbToolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'nowrap',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },
  poolCountInline: {
    flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
    flexShrink: 0, paddingRight: 2, minWidth: 36, maxWidth: 64,
  },
  poolCountNum: { fontSize: 14, fontWeight: '800', color: '#9aa3b0', letterSpacing: 0.1, lineHeight: 16 },
  poolCountLbl: { fontSize: 11, fontWeight: '600', color: '#b0b7c1', lineHeight: 13, marginTop: 1 },
  sbToolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dde3',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    flexShrink: 1,
  },
  sbToolBtnOn: { borderColor: GOLD, backgroundColor: 'rgba(194,162,90,0.12)' },
  sbToolBtnText: { fontSize: 13, fontWeight: '800', color: INK },
  sbToolBtnTextOn: { color: '#8a6a1f' },
  sbToolChev: { fontSize: 11, color: '#6b7280', fontWeight: '800' },
  sbToolBadge: {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center',
  },
  sbToolBadgeText: { color: '#1b2533', fontSize: 10.5, fontWeight: '900' },
  sbApplied: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  sbAppliedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '78%',
    backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
    borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6,
  },
  sbAppliedText: { fontSize: 12.5, fontWeight: '700', color: '#8a6a1f', flexShrink: 1 },
  sbAppliedX: { fontSize: 12, fontWeight: '800', color: '#8a6a1f' },
  sbAppliedClear: { fontSize: 12.5, fontWeight: '700', color: '#6b7280', textDecorationLine: 'underline' },
  sortOpt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eceff3',
  },
  sortOptOn: {},
  sortOptText: { fontSize: 15.5, fontWeight: '700', color: INK },
  sortOptTextOn: { color: '#8a6a1f' },
  sortOptTick: { fontSize: 16, fontWeight: '800', color: GOLD },
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
  favFilterPill: { flexDirection: 'row', alignItems: 'center', maxWidth: '42%', backgroundColor: '#eef0f2', borderRadius: 20, paddingVertical: 7, borderWidth: 1, borderColor: '#e6e8ec' },
  favFilterPillOn: { backgroundColor: 'rgba(194,162,90,0.16)', borderColor: GOLD },
  favFilterMain: { flexShrink: 1, paddingHorizontal: 12 },
  favFilterText: { fontSize: 12.5, fontWeight: '800', color: '#5c6675', flexShrink: 1 },
  favFilterTextOn: { color: '#8a6a1f' },
  favFilterX: { paddingHorizontal: 10, paddingVertical: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(138,106,31,0.35)' },
  favFilterXText: { fontSize: 12, fontWeight: '800', color: '#8a6a1f' },
  sortPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PIPE_CARD, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '100%', borderWidth: 1, borderColor: PIPE_BORDER },
  sortArrow: { color: PIPE_GOLD_BTN, fontSize: 14, fontWeight: '900' },
  sortPillText: { color: PIPE_INK, fontWeight: '800', fontSize: 12.5, flexShrink: 1 },
  rangeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(200,184,142,0.12)', borderWidth: 1, borderColor: PIPE_BORDER, borderRadius: 20, paddingLeft: 12, paddingRight: 9, paddingVertical: 7 },
  rangeChipText: { color: PIPE_GOLD_BTN, fontWeight: '800', fontSize: 12 },
  rangeChipX: { color: PIPE_GOLD_BTN, fontWeight: '900', fontSize: 12 },
  rangeIconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: PIPE_CARD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PIPE_BORDER },
  rangeIconBtnOn: { backgroundColor: PIPE_GOLD_BTN },

  // --- Mülakat / Personel premium kart (Adaylar — koyu) ---
  richContent: { paddingHorizontal: 16, paddingTop: 8 },
  pipeEmpty: { textAlign: 'center', color: PIPE_TEXT_SEC, marginTop: 50, fontSize: 15 },
  empSec: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: PIPE_CARD, borderRadius: 12, borderWidth: 1, borderColor: PIPE_BORDER,
  },
  empSecChev: { fontSize: 12, fontWeight: '800', color: PIPE_GOLD, width: 14 },
  empSecTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: PIPE_INK, letterSpacing: 0.6, textTransform: 'uppercase' },
  empSecN: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7,
    backgroundColor: 'rgba(168,148,104,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  empSecNTxt: { fontSize: 11, fontWeight: '800', color: PIPE_GOLD_BTN },
  rich: {
    backgroundColor: PIPE_CARD, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: PIPE_BORDER,
  },
  richAgencyTurn: { borderLeftWidth: 3, borderLeftColor: PIPE_GOLD_BTN },
  richSel: { borderColor: PIPE_GOLD_BTN, borderWidth: 1.5 },
  richCheck: { position: 'relative', top: 0, right: 0, marginLeft: 6 },
  richTop: { flexDirection: 'row', alignItems: 'center' },
  richPhotoBox: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
    backgroundColor: PIPE_BG, borderWidth: 2, borderColor: PIPE_GOLD_BTN,
  },
  richPhoto: { width: '100%', height: '100%' },
  richMetaRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  richInlineFlag: { width: 18, height: 12, borderRadius: 2, marginRight: 6 },
  richName: { fontSize: 15, fontWeight: '800', color: PIPE_INK },
  richCode: { fontSize: 12.5, fontWeight: '600', color: PIPE_TEXT_SEC, letterSpacing: 0.2, marginTop: 3 },
  richChev: { fontSize: 22, color: 'rgba(200,184,142,0.45)', fontWeight: '300', marginLeft: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  pipeBMuted: { backgroundColor: 'rgba(142,152,168,0.14)' },
  pipeBGreen: { backgroundColor: 'rgba(31,138,76,0.18)' },
  pipeBAmber: { backgroundColor: 'rgba(200,184,142,0.16)' },
  pipeBRed: { backgroundColor: 'rgba(179,45,45,0.16)' },
  bMuted: { backgroundColor: '#f1f2f4' },
  bGreen: { backgroundColor: '#e6f4ec' },
  bAmber: { backgroundColor: '#fbf0d9' },
  bRed: { backgroundColor: '#fbeaea' },
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12,
    backgroundColor: 'rgba(200,184,142,0.1)', borderWidth: 1, borderColor: 'rgba(200,184,142,0.22)',
    borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9,
  },
  dateStripRed: { backgroundColor: 'rgba(179,45,45,0.12)', borderColor: 'rgba(240,128,128,0.28)' },
  dateStripText: { flex: 1, fontSize: 12.5, fontWeight: '800', color: PIPE_GOLD_BTN },
  dateSep: { width: 1, height: 16, backgroundColor: 'rgba(200,184,142,0.35)' },
  dateStripTime: { fontSize: 12.5, fontWeight: '800', color: PIPE_GOLD_BTN },
  richOnlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  richOnlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  richOnlineTxt: { fontSize: 11.5, fontWeight: '600', color: PIPE_TEXT_SEC, flex: 1 },

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

  poolChrome: { backgroundColor: '#F5F1E9' },
  poolSearchWrapDark: { backgroundColor: 'transparent' },
  poolSearchFieldDark: {
    backgroundColor: '#FFFFFF', borderColor: '#D8CDBB',
  },
  poolSearchFieldErrDark: { borderColor: '#c56a5d', backgroundColor: '#fff5f3' },
  poolSearchInputDark: { color: INK },
  poolSearchClearDark: { color: '#A07D35', fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  codeErrBarDark: { color: '#a32d2d', fontSize: 12.5, fontWeight: '600', paddingHorizontal: 16, paddingTop: 6, backgroundColor: '#F5F1E9' },
  poolHeadRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  poolHeadActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  poolSearchIconBtn: {
    width: 38, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#243047', borderWidth: 1, borderColor: 'rgba(228,179,93,0.28)',
  },
  poolExpandedSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 14, marginTop: 12, marginBottom: 12, paddingHorizontal: 13,
    minHeight: 46, borderRadius: 13, backgroundColor: '#243047',
    borderWidth: 1, borderColor: 'rgba(228,179,93,0.42)',
  },
  poolExpandedSearchInput: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', padding: 0 },
  poolExpandedSearchClear: { color: '#E4B35D', fontSize: 16, fontWeight: '700', paddingHorizontal: 4 },
  poolHeadTitle: { fontSize: 17, fontWeight: '400', color: INK, letterSpacing: 0.12, lineHeight: 21 },
  poolHeadTitleFont: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
  poolHeadSub: { marginTop: 2, fontSize: 12, fontWeight: '400', color: '#6D7480', lineHeight: 16 },
  poolHeadSubFont: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
  poolFilterCtaWrap: { borderRadius: 999, overflow: 'hidden' },
  poolFilterCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8,
  },
  poolFilterCtaOn: { opacity: 0.92 },
  poolFilterCtaText: {
    color: '#1a2030', fontSize: 11.5, fontWeight: '400', letterSpacing: 1.2,
    includeFontPadding: false,
  },
  poolFilterCtaTextFont: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
  poolFilterCtaBadge: {
    minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: '#1a2030', alignItems: 'center', justifyContent: 'center',
  },
  poolFilterCtaBadgeText: { color: FILTRE_GOLD_DARK, fontSize: 9, fontWeight: '700' },
  poolChipRow: { paddingHorizontal: 14, paddingBottom: 10, gap: 8, alignItems: 'center' },
  poolChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8CDBB',
  },
  poolChipOn: { borderColor: GOLD, backgroundColor: 'rgba(194,162,90,0.12)' },
  poolChipText: { fontSize: 13, fontWeight: '700', color: '#596575' },
  poolChipTextOn: { color: INK },
  poolChipChev: { fontSize: 11, color: '#6D7480', fontWeight: '800' },
  poolApplied: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 8 },
  poolAppliedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '78%',
    backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
    borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6,
  },
  poolAppliedText: { fontSize: 12.5, fontWeight: '700', color: INK, flexShrink: 1 },
  poolAppliedX: { fontSize: 12, fontWeight: '800', color: GOLD },
  poolAppliedClear: { fontSize: 12.5, fontWeight: '700', color: '#596575', textDecorationLine: 'underline' },
  poolListContent: { paddingHorizontal: 14, paddingTop: 6 },
  poolEmpty: { textAlign: 'center', color: '#8b93a0', marginTop: 50, fontSize: 15 },
  poolRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#D8CDBB',
    shadowColor: '#142033', shadowOpacity: 0.07, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  poolRowSel: { borderColor: GOLD, borderWidth: 1.5 },
  poolAvatarWrap: { position: 'relative' },
  poolAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(194,162,90,0.35)',
    borderWidth: 2, borderColor: MARK_GOLD,
  },
  poolAvatarPh: { alignItems: 'center', justifyContent: 'center' },
  poolAvatarIcon: { fontSize: 30 },
  poolCodeRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  poolCornerFlag: {
    position: 'absolute', bottom: 2, right: 2, width: 22, height: 15, borderRadius: 3,
    borderWidth: 1, borderColor: '#fff',
  },
  poolRowMain: { flex: 1, minWidth: 0, paddingTop: 1 },
  poolRowCode: { fontSize: 15, fontWeight: '700', color: INK, letterSpacing: 0.3 },
  poolRowName: { fontSize: 13.5, fontWeight: '600', color: '#3D4654', marginTop: 2 },
  poolRowTitle: { fontSize: 12.5, fontWeight: '600', color: '#596575', marginTop: 3 },
  poolRowDate: { fontSize: 11.5, fontWeight: '600', color: '#6D7480', marginTop: 4 },
  poolRowSeen: { fontSize: 11, fontWeight: '600', color: '#7A8492', marginTop: 4 },
  poolRowPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
  },
  poolRowAside: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 1, paddingLeft: 2,
  },
  poolStarBtn: { paddingHorizontal: 2, paddingVertical: 1 },
  poolStarOn: { fontSize: 21, color: MARK_GOLD, fontWeight: '700', lineHeight: 24 },
  poolStarOff: { fontSize: 21, color: 'rgba(89,101,117,0.45)', fontWeight: '400', lineHeight: 24 },
  poolRowChev: { fontSize: 20, color: 'rgba(20,32,51,0.45)', fontWeight: '300', marginTop: -1 },
  poolCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#9AA1AC',
    alignItems: 'center', justifyContent: 'center',
  },
  poolCheckOn: { backgroundColor: GOLD, borderColor: GOLD },
  selectPanelDark: { backgroundColor: '#121c2a', borderBottomColor: 'rgba(194,162,90,0.2)' },
  selectAllBtnDark: { backgroundColor: '#c2a25a', borderWidth: 1, borderColor: '#e0c982' },
  selectAllTextDark: { color: INK },
  selectCountDark: { color: '#8b93a0' },
  codeChipDark: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1b2838',
    borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(194,162,90,0.3)',
  },
  codeChipTextDark: { color: '#e7dcc4', fontWeight: '700', fontSize: 12.5 },
  codeChipXDark: { color: GOLD, fontWeight: '800', fontSize: 12 },
  bulkBarDark: { backgroundColor: '#121c2a', borderTopColor: 'rgba(194,162,90,0.25)' },
  bulkTextDark: { color: '#e7dcc4' },

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
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#0B1220',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(228,179,93,0.35)',
    paddingTop: 8, paddingHorizontal: 4,
  },
  footerGold: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(228,179,93,0.75)' },
  footerTab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3, paddingVertical: 2, minWidth: 0 },
  footerIconPlain: {
    width: 28, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  footerLabel: { fontSize: 10, fontWeight: '700', color: '#C7D0DB', letterSpacing: 0.15, textAlign: 'center' },
  footerLabelOn: { color: '#E4B35D' },
  footerUnderline: {
    marginTop: 3, width: 28, height: 2, borderRadius: 1, backgroundColor: '#E4B35D',
  },
  footerUnderlineSpacer: { marginTop: 3, height: 2 },
  footerBadge: {
    position: 'absolute', top: -3, right: -6, minWidth: 14, height: 14, borderRadius: 7,
    paddingHorizontal: 3, backgroundColor: '#A07D35', alignItems: 'center', justifyContent: 'center',
  },
  footerBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  footerWarnDot: {
    position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: '#A07D35',
  },
  bulkText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bulkBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  bulkBtnText: { color: INK, fontSize: 15, fontWeight: '800' },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, justifyContent: 'center' },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const pipeLightStyles = StyleSheet.create({
  chrome: { backgroundColor: C.bg },
  intro: { backgroundColor: C.bg },
  kicker: { color: C.goldText },
  lead: { color: C.ink2 },
  nav: { backgroundColor: C.bg },
  phaseTrack: { backgroundColor: C.card, borderColor: C.hair },
  phase: { backgroundColor: C.card },
  phaseOn: { backgroundColor: C.ink },
  phaseText: { color: C.ink2 },
  phaseTextOn: { color: '#F7F2E8' },
  categoryRail: { paddingTop: 10, paddingBottom: 2, paddingRight: 8 },
  category: { backgroundColor: C.card, borderWidth: 1, borderColor: C.hair },
  categoryOn: {
    backgroundColor: C.ink, borderColor: C.ink,
    shadowColor: C.ink, shadowOpacity: 0.16, shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  categoryIconOn: { color: C.goldText },
  categoryText: { color: C.ink2 },
  categoryTextOn: { color: '#F7F2E8' },
  categoryCount: { color: C.muted },
  categoryCountOn: { color: C.goldText },
  categoryLine: { position: 'absolute', bottom: 6, width: 28, height: 2.5, borderRadius: 2, backgroundColor: C.goldText },
  pipelineToolbar: { borderTopColor: C.hair },
  pipelineCountNumber: { color: C.ink },
  pipelineCountLabel: { color: C.muted },
  pipelineSort: { backgroundColor: C.card, borderColor: C.hair },
  pipelineSortIcon: { color: C.goldText, fontSize: 14, fontWeight: '900' },
  pipelineSortText: { color: C.ink2 },
  pipelineFilter: { backgroundColor: C.card, borderColor: C.hair },
  pipelineFilterOn: { backgroundColor: C.goldSoft, borderColor: C.goldText },
  pipelineSearchBtn: { backgroundColor: C.card, borderColor: C.hair },
  pipelineSearchField: { borderColor: C.goldText },
  stats: { backgroundColor: C.card, borderColor: C.hair },
  statsTxt: { color: C.ink },
  richContent: { backgroundColor: C.bg },
  pipeEmpty: { color: C.ink2 },
  rich: {
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12,
    borderColor: C.hair,
    shadowColor: C.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  richPhotoBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.goldSoft, borderColor: C.goldText },
  photoPh: { backgroundColor: '#E9E4DA' },
  richName: { color: C.ink },
  richCode: { color: C.ink2 },
  richEmployer: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  badge: { backgroundColor: C.goldSoft, borderColor: C.hair },
  badgeText: { color: C.goldText },
  checkbox: { backgroundColor: C.card, borderColor: '#9AA1AC' },
  checkboxOn: { backgroundColor: C.goldText, borderColor: C.goldText },
  richChev: { color: 'rgba(20,32,51,0.55)' },
  cardAside: { alignItems: 'center', gap: 6, paddingTop: 1 },
  pipelineStar: { fontSize: 23, lineHeight: 26, color: 'rgba(89,101,117,0.45)' },
  pipelineStarOn: { color: C.goldText, fontWeight: '800' },
  progressTrack: { height: 4, width: '100%', marginTop: 8, borderRadius: 2, overflow: 'hidden', backgroundColor: '#E8E2D8' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: '#2DAFC0' },
  dateStrip: { backgroundColor: C.goldSoft, borderColor: C.hair },
  dateStripText: { color: C.goldText },
  dateStripTime: { color: C.goldText },
  richOnlineTxt: { color: C.ink2 },
  empSec: { backgroundColor: C.card, borderColor: C.hair },
  empSecChev: { color: C.goldText },
  empSecTitle: { color: C.ink },
  empSecN: { backgroundColor: C.goldSoft },
  empSecNTxt: { color: C.goldText },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: C.bg,
  },
  pipelineSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
    backgroundColor: C.bg,
  },
  searchField: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.hair,
    backgroundColor: C.card,
  },
  searchIcon: { fontSize: 23, lineHeight: 25, color: C.ink2, marginTop: -3 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14, fontWeight: '600', color: C.ink },
  searchClear: { fontSize: 13, fontWeight: '800', color: C.ink2, paddingHorizontal: 3 },
  listTitle: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    color: C.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

const matchStyles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F1E9' },
  content: { paddingHorizontal: 16, paddingTop: 18 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#142033', fontSize: 22, fontWeight: '800', letterSpacing: 0.2, marginBottom: 6 },
  offerSectionTitle: { color: '#142033', fontSize: 19, fontWeight: '600', letterSpacing: 0.15, marginBottom: 5 },
  offerSectionSub: { color: '#6D7480', fontSize: 12, fontWeight: '500', marginBottom: 12 },
  sectionSub: { color: '#6D7480', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  empty: { color: '#6D7480', fontSize: 15, textAlign: 'center', marginTop: 48, lineHeight: 22 },
  emptyWrap: { alignItems: 'center', paddingHorizontal: 12 },
  emptyLink: { color: MATCH_GOLD, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 10, lineHeight: 20, textDecorationLine: 'underline' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MATCH_BORDER,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#142033',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: MATCH_DIVIDER, marginBottom: 14 },
  candRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1e2a40' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },
  avatarPhTxt: { fontSize: 24 },
  candName: { color: '#142033', fontSize: 15, fontWeight: '700' },
  candMeta: { color: '#6D7480', fontSize: 12, fontWeight: '600', marginTop: 2 },
  candRole: { color: '#6D7480', fontSize: 12, fontWeight: '600', marginTop: 1 },
  hotelCol: { alignItems: 'center', maxWidth: 92 },
  hotelName: { color: MATCH_GOLD, fontSize: 8, fontWeight: '500', letterSpacing: 0.5, textAlign: 'center', marginTop: 4 },
  hotelStars: { color: MATCH_GOLD, fontSize: 8, letterSpacing: 0.8, marginTop: 2, opacity: 0.75 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  statusLbl: { color: '#9A9078', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  statusVal: { color: MATCH_GOLD, fontSize: 15, fontWeight: '400' },
  statusSub: { color: '#8E98A8', fontSize: 11, marginTop: 4, lineHeight: 15 },
  cdWrap: { alignItems: 'center', width: 84 },
  cdTime: { color: MATCH_GOLD, fontSize: 10, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  cdLbl: { color: '#6D7480', fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  ctaGold: {
    backgroundColor: '#142033',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGoldText: { color: '#F7F2E8', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  ctaGoldChev: { color: '#E4B35D', fontSize: 22, fontWeight: '600', position: 'absolute', right: 16 },
  ivCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MATCH_BORDER,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#142033',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ivTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  ivAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1e2a40' },
  ivMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 },
  ivMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ivMetaText: { color: '#3D4654', fontSize: 13, fontWeight: '600' },
  ivActRow: { flexDirection: 'row', alignItems: 'center' },
  ctaOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: MATCH_GOLD,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  ctaOutlineText: { color: MATCH_GOLD, fontSize: 13, fontWeight: '600' },
  concActRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  concReject: { flex: 1, borderWidth: 1, borderColor: '#5a6578', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  concRejectText: { color: '#C8D0DC', fontSize: 13, fontWeight: '700' },
  concOffer: { flex: 1, backgroundColor: MATCH_GOLD_BTN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  concOfferText: { color: '#2A2418', fontSize: 13, fontWeight: '700' },
});
