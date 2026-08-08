import { useEffect, useMemo, useState } from 'react';
import { categoryOf, listInterviewCandidates, offerCandidate, notifyOffer } from '../lib/api';
import { useLang } from '../i18n.jsx';
import { candidateCode, NATION_CODE } from '../../../lib/candidateCode';
import { formatLastSeen, lastSeenTier } from '../../../lib/lastSeenFormat';
import { POSITION_LABELS, POSITION_SECTOR_LABELS, LANG_LABELS, SKILL_LABELS, EMPLOYMENT_STATUS_LABELS, WORK_AVAILABILITY_LABELS } from '../../../i18n/optionLabels';
import { POSITIONS_BY_SECTOR, POSITION_SECTORS, LANGUAGES, SKILLS, EMPLOYMENT_STATUS, WORK_AVAILABILITY, normalizeWorkAvailability } from '../../../cv/options';
import { Icon } from '../components/Icon.jsx';
import Arrivals from './Arrivals.jsx';
import { listRatingStats } from '../lib/ratings';
import { listFavoriteCandidateIds, removeFavorite } from '../lib/favorites';
import FavoriteEmployerModal from '../components/FavoriteEmployerModal.jsx';
import { JOIN_PERIOD_MIN, slotMs } from '../lib/interviews';

const BADGE = { pool: 'gold', offered: 'navy', process: 'green', hired: 'teal' };
const BADGE_TXT = { offered: 'Teklifli', process: 'Süreçte', hired: 'Personel' };
const TITLES = { pool: 'Havuz', process: 'Süreç', hired: 'Personel' };
const PROCESS_SUBS = [
  { id: 'interviews', key: 'sub_interviews' },
  { id: 'concluded', key: 'sub_concluded' },
  { id: 'inprocess', key: 'sub_inprocess' },
];
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

