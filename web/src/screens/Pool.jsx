import { useEffect, useMemo, useState } from 'react';
import { categoryOf, listInterviewCandidates, offerCandidate, notifyOffer, listFormerStaff, listInTransit } from '../lib/api';
import { enrichProcessProgress } from '../lib/ops';
import { attachEmployers, groupByEmployer, withFormerEmployerFields } from '../lib/employerAttach';
import { useLang } from '../i18n.jsx';
import { candidateCode, NATION_CODE, maskedName } from '../../../lib/candidateCode';
import { formatLastSeen, lastSeenTier } from '../../../lib/lastSeenFormat';
import { POSITION_LABELS, POSITION_SECTOR_LABELS, LANG_LABELS, SKILL_LABELS, EMPLOYMENT_STATUS_LABELS, WORK_AVAILABILITY_LABELS } from '../../../i18n/optionLabels';
import { POSITIONS_BY_SECTOR, POSITION_SECTORS, LANGUAGES, SKILLS, EMPLOYMENT_STATUS, WORK_AVAILABILITY, normalizeWorkAvailability } from '../../../cv/options';
import { Icon } from '../components/Icon.jsx';
import Arrivals from './Arrivals.jsx';
import { listRatingStats } from '../lib/ratings';
import { listFavoriteCandidateIds, removeFavorite } from '../lib/favorites';
import AgencyNoticeModal from '../components/AgencyNoticeModal.jsx';
import { JOIN_PERIOD_MIN, slotMs } from '../lib/interviews';

const BADGE = { pool: 'gold', offered: 'navy', process: 'green', hired: 'teal', transit: 'navy' };
const BADGE_KEYS = { offered: 'agency_filter_offered', process: 'in_process_label', hired: 'nav_staff', transit: 'ops_transit' };
const TITLE_KEYS = { pool: 'nav_pool', process: 'nav_candidates', hired: 'nav_candidates' };
const PROCESS_SUBS = [
  { id: 'interviews', key: 'sub_interviews' },
  { id: 'concluded', key: 'sub_concluded' },
  { id: 'offered', key: 'sub_offered' },
  { id: 'inprocess', key: 'sub_inprocess' },
];
const TURN_KEYS = { agency: 'turn_agency', candidate: 'turn_candidate', shared: 'docs_waiting' };
const THIS_YEAR = new Date().getFullYear();
const ageOf = (r) => { const y = parseInt(r.data?.birthYear, 10); return y ? THIS_YEAR - y : null; };
const flagUrl = (nat) => { const cc = NATION_CODE[nat]; return cc && cc !== 'XX' ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : ''; };
const isConcludedIv = (c, now = Date.now()) => {
  if (c.ivStatus !== 'scheduled' || !c.ivSlot) return false;
  const mins = c.ivMinutes || JOIN_PERIOD_MIN;
  const extra = c.ivExtraSecs || 0;
  return (slotMs(c.ivSlot) + mins * 60 * 1000 + extra * 1000) < now;
};

function Facet({ title, items, selected, onToggle, max = 6 }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, max);
  return (
    <div className="facet">
      <button className={`facetHead ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}><span>{title}</span><span className={`caret ${open ? 'o' : ''}`}>▾</span></button>
      {open ? (
        <div className="facetBody">
          {shown.map((it) => (
            <label key={it.value} className={`check ${it.count === 0 ? 'dim' : ''}`}>
              <input type="checkbox" checked={selected.includes(it.value)} onChange={() => onToggle(it.value)} />
              <span className="checkbox"><Icon name="check" size={12} /></span>
              <span className="checkLbl">{it.label}</span>
              <span className="checkCount">{it.count}</span>
            </label>
          ))}
          {items.length > max ? <button className="moreBtn" onClick={() => setAll((v) => !v)}>{all ? 'Daha az' : `+${items.length - max} daha`}</button> : null}
        </div>
      ) : null}
    </div>
  );
}

/** 2 kademe: Çalışma Alanı → Turizm / Diğer → pozisyonlar */
function WorkAreaFacet({ groups, selected, onToggle, title }) {
  const [open, setOpen] = useState(false);
  const [secOpen, setSecOpen] = useState({}); // sector -> bool
  const [allSec, setAllSec] = useState({});
  const hasItems = groups.some((g) => g.items.length);
  if (!hasItems) return null;

  const selIn = (items) => items.reduce((n, it) => n + (selected.includes(it.value) ? 1 : 0), 0);

  return (
    <div className="facet">
      <button type="button" className={`facetHead ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className={`caret ${open ? 'o' : ''}`}>▾</span>
      </button>
      {open ? (
        <div className="facetBody workAreaBody">
          {groups.map((g) => {
            const max = g.sector === 'other' ? 3 : 6;
            const isSec = !!secOpen[g.sector];
            const showAll = !!allSec[g.sector];
            const shown = showAll ? g.items : g.items.slice(0, max);
            const picked = selIn(g.items);
            return (
              <div key={g.sector} className={`workAreaSector ${isSec ? 'open' : ''}`}>
                <button
                  type="button"
                  className={`workAreaSectorHead ${isSec ? 'on' : ''}`}
                  onClick={() => setSecOpen((m) => ({ ...m, [g.sector]: !m[g.sector] }))}
                >
                  <span>{g.title}{picked ? ` (${picked})` : ''}</span>
                  <span className={`caret ${isSec ? 'o' : ''}`}>▾</span>
                </button>
                {isSec ? (
                  <div className="workAreaSectorBody">
                    {shown.map((it) => (
                      <label key={it.value} className={`check ${it.count === 0 ? 'dim' : ''}`}>
                        <input type="checkbox" checked={selected.includes(it.value)} onChange={() => onToggle(it.value)} />
                        <span className="checkbox"><Icon name="check" size={12} /></span>
                        <span className="checkLbl">{it.label}</span>
                        <span className="checkCount">{it.count}</span>
                      </label>
                    ))}
                    {g.items.length > max ? (
                      <button
                        type="button"
                        className="moreBtn"
                        onClick={() => setAllSec((m) => ({ ...m, [g.sector]: !m[g.sector] }))}
                      >
                        {showAll ? 'Daha az' : `+${g.items.length - max} daha`}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Pool({ category, query, rows, onOpen, agencyId, onRefresh, processJump, onProcessJumpConsumed, hideStageTabs }) {
  const { t, lang } = useLang();
  const [fPos, setFPos] = useState([]);
  const [fLang, setFLang] = useState([]);
  const [fSkill, setFSkill] = useState([]);
  const [fNat, setFNat] = useState([]);
  const [fGender, setFGender] = useState([]);
  const [fEmployment, setFEmployment] = useState([]);
  const [fMonths, setFMonths] = useState([]);
  const [fCertified, setFCertified] = useState(false);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [sort, setSort] = useState('online'); // son çevrimiçi (yeniden eskiye)
  const [collapsed, setCollapsed] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);
  const [hiredView, setHiredView] = useState('cards'); // cards | transit | arrivals | former
  const [processSub, setProcessSub] = useState('interviews'); // interviews | concluded | offered | inprocess
  const [pipeStepFilter, setPipeStepFilter] = useState(null); // 1–6 | null
  const [ivRows, setIvRows] = useState([]);
  const [ivLoading, setIvLoading] = useState(false);
  const [processMeta, setProcessMeta] = useState({}); // user_id -> { pipeStep, turn, titleKey }
  const [formerRows, setFormerRows] = useState([]);
  const [formerLoading, setFormerLoading] = useState(false);
  const [transitRows, setTransitRows] = useState([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [ratingMap, setRatingMap] = useState({});
  const [favOn, setFavOn] = useState(false);
  const [favIds, setFavIds] = useState(null); // string[] | null — favori sırası
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [empSections, setEmpSections] = useState(null);

  useEffect(() => {
    if (!processJump) return;
    if (['interviews', 'concluded', 'offered', 'inprocess'].includes(processJump)) {
      setProcessSub(processJump);
      setPipeStepFilter(null);
    } else if (typeof processJump === 'string' && processJump.startsWith('pipe_')) {
      setProcessSub('inprocess');
      setPipeStepFilter(Number(processJump.slice(5)) || null);
    } else if (processJump === 'transit' || processJump === 'arrivals' || processJump === 'former') {
      setHiredView(processJump);
    } else if (processJump === 'staff' || processJump === 'cards') {
      setHiredView('cards');
    }
    onProcessJumpConsumed?.();
  }, [processJump, onProcessJumpConsumed]);

  const posLabel = (v) => (POSITION_LABELS[v]?.[lang] || POSITION_LABELS[v]?.en) || v;
  const langLabel = (v) => (LANG_LABELS[v]?.[lang] || LANG_LABELS[v]?.en) || v;
  const skillLabel = (v) => (SKILL_LABELS[v]?.[lang] || SKILL_LABELS[v]?.en) || v;
  const employLabel = (v) => (EMPLOYMENT_STATUS_LABELS[v]?.[lang] || EMPLOYMENT_STATUS_LABELS[v]?.en) || v;
  const employFilterLbl = (v) => t(`es_${v}`) || employLabel(v);
  const rowLangs = (r) => (r.data?.languages || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
  const workLabel = (v) => (WORK_AVAILABILITY_LABELS[v]?.[lang] || WORK_AVAILABILITY_LABELS[v]?.en) || v;
  const rowWorkAvail = (r) => normalizeWorkAvailability(r.work_availability ?? r.data?.availableMonths);

  // Süreç sekmesi: mülakat listesini yükle
  useEffect(() => {
    if (category !== 'process' || !agencyId) { setIvRows([]); return undefined; }
    let alive = true;
    setIvLoading(true);
    listInterviewCandidates(agencyId).then((list) => {
      if (!alive) return;
      const stBy = {};
      (rows || []).forEach((r) => { stBy[r.user_id] = r.st; });
      setIvRows(list.map((r) => ({ ...r, st: stBy[r.user_id] || null })));
      setIvLoading(false);
    });
    return () => { alive = false; };
  }, [category, agencyId, rows]);

  // Süreçtekiler: pipeline adımı + kimin sırası
  useEffect(() => {
    if (category !== 'process' || processSub !== 'inprocess' || !rows) {
      setProcessMeta({});
      return undefined;
    }
    let alive = true;
    const inProc = rows.filter((r) => categoryOf(r.st) === 'process');
    enrichProcessProgress(inProc).then((list) => {
      if (!alive) return;
      const m = {};
      list.forEach((r) => {
        m[r.user_id] = { pipeStep: r.pipeStep, turn: r.turn, titleKey: r.titleKey };
      });
      setProcessMeta(m);
    });
    return () => { alive = false; };
  }, [category, processSub, rows]);

  // Eski personel
  useEffect(() => {
    if (category !== 'hired' || hiredView !== 'former' || !agencyId) {
      setFormerRows([]);
      return undefined;
    }
    let alive = true;
    setFormerLoading(true);
    listFormerStaff(agencyId).then((list) => {
      if (!alive) return;
      setFormerRows((list || []).map((r) => ({
        user_id: r.candidate_id,
        title: r.title,
        data: r.data || { positions: r.job_position ? [r.job_position] : [] },
        reg_no: r.reg_no,
        nationality: r.nationality,
        last_seen_at: null,
        st: { status: 'hired' },
        former: true,
        formerMeta: r,
      })));
      setFormerLoading(false);
    }).catch(() => {
      if (alive) { setFormerRows([]); setFormerLoading(false); }
    });
    return () => { alive = false; };
  }, [category, hiredView, agencyId]);

  // Yolda / transit
  useEffect(() => {
    if (category !== 'hired' || hiredView !== 'transit' || !agencyId) {
      setTransitRows([]);
      return undefined;
    }
    let alive = true;
    setTransitLoading(true);
    listInTransit(agencyId).then((list) => {
      if (alive) { setTransitRows(list || []); setTransitLoading(false); }
    }).catch(() => {
      if (alive) { setTransitRows([]); setTransitLoading(false); }
    });
    return () => { alive = false; };
  }, [category, hiredView, agencyId]);

  const base = useMemo(() => {
    if (!rows) return [];
    const term = (query || '').trim().toLocaleLowerCase('tr');
    const matchTerm = (r) => {
      if (!term) return true;
      const code = candidateCode(r.nationality, r.reg_no) || '';
      const name = maskedName(r.data) || '';
      const full = [r.data?.firstName, r.data?.lastName, r.data?.passportFirstName, r.data?.passportLastName].filter(Boolean).join(' ');
      const pos = (r.data?.positions || []).map(posLabel).join(' ');
      return (`${code} ${name} ${full} ${pos} ${r.nationality || ''}`).toLocaleLowerCase('tr').includes(term);
    };

    if (category === 'hired') {
      if (hiredView === 'former') return formerRows.filter(matchTerm);
      if (hiredView === 'transit') return transitRows.filter(matchTerm);
      if (hiredView === 'arrivals') {
        const seen = new Set();
        const out = [];
        [...transitRows, ...rows.filter((r) => categoryOf(r.st) === 'hired')].forEach((r) => {
          if (seen.has(r.user_id) || !matchTerm(r)) return;
          seen.add(r.user_id);
          out.push({ ...r, arrivalStatus: categoryOf(r.st) === 'transit' ? 'transit' : 'hired' });
        });
        return out;
      }
      return rows.filter((r) => categoryOf(r.st) === 'hired' && matchTerm(r));
    }
    if (category === 'process') {
      if (processSub === 'inprocess') {
        return rows.filter((r) => {
          if (categoryOf(r.st) !== 'process' || !matchTerm(r)) return false;
          if (!pipeStepFilter) return true;
          const step = processMeta[r.user_id]?.pipeStep;
          if (pipeStepFilter === 6) return (step || 0) >= 6;
          return step === pipeStepFilter;
        });
      }
      if (processSub === 'offered') {
        return rows.filter((r) => categoryOf(r.st) === 'offered' && matchTerm(r));
      }
      const now = Date.now();
      return ivRows
        .filter((r) => (processSub === 'concluded' ? isConcludedIv(r, now) : !isConcludedIv(r, now)))
        .filter(matchTerm);
    }
    // Havuz: personel + yolda hariç
    return rows.filter((r) => {
      const c = categoryOf(r.st);
      return c !== 'hired' && c !== 'transit' && matchTerm(r);
    });
  }, [rows, query, category, lang, processSub, ivRows, hiredView, formerRows, transitRows, pipeStepFilter, processMeta]);

  const count = (pred) => base.reduce((n, r) => n + (pred(r) ? 1 : 0), 0);
  const byCount = (a, b) => b.count - a.count;
  const posFacetsBySector = useMemo(() => POSITION_SECTORS.map((sec) => ({
    sector: sec,
    title: (POSITION_SECTOR_LABELS[sec] && (POSITION_SECTOR_LABELS[sec][lang] || POSITION_SECTOR_LABELS[sec].en)) || sec,
    items: (POSITIONS_BY_SECTOR[sec] || [])
      .map((p) => ({ value: p, label: posLabel(p), count: count((r) => (r.data?.positions || []).includes(p)) }))
      .sort(byCount),
  })), [base, lang]);
  const langFacet = useMemo(() => LANGUAGES.map((l) => ({ value: l, label: langLabel(l), count: count((r) => rowLangs(r).includes(l)) })).sort(byCount), [base, lang]);
  const skillFacet = useMemo(() => SKILLS.map((s) => ({ value: s, label: skillLabel(s), count: count((r) => (r.data?.skills || []).includes(s)) })).sort(byCount), [base, lang]);
  const genderFacet = useMemo(() => ['male', 'female', 'unspecified'].map((g) => ({ value: g, label: t('gender_' + g) || g, count: count((r) => r.data?.gender === g) })), [base, lang]);
  const natFacet = useMemo(() => { const m = {}; base.forEach((r) => { if (r.nationality) m[r.nationality] = (m[r.nationality] || 0) + 1; }); return Object.keys(m).sort().map((n) => ({ value: n, label: n, count: m[n] })); }, [base]);
  const employFacet = useMemo(() => EMPLOYMENT_STATUS.map((e) => ({ value: e, label: employFilterLbl(e), count: count((r) => r.data?.employmentStatus === e) })), [base, lang]);
  const workFacet = useMemo(() => WORK_AVAILABILITY.map((v) => ({
    value: v,
    label: workLabel(v),
    count: count((r) => rowWorkAvail(r) === v),
  })), [base, lang]);
  const certFacet = useMemo(() => [{
    value: 'yes',
    label: t('f_turquz_certified') || 'Turquz sertifikalı',
    count: count((r) => !!r.turquz_certified),
  }], [base, lang, t]);

  useEffect(() => {
    if (!agencyId || !favOn) { setFavIds(null); return undefined; }
    let alive = true;
    setFavIds([]);
    listFavoriteCandidateIds(agencyId).then((ids) => {
      if (alive) setFavIds(ids);
    });
    return () => { alive = false; };
  }, [agencyId, favOn]);

  const list = useMemo(() => {
    const aMin = parseInt(ageMin, 10) || 0, aMax = parseInt(ageMax, 10) || 0;
    let out = base.filter((r) => {
      if (favIds) {
        if (!favIds.includes(r.user_id)) return false;
      }
      if (fPos.length && !fPos.some((p) => (r.data?.positions || []).includes(p))) return false;
      if (fLang.length && !fLang.every((l) => rowLangs(r).includes(l))) return false;
      if (fSkill.length && !fSkill.some((s) => (r.data?.skills || []).includes(s))) return false;
      if (fNat.length && !fNat.includes(r.nationality)) return false;
      if (fGender.length && !fGender.includes(r.data?.gender)) return false;
      if (fEmployment.length && !fEmployment.includes(r.data?.employmentStatus)) return false;
      if (fMonths.length && !fMonths.includes(rowWorkAvail(r))) return false;
      if (fCertified && !r.turquz_certified) return false;
      if (aMin || aMax) { const a = ageOf(r); if (a == null) return false; if (aMin && a < aMin) return false; if (aMax && a > aMax) return false; }
      return true;
    });
    if (category === 'process' && (processSub === 'interviews' || processSub === 'concluded')) {
      out = out.slice().sort((a, b) => {
        const da = a.ivSortDate || '';
        const db = b.ivSortDate || '';
        return da > db ? -1 : da < db ? 1 : 0;
      });
    } else if (favIds) {
      const order = new Map(favIds.map((id, i) => [id, i]));
      out = out.slice().sort((a, b) => (order.get(a.user_id) ?? 0) - (order.get(b.user_id) ?? 0));
    } else {
      out = out.slice().sort((a, b) => {
        const da = a.last_seen_at || '';
        const db = b.last_seen_at || '';
        if (!da && db) return 1;
        if (da && !db) return -1;
        if (!da && !db) return 0;
        const asc = sort === 'old';
        return asc ? (da < db ? -1 : 1) : (da > db ? -1 : 1);
      });
    }
    return out;
  }, [base, fPos, fLang, fSkill, fNat, fGender, fEmployment, fMonths, fCertified, ageMin, ageMax, sort, favIds, category, processSub]);

  useEffect(() => {
    const ids = list.map((r) => r.user_id);
    if (!ids.length) { setRatingMap({}); return undefined; }
    let alive = true;
    listRatingStats(ids).then((m) => { if (alive) setRatingMap(m); });
    return () => { alive = false; };
  }, [list]);

  const groupByEmp = category === 'process' || (category === 'hired' && hiredView !== 'arrivals');
  useEffect(() => {
    if (!groupByEmp || !agencyId) {
      setEmpSections(null);
      return undefined;
    }
    if (!list.length) {
      setEmpSections([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      let attached;
      if (category === 'hired' && hiredView === 'former') {
        attached = withFormerEmployerFields(list.map((r) => ({
          ...r,
          employer_title: r.formerMeta?.employer_title || r.employer_title,
          employer_id: r.formerMeta?.employer_id,
        })));
      } else {
        attached = await attachEmployers(agencyId, list);
      }
      if (alive) setEmpSections(groupByEmployer(attached, { noneLabel: t('employer_group_none') || 'İşletme atanmamış' }));
    })();
    return () => { alive = false; };
  }, [list, groupByEmp, agencyId, category, hiredView, t]);

  const toggle = (set) => (v) => set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const rmFrom = (set) => (v) => set((a) => a.filter((x) => x !== v));
  const activeCount = fPos.length + fLang.length + fSkill.length + fNat.length + fGender.length + fEmployment.length + fMonths.length + (fCertified ? 1 : 0) + (ageMin || ageMax ? 1 : 0);
  const clearAll = () => { setFPos([]); setFLang([]); setFSkill([]); setFNat([]); setFGender([]); setFEmployment([]); setFMonths([]); setFCertified(false); setAgeMin(''); setAgeMax(''); };

  const chips = [
    ...fPos.map((v) => ({ id: 'p' + v, label: posLabel(v), rm: () => rmFrom(setFPos)(v) })),
    ...fLang.map((v) => ({ id: 'l' + v, label: langLabel(v), rm: () => rmFrom(setFLang)(v) })),
    ...fSkill.map((v) => ({ id: 's' + v, label: skillLabel(v), rm: () => rmFrom(setFSkill)(v) })),
    ...fGender.map((v) => ({ id: 'g' + v, label: t('gender_' + v) || v, rm: () => rmFrom(setFGender)(v) })),
    ...fEmployment.map((v) => ({ id: 'e' + v, label: employFilterLbl(v), rm: () => rmFrom(setFEmployment)(v) })),
    ...fMonths.map((v) => ({ id: 'm' + v, label: workLabel(v), rm: () => rmFrom(setFMonths)(v) })),
    ...fNat.map((v) => ({ id: 'n' + v, label: v, rm: () => rmFrom(setFNat)(v) })),
    ...(fCertified ? [{ id: 'cert', label: t('f_turquz_certified') || '', rm: () => setFCertified(false) }] : []),
    ...((ageMin || ageMax) ? [{ id: 'age', label: t('agency_age_chip', { min: ageMin || '…', max: ageMax || '…' }) || `${t('agency_age') || ''} ${ageMin || '…'}–${ageMax || '…'}`, rm: () => { setAgeMin(''); setAgeMax(''); } }] : []),
  ];

  const showSort = !(category === 'hired' && hiredView === 'arrivals')
    && !(category === 'process' && (processSub === 'interviews' || processSub === 'concluded'));
  const showFav = category === 'pool';
  const canOfferSelect = category === 'pool';
  const canNoticeSelect =
    (category === 'process' && (processSub === 'offered' || processSub === 'inprocess'))
    || (category === 'hired' && (hiredView === 'cards' || hiredView === 'transit'));
  const canSelectMode = canOfferSelect || canNoticeSelect;
  const selectableIds = useMemo(() => {
    if (canNoticeSelect) return list.map((r) => r.user_id).filter(Boolean);
    if (canOfferSelect) return list.filter((r) => categoryOf(r.st) === 'pool').map((r) => r.user_id);
    return [];
  }, [list, canNoticeSelect, canOfferSelect]);

  useEffect(() => {
    if (!canSelectMode && selectMode) {
      setSelectMode(false);
      setSelectedIds([]);
    }
  }, [canSelectMode, selectMode]);

  useEffect(() => {
    setSelectMode(false);
    setSelectedIds([]);
    setNoticeOpen(false);
  }, [processSub, hiredView, category]);

  const exitSelect = () => { setSelectMode(false); setSelectedIds([]); setNoticeOpen(false); };
  const toggleSelect = (id) => {
    if (!selectableIds.includes(id)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectAllVisible = () => {
    if (!selectableIds.length) return;
    const allOn = selectableIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allOn ? [] : selectableIds.slice());
  };
  const bulkOffer = async () => {
    if (!selectedIds.length || bulkBusy) return;
    const msg = (t('agency_bulk_confirm', { n: selectedIds.length }) || `${selectedIds.length} adaya teklif gönderilecek. Onaylıyor musun?`);
    if (!window.confirm(msg)) return;
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        // eslint-disable-next-line no-await-in-loop
        await offerCandidate(id);
        notifyOffer(id, 'offer', agencyId);
      }
      await onRefresh?.();
      exitSelect();
    } catch (e) {
      window.alert(e?.message || t('err_generic') || '');
    } finally {
      setBulkBusy(false);
    }
  };

  if (rows == null) {
    return (
      <div className="ecBody">
        <aside className="ecSidebar"><div className="ecSideTop"><span className="ecSideTitle">{t('agency_filter_btn') || ''}</span></div></aside>
        <section className="ecResults">
          <div className="ecResultBar"><h1 className="ecTitle">{t('loading_label') || ''}</h1></div>
          <div className="ecGrid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="pcard skel"><div className="pcardImg skelBox" /><div className="pcardBody"><div className="skelLine w60" /><div className="skelLine w40" /></div></div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`ecBody ${collapsed ? 'collapsed' : ''}`}>
      {collapsed ? (
        <button className="filterReopen" onClick={() => setCollapsed(false)} title={t('agency_filters') || ''}>
          <Icon name="filter" size={16} /><span>{t('agency_filter_btn') || ''}{activeCount ? ` (${activeCount})` : ''}</span>
        </button>
      ) : (
      <aside className="ecSidebar">
        <div className="ecSideTop">
          <span className="ecSideTitle">{t('agency_filter_btn') || ''}</span>
          <div className="ecSideTopBtns">
            {activeCount ? <button className="clearF" onClick={clearAll}>{t('agency_clear') || ''} ({activeCount})</button> : null}
            <button className="collapseF" onClick={() => setCollapsed(true)} title={t('agency_filters') || ''}>«</button>
          </div>
        </div>

        <div className="facet">
          <button className={`facetHead ${ageOpen ? 'on' : ''}`} onClick={() => setAgeOpen((v) => !v)}><span>{t('agency_age') || ''}</span><span className={`caret ${ageOpen ? 'o' : ''}`}>▾</span></button>
          {ageOpen ? (
            <div className="facetBody ageBody">
              <input className="ageInput" inputMode="numeric" placeholder={t('agency_age_min') || 'Min'} value={ageMin} onChange={(e) => setAgeMin(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
              <span className="ageDash">–</span>
              <input className="ageInput" inputMode="numeric" placeholder={t('agency_age_max') || 'Max'} value={ageMax} onChange={(e) => setAgeMax(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
            </div>
          ) : null}
        </div>

        <Facet title={t('f_gender') || 'Cinsiyet'} items={genderFacet} selected={fGender} onToggle={toggle(setFGender)} max={3} />
        <Facet title={t('f_employment_status') || 'Çalışma Durumu'} items={employFacet} selected={fEmployment} onToggle={toggle(setFEmployment)} max={2} />
        <Facet
          title={t('f_turquz_certified') || 'Turquz sertifikalı'}
          items={certFacet}
          selected={fCertified ? ['yes'] : []}
          onToggle={() => setFCertified((v) => !v)}
          max={1}
        />
        <Facet title={t('f_work_duration') || 'Çalışma Süresi'} items={workFacet} selected={fMonths} onToggle={toggle(setFMonths)} max={2} />

        <WorkAreaFacet
          title={t('f_work_area') || 'Çalışma Alanı'}
          groups={posFacetsBySector}
          selected={fPos}
          onToggle={toggle(setFPos)}
        />

        <Facet title={t('step_languages') || 'Dil'} items={langFacet} selected={fLang} onToggle={toggle(setFLang)} />
        <Facet title={t('sec_skills') || 'Beceriler'} items={skillFacet} selected={fSkill} onToggle={toggle(setFSkill)} />
        <Facet title={t('f_nationality') || 'Uyruk'} items={natFacet} selected={fNat} onToggle={toggle(setFNat)} />
      </aside>
      )}

      <section className="ecResults">
        <div className="ecResultBar">
          <h1 className="ecTitle">{t(TITLE_KEYS[category]) || category}</h1>
          {!hideStageTabs && category === 'hired' ? (
            <div className="arrToggle">
              <button type="button" className={`arrTab ${hiredView === 'cards' ? 'on' : ''}`} onClick={() => setHiredView('cards')}>{t('staff_tab_list') || ''}</button>
              <button type="button" className={`arrTab ${hiredView === 'transit' ? 'on' : ''}`} onClick={() => setHiredView('transit')}>{t('ops_transit') || ''}</button>
              <button type="button" className={`arrTab ${hiredView === 'arrivals' ? 'on' : ''}`} onClick={() => setHiredView('arrivals')}>{t('staff_tab_arrivals') || ''}</button>
              <button type="button" className={`arrTab ${hiredView === 'former' ? 'on' : ''}`} onClick={() => setHiredView('former')}>{t('staff_tab_former') || ''}</button>
            </div>
          ) : null}
          {!hideStageTabs && category === 'process' ? (
            <div className="arrToggle processSubs">
              {PROCESS_SUBS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`arrTab ${processSub === s.id ? 'on' : ''}`}
                  onClick={() => { setProcessSub(s.id); setPipeStepFilter(null); }}
                >
                  {s.id === 'offered' ? (t(s.key) || 'Teklif bekleyen') : t(s.key)}
                </button>
              ))}
            </div>
          ) : null}
          {category === 'process' && processSub === 'inprocess' && pipeStepFilter ? (
            <div className="opsPipeFilter">
              <span>
                {t('ops_pipe_filter', {
                  x: t(
                    pipeStepFilter === 3 ? 'ops_funnel_ref'
                      : pipeStepFilter === 4 ? 'ops_funnel_permit'
                        : pipeStepFilter === 6 ? 'ops_funnel_transfer'
                          : `pipe_step_${pipeStepFilter}`,
                  ),
                })}
              </span>
              <button type="button" onClick={() => setPipeStepFilter(null)}>{t('ops_pipe_clear')}</button>
            </div>
          ) : null}
          <div className="ecResultMeta">
            <span className="ecCount">
              <b>{
                (category === 'process' && ivLoading && (processSub === 'interviews' || processSub === 'concluded'))
                || (category === 'hired' && hiredView === 'former' && formerLoading)
                || (category === 'hired' && hiredView === 'transit' && transitLoading)
                  ? '…'
                  : list.length
              }</b>
              {' '}
              {category === 'hired'
                ? (hiredView === 'former' ? (t('count_former') || '') : hiredView === 'transit' ? (t('count_transit') || '') : (t('count_staff') || ''))
                : (t('count_candidates') || '')}
            </span>
            {agencyId && showFav ? (
              <button
                type="button"
                className={`favFilterBtn ${favOn ? 'on' : ''}`}
                onClick={() => setFavOn((v) => !v)}
              >
                ★ {t('fav_filter_btn') || 'Favoriler'}
              </button>
            ) : null}
            {showSort ? (
              <div className="ecSortSeg" role="group" aria-label={t('sort_online_label') || 'Görünürlük'}>
                <button type="button" className={sort === 'online' ? 'on' : ''} onClick={() => setSort('online')}>
                  <span className="dot" />
                  {t('sort_newest') || 'Yeni → eski'}
                </button>
                <button type="button" className={sort === 'old' ? 'on' : ''} onClick={() => setSort('old')}>
                  {t('sort_oldest') || 'Eski → yeni'}
                </button>
              </div>
            ) : null}
            {canSelectMode ? (
              <button
                type="button"
                className={`selectModeBtn ${selectMode ? 'on' : ''}`}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              >
                {selectMode ? (t('agency_cancel') || 'İptal') : `☑ ${t('agency_select') || 'Seç'}`}
              </button>
            ) : null}
          </div>
          {selectMode && canSelectMode ? (
            <div className="selectToolbar">
              <button type="button" className="selectAllBtn" onClick={selectAllVisible}>
                ☑ {t('agency_select_all') || 'Tümünü Seç'}
              </button>
              <span className="selectCount">{t('agency_selected', { n: selectedIds.length }) || `${selectedIds.length} seçili`}</span>
            </div>
          ) : null}
          {chips.length ? (
            <div className="appliedChips">
              {chips.map((ch) => (
                <button key={ch.id} className="aChip" onClick={ch.rm}>{ch.label} <span className="aChipX">✕</span></button>
              ))}
              <button className="aClear" onClick={clearAll}>{t('agency_clear_all') || ''}</button>
            </div>
          ) : null}
        </div>

        {category === 'hired' && hiredView === 'arrivals' ? (
          <Arrivals candidates={list} />
        ) : (
        <>
        {list.length === 0 ? (
          <div className="empty">
            {favOn
              ? (t('fav_empty') || 'Bu işletme için henüz favori aday yok.')
              : category === 'process' && processSub === 'interviews'
                ? (t('interviews_empty') || 'Mülakat teklif edilen aday yok.')
                : category === 'process' && processSub === 'concluded'
                  ? (t('concluded_empty') || 'Sonuçlanan mülakat yok.')
                  : category === 'process' && processSub === 'offered'
                ? (t('offered_empty') || 'Yanıt bekleyen teklif yok.')
              : category === 'process' && processSub === 'inprocess'
                    ? (t('inprocess_empty') || 'Süreçte aday yok.')
                    : category === 'hired' && hiredView === 'former'
                      ? (t('staff_former_empty') || t('former_empty') || '')
                    : category === 'hired' && hiredView === 'transit'
                      ? (t('transit_empty') || '')
                    : (t('candidates_empty') || t('agency_empty') || '')}
          </div>
        ) : null}

        <div className="empGroups">
          {(groupByEmp && empSections
            ? empSections
            : [{ key: 'all', title: null, data: list }]
          ).map((sec) => (
            <div key={sec.key} className="empGroup">
              {sec.title ? (
                <div className="empGroupHead">
                  <strong>{sec.title}</strong>
                  <span>{sec.data.length}</span>
                </div>
              ) : null}
              <div className={`ecGrid ${collapsed ? 'wide' : ''}`}>
                {sec.data.map((r) => {
            const c = categoryOf(r.st);
            const code = candidateCode(r.nationality, r.reg_no);
            const photo = r.data?.photoClose || r.data?.photo || r.data?.photoFull;
            const allPos = r.data?.positions || [];
            const positions = allPos.slice(0, 1);
            const extra = allPos.length - positions.length;
            const age = ageOf(r);
            const flag = flagUrl(r.nationality);
            const showUnfav = favOn && !selectMode;
            const canSelect = canNoticeSelect || c === 'pool';
            const isSel = selectedIds.includes(r.user_id);
            const onUnfav = async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!agencyId || !favOn) return;
              try {
                await removeFavorite(agencyId, r.user_id);
                setFavIds((prev) => (prev || []).filter((id) => id !== r.user_id));
              } catch (err) {
                console.warn('unfav:', err?.message);
              }
            };
            const onCard = () => {
              if (selectMode) {
                if (canSelect) toggleSelect(r.user_id);
                return;
              }
              onOpen({ c: r, st: r.st });
            };
            return (
              <div
                key={r.user_id}
                className={`pcard ${selectMode && isSel ? 'selected' : ''} ${selectMode && !canSelect ? 'dimSelect' : ''}`}
                role="button"
                tabIndex={0}
                onClick={onCard}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCard(); } }}
              >
                <div className="pcardImg">
                  {photo ? <img src={photo} alt="" /> : <div className="pcardNoImg"><Icon name="users" size={34} /></div>}
                  {c !== 'pool' ? (
                    <span className={`badge ${BADGE[c]} pcardBadge`}>{t(BADGE_KEYS[c]) || c}</span>
                  ) : null}
                  {selectMode ? (
                    <span className={`pcardCheck ${isSel ? 'on' : ''} ${!canSelect ? 'disabled' : ''}`} aria-hidden>
                      {isSel ? '✓' : ''}
                    </span>
                  ) : null}
                  {ratingMap[r.user_id] ? (
                    <div className={`pcardRate ${showUnfav || selectMode ? 'withUnfav' : ''}`} title={t('rate_n_count', { n: ratingMap[r.user_id].count }) || String(ratingMap[r.user_id].count)}>
                      <span className="pcardRateStar">★</span>
                      <span className="pcardRateAvg">{Number(ratingMap[r.user_id].avg).toFixed(1)}</span>
                      <span className="pcardRateCount">({ratingMap[r.user_id].count})</span>
                    </div>
                  ) : null}
                  {showUnfav ? (
                    <button
                      type="button"
                      className="pcardUnfav"
                      title={t('fav_remove') || ''}
                      aria-label={t('fav_remove') || ''}
                      onClick={onUnfav}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <div className="pcardBody">
                  <div className="pcardCode">{code}</div>
                  {r.employerLabel ? <div className="pcardEmp">{r.employerLabel}</div> : null}
                  <div className="pcardNat">
                    {flag ? <img className="flag" src={flag} alt="" /> : null}
                    <span>{r.nationality || '—'}{age ? ` · ${t('age_n', { n: age }) || age}` : ''}</span>
                  </div>
                  {category === 'process' && processSub === 'inprocess' && processMeta[r.user_id] ? (
                    <div className={`pcardPipe turn-${processMeta[r.user_id].turn || 'none'}`}>
                      <span className="pcardPipeStep">
                        {processMeta[r.user_id].titleKey
                          ? (t(processMeta[r.user_id].titleKey) || t('step_n', { n: processMeta[r.user_id].pipeStep }) || '')
                          : (t('step_n', { n: processMeta[r.user_id].pipeStep }) || '')}
                      </span>
                      <span className="pcardPipeTurn">
                        {TURN_KEYS[processMeta[r.user_id].turn]
                          ? (t(TURN_KEYS[processMeta[r.user_id].turn]) || '')
                          : ''}
                      </span>
                    </div>
                  ) : null}
                  {category === 'process' && processSub === 'offered' ? (
                    <div className="pcardPipe turn-candidate">
                      <span className="pcardPipeTurn">{t('offer_awaiting_reply') || ''}</span>
                    </div>
                  ) : null}
                  {category === 'hired' && hiredView === 'transit' ? (
                    <div className="pcardPipe turn-agency">
                      <span className="pcardPipeStep">
                        {r.work_start_at
                          ? (t('ops_start_on', { date: String(r.work_start_at).slice(0, 10) }) || String(r.work_start_at).slice(0, 10))
                          : (t('work_start_none') || '')}
                      </span>
                      <span className="pcardPipeTurn">{t('staff_confirm_waiting') || ''}</span>
                    </div>
                  ) : null}
                  {r.former && r.formerMeta?.outcome ? (
                    <div className={`pcardPipe ${r.formerMeta.needs_rating ? 'turn-agency' : 'turn-none'}`}>
                      <span className="pcardPipeTurn">
                        {r.formerMeta.outcome === 'completed' ? (t('staff_outcome_completed') || 'Tamamladı') : (t('staff_outcome_early') || r.formerMeta.outcome)}
                        {r.formerMeta.needs_rating ? ` · ★ ${t('rate_required_badge') || 'Puan gerekli'}` : ''}
                      </span>
                    </div>
                  ) : null}
                  <div className={`pcardOnline tier-${lastSeenTier(r.last_seen_at)}`} title={r.last_seen_at || ''}>
                    <span className="onlineDot" />
                    <span className="pcardOnlineWhen">{formatLastSeen(r.last_seen_at, t)}</span>
                  </div>
                  <div className="pcardChips">
                    {positions.length ? positions.map((p, i) => <span key={i} className="pchip" title={posLabel(p)}>{posLabel(p)}</span>) : <span className="pchip ghost">—</span>}
                    {extra > 0 ? <span className="pchip more">+{extra}</span> : null}
                  </div>
                </div>
              </div>
            );
                })}
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </section>

      {selectMode && canSelectMode ? (
        <div className="bulkBar">
          <span className="bulkText">{t('agency_selected', { n: selectedIds.length }) || `${selectedIds.length} seçili`}</span>
          <div className="bulkActions">
            <button type="button" className="bulkCancel" onClick={exitSelect} disabled={bulkBusy}>
              {t('agency_cancel') || 'İptal'}
            </button>
            {canNoticeSelect ? (
              <button
                type="button"
                className="bulkOffer"
                onClick={() => selectedIds.length && setNoticeOpen(true)}
                disabled={!selectedIds.length}
              >
                {t('agency_notice')}
              </button>
            ) : (
              <button
                type="button"
                className="bulkOffer"
                onClick={bulkOffer}
                disabled={bulkBusy || !selectedIds.length}
              >
                {bulkBusy ? '…' : (t('agency_offer') || 'Teklif Gönder')}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <AgencyNoticeModal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={selectedIds}
        targetKind="selected"
      />
    </div>
  );
}