export default function Pool({ category, query, rows, onOpen, agencyId, onRefresh }) {
  const { t, lang } = useLang();
  const [fPos, setFPos] = useState([]);
  const [fLang, setFLang] = useState([]);
  const [fSkill, setFSkill] = useState([]);
  const [fNat, setFNat] = useState([]);
  const [fGender, setFGender] = useState([]);
  const [fEmployment, setFEmployment] = useState([]);
  const [fMonths, setFMonths] = useState([]);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [sort, setSort] = useState('online'); // son çevrimiçi (yeniden eskiye)
  const [collapsed, setCollapsed] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);
  const [hiredView, setHiredView] = useState('cards'); // personeller: 'cards' | 'arrivals'
  const [processSub, setProcessSub] = useState('interviews'); // interviews | concluded | inprocess
  const [ivRows, setIvRows] = useState([]);
  const [ivLoading, setIvLoading] = useState(false);
  const [ratingMap, setRatingMap] = useState({});
  const [favEmployer, setFavEmployer] = useState(null); // { id, name }
  const [favIds, setFavIds] = useState(null); // string[] | null — shortlist sırası
  const [favFilterOpen, setFavFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const posLabel = (v) => (POSITION_LABELS[v]?.[lang] || POSITION_LABELS[v]?.en) || v;
  const langLabel = (v) => (LANG_LABELS[v]?.[lang] || LANG_LABELS[v]?.en) || v;
  const skillLabel = (v) => (SKILL_LABELS[v]?.[lang] || SKILL_LABELS[v]?.en) || v;
  const employFilterLabel = { student: { tr: 'Öğrenci', en: 'Student', ru: 'Студент' }, employed: { tr: 'Çalışan', en: 'Employed', ru: 'Работающий' } };
  const employLabel = (v) => (EMPLOYMENT_STATUS_LABELS[v]?.[lang] || EMPLOYMENT_STATUS_LABELS[v]?.en) || v;
  const employFilterLbl = (v) => (employFilterLabel[v]?.[lang] || employFilterLabel[v]?.tr) || employLabel(v);
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

  const base = useMemo(() => {
    if (!rows) return [];
    const term = (query || '').trim().toLocaleLowerCase('tr');
    const matchTerm = (r) => {
      if (!term) return true;
      const code = candidateCode(r.nationality, r.reg_no) || '';
      const pos = (r.data?.positions || []).map(posLabel).join(' ');
      return (`${code} ${pos} ${r.nationality || ''}`).toLocaleLowerCase('tr').includes(term);
    };

    if (category === 'hired') {
      return rows.filter((r) => categoryOf(r.st) === 'hired' && matchTerm(r));
    }
    if (category === 'process') {
      if (processSub === 'inprocess') {
        return rows.filter((r) => categoryOf(r.st) === 'process' && matchTerm(r));
      }
      const now = Date.now();
      return ivRows
        .filter((r) => (processSub === 'concluded' ? isConcludedIv(r, now) : !isConcludedIv(r, now)))
        .filter(matchTerm);
    }
    // Havuz: personel hariç
    return rows.filter((r) => categoryOf(r.st) !== 'hired' && matchTerm(r));
  }, [rows, query, category, lang, processSub, ivRows]);

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

  useEffect(() => {
    if (!agencyId || !favEmployer?.id) { setFavIds(null); return undefined; }
    let alive = true;
    listFavoriteCandidateIds(agencyId, favEmployer.id).then((ids) => {
      if (alive) setFavIds(ids);
    });
    return () => { alive = false; };
  }, [agencyId, favEmployer?.id]);

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
  }, [base, fPos, fLang, fSkill, fNat, fGender, fEmployment, fMonths, ageMin, ageMax, sort, favIds, category, processSub]);

  useEffect(() => {
    const ids = list.map((r) => r.user_id);
    if (!ids.length) { setRatingMap({}); return undefined; }
    let alive = true;
    listRatingStats(ids).then((m) => { if (alive) setRatingMap(m); });
    return () => { alive = false; };
  }, [list]);

  const toggle = (set) => (v) => set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const rmFrom = (set) => (v) => set((a) => a.filter((x) => x !== v));
  const activeCount = fPos.length + fLang.length + fSkill.length + fNat.length + fGender.length + fEmployment.length + fMonths.length + (ageMin || ageMax ? 1 : 0);
  const clearAll = () => { setFPos([]); setFLang([]); setFSkill([]); setFNat([]); setFGender([]); setFEmployment([]); setFMonths([]); setAgeMin(''); setAgeMax(''); };

  const chips = [
    ...fPos.map((v) => ({ id: 'p' + v, label: posLabel(v), rm: () => rmFrom(setFPos)(v) })),
    ...fLang.map((v) => ({ id: 'l' + v, label: langLabel(v), rm: () => rmFrom(setFLang)(v) })),
    ...fSkill.map((v) => ({ id: 's' + v, label: skillLabel(v), rm: () => rmFrom(setFSkill)(v) })),
    ...fGender.map((v) => ({ id: 'g' + v, label: t('gender_' + v) || v, rm: () => rmFrom(setFGender)(v) })),
    ...fEmployment.map((v) => ({ id: 'e' + v, label: employFilterLbl(v), rm: () => rmFrom(setFEmployment)(v) })),
    ...fMonths.map((v) => ({ id: 'm' + v, label: workLabel(v), rm: () => rmFrom(setFMonths)(v) })),
    ...fNat.map((v) => ({ id: 'n' + v, label: v, rm: () => rmFrom(setFNat)(v) })),
    ...((ageMin || ageMax) ? [{ id: 'age', label: `Yaş ${ageMin || '…'}–${ageMax || '…'}`, rm: () => { setAgeMin(''); setAgeMax(''); } }] : []),
  ];

  const showSort = !(category === 'hired' && hiredView === 'arrivals')
    && !(category === 'process' && (processSub === 'interviews' || processSub === 'concluded'));
  const showFav = category === 'pool';
  const canBulkSelect = category === 'pool';
  const selectableIds = useMemo(
    () => list.filter((r) => categoryOf(r.st) === 'pool').map((r) => r.user_id),
    [list],
  );

  useEffect(() => {
    if (!canBulkSelect && selectMode) {
      setSelectMode(false);
      setSelectedIds([]);
    }
  }, [canBulkSelect, selectMode]);

  const exitSelect = () => { setSelectMode(false); setSelectedIds([]); };
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
      window.alert(e?.message || (t('agency_offer') || 'Teklif') + ' hatası');
    } finally {
      setBulkBusy(false);
    }
  };

  if (rows == null) {
    return (
      <div className="ecBody">
        <aside className="ecSidebar"><div className="ecSideTop"><span className="ecSideTitle">Filtrele</span></div></aside>
        <section className="ecResults">
          <div className="ecResultBar"><h1 className="ecTitle">Yükleniyor…</h1></div>
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
        <button className="filterReopen" onClick={() => setCollapsed(false)} title="Filtreleri aç">
          <Icon name="filter" size={16} /><span>Filtrele{activeCount ? ` (${activeCount})` : ''}</span>
        </button>
      ) : (
      <aside className="ecSidebar">
        <div className="ecSideTop">
          <span className="ecSideTitle">Filtrele</span>
          <div className="ecSideTopBtns">
            {activeCount ? <button className="clearF" onClick={clearAll}>Temizle ({activeCount})</button> : null}
            <button className="collapseF" onClick={() => setCollapsed(true)} title="Filtreleri kapat">«</button>
          </div>
        </div>

        <div className="facet">
          <button className={`facetHead ${ageOpen ? 'on' : ''}`} onClick={() => setAgeOpen((v) => !v)}><span>Yaş</span><span className={`caret ${ageOpen ? 'o' : ''}`}>▾</span></button>
          {ageOpen ? (
            <div className="facetBody ageBody">
              <input className="ageInput" inputMode="numeric" placeholder="Min" value={ageMin} onChange={(e) => setAgeMin(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
              <span className="ageDash">–</span>
              <input className="ageInput" inputMode="numeric" placeholder="Maks" value={ageMax} onChange={(e) => setAgeMax(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
            </div>
          ) : null}
        </div>

        <Facet title={t('f_gender') || 'Cinsiyet'} items={genderFacet} selected={fGender} onToggle={toggle(setFGender)} max={3} />
        <Facet title={t('f_employment_status') || 'Çalışma Durumu'} items={employFacet} selected={fEmployment} onToggle={toggle(setFEmployment)} max={2} />
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
          <h1 className="ecTitle">{TITLES[category] || 'Adaylar'}</h1>
          {category === 'hired' ? (
            <div className="arrToggle">
              <button className={`arrTab ${hiredView === 'cards' ? 'on' : ''}`} onClick={() => setHiredView('cards')}>Personeller</button>
              <button className={`arrTab ${hiredView === 'arrivals' ? 'on' : ''}`} onClick={() => setHiredView('arrivals')}>🛬 Varışlar</button>
            </div>
          ) : null}
          {category === 'process' ? (
            <div className="arrToggle processSubs">
              {PROCESS_SUBS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`arrTab ${processSub === s.id ? 'on' : ''}`}
                  onClick={() => setProcessSub(s.id)}
                >
                  {t(s.key)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="ecResultMeta">
            <span className="ecCount">
              <b>{category === 'process' && ivLoading && processSub !== 'inprocess' ? '…' : list.length}</b>
              {' '}
              {category === 'hired' ? 'personel' : 'aday'}
            </span>
            {agencyId && showFav ? (
              <button
                type="button"
                className={`favFilterBtn ${favEmployer ? 'on' : ''}`}
                onClick={() => setFavFilterOpen(true)}
              >
                ★ {favEmployer ? favEmployer.name : (t('fav_filter_btn') || 'Favoriler')}
                {favEmployer ? (
                  <span
                    className="x"
                    onClick={(e) => { e.stopPropagation(); setFavEmployer(null); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setFavEmployer(null); } }}
                  >✕</span>
                ) : null}
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
            {canBulkSelect ? (
              <button
                type="button"
                className={`selectModeBtn ${selectMode ? 'on' : ''}`}
                onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              >
                {selectMode ? (t('agency_cancel') || 'İptal') : `☑ ${t('agency_select') || 'Seç'}`}
              </button>
            ) : null}
          </div>
          {selectMode && canBulkSelect ? (
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
              <button className="aClear" onClick={clearAll}>Tümünü temizle</button>
            </div>
          ) : null}
        </div>

        {category === 'hired' && hiredView === 'arrivals' ? (
          <Arrivals candidates={list} />
        ) : (
        <>
        {list.length === 0 ? (
          <div className="empty">
            {favEmployer
              ? (t('fav_empty') || 'Bu işletme için henüz favori aday yok.')
              : category === 'process' && processSub === 'interviews'
                ? (t('interviews_empty') || 'Mülakat teklif edilen aday yok.')
                : category === 'process' && processSub === 'concluded'
                  ? (t('concluded_empty') || 'Sonuçlanan mülakat yok.')
                  : category === 'process' && processSub === 'inprocess'
                    ? (t('inprocess_empty') || 'Süreçte aday yok.')
                    : 'Bu görünümde aday yok.'}
          </div>
        ) : null}

        <div className={`ecGrid ${collapsed ? 'wide' : ''}`}>
          {list.map((r) => {
            const c = categoryOf(r.st);
            const code = candidateCode(r.nationality, r.reg_no);
            const photo = r.data?.photoClose || r.data?.photo || r.data?.photoFull;
            const allPos = r.data?.positions || [];
            const positions = allPos.slice(0, 1);
            const extra = allPos.length - positions.length;
            const age = ageOf(r);
            const flag = flagUrl(r.nationality);
            const showUnfav = !!favEmployer?.id && !selectMode;
            const canSelect = c === 'pool';
            const isSel = selectedIds.includes(r.user_id);
            const onUnfav = async (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!agencyId || !favEmployer?.id) return;
              try {
                await removeFavorite(agencyId, favEmployer.id, r.user_id);
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
                    <span className={`badge ${BADGE[c]} pcardBadge`}>{BADGE_TXT[c]}</span>
                  ) : null}
                  {selectMode ? (
                    <span className={`pcardCheck ${isSel ? 'on' : ''} ${!canSelect ? 'disabled' : ''}`} aria-hidden>
                      {isSel ? '✓' : ''}
                    </span>
                  ) : null}
                  {ratingMap[r.user_id] ? (
                    <div className={`pcardRate ${showUnfav || selectMode ? 'withUnfav' : ''}`} title={`${ratingMap[r.user_id].count} değerlendirme`}>
                      <span className="pcardRateStar">★</span>
                      <span className="pcardRateAvg">{Number(ratingMap[r.user_id].avg).toFixed(1)}</span>
                      <span className="pcardRateCount">({ratingMap[r.user_id].count})</span>
                    </div>
                  ) : null}
                  {showUnfav ? (
                    <button
                      type="button"
                      className="pcardUnfav"
                      title={t('fav_remove') || 'Favorilerden çıkar'}
                      aria-label={t('fav_remove') || 'Favorilerden çıkar'}
                      onClick={onUnfav}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <div className="pcardBody">
                  <div className="pcardCode">{code}</div>
                  <div className="pcardNat">
                    {flag ? <img className="flag" src={flag} alt="" /> : null}
                    <span>{r.nationality || '—'}{age ? ` · ${age} yaş` : ''}</span>
                  </div>
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
        </>
        )}
      </section>

      {selectMode && canBulkSelect ? (
        <div className="bulkBar">
          <span className="bulkText">{t('agency_selected', { n: selectedIds.length }) || `${selectedIds.length} seçili`}</span>
          <div className="bulkActions">
            <button type="button" className="bulkCancel" onClick={exitSelect} disabled={bulkBusy}>
              {t('agency_cancel') || 'İptal'}
            </button>
            <button
              type="button"
              className="bulkOffer"
              onClick={bulkOffer}
              disabled={bulkBusy || !selectedIds.length}
            >
              {bulkBusy ? '…' : (t('agency_offer') || 'Teklif Gönder')}
            </button>
          </div>
        </div>
      ) : null}

      <FavoriteEmployerModal
        open={favFilterOpen}
        mode="filter"
        agencyId={agencyId}
        selectedEmployerId={favEmployer?.id || null}
        onPickEmployer={(emp) => setFavEmployer({ id: emp.id, name: emp.name })}
        onClearFilter={() => setFavEmployer(null)}
        onClose={() => setFavFilterOpen(false)}
      />
    </div>
  );
}
