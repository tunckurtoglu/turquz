import { useEffect, useMemo, useState } from 'react';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import {
  categoryOf, deleteUserFully, getCandidate, listCandidates, signedUrl,
  listCandidateRatings, adminSaveRating, adminDeleteRating,
} from '../lib/api';
import { candidateCode } from '../../../lib/candidateCode';
import { buildCvHtml } from '../../../cv/buildCvHtml';
import {
  POSITIONS_BY_SECTOR, POSITION_SECTORS, LANGUAGES, SKILLS, EMPLOYMENT_STATUS, WORK_AVAILABILITY, normalizeWorkAvailability,
} from '../../../cv/options';
import {
  POSITION_LABELS, POSITION_SECTOR_LABELS, LANG_LABELS, SKILL_LABELS, EMPLOYMENT_STATUS_LABELS, WORK_AVAILABILITY_LABELS,
} from '../../../i18n/optionLabels';

const LANG = 'tr';
const THIS_YEAR = new Date().getFullYear();
const CATS = [
  { id: 'all', label: 'Tümü' },
  { id: 'pool', label: 'Havuz' },
  { id: 'offered', label: 'Teklifli' },
  { id: 'process', label: 'Süreçte' },
  { id: 'hired', label: 'Personel' },
];
const GENDER_LBL = { male: 'Erkek', female: 'Kadın', unspecified: 'Belirtilmemiş' };

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function labelOf(dict, v) {
  return (dict[v]?.[LANG] || dict[v]?.en) || v;
}

function ageOf(r) {
  const y = parseInt(r.birth_year, 10);
  return y ? THIS_YEAR - y : null;
}

function rowLangs(r) {
  return (r.languages || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
}

function rowWork(r) {
  return normalizeWorkAvailability(r.work_availability);
}

function rowSt(r) {
  return { status: r.status, docs_unlocked: r.docs_unlocked, stage: r.stage };
}

function agencyLabel(r) {
  if (!r) return '';
  return r.agency_company || r.agency_contact || r.agency_email || '';
}

function statusLabel(r) {
  const c = categoryOf(rowSt(r));
  const map = { pool: 'Havuz', offered: 'Teklifli', process: 'Süreçte', hired: 'Personel' };
  return map[c] || r.status || '—';
}

function Facet({ title, items, selected, onToggle, max = 6 }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, max);
  return (
    <div className="facet">
      <button type="button" className={`facetHead ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span><span className={`caret ${open ? 'o' : ''}`}>▾</span>
      </button>
      {open ? (
        <div className="facetBody">
          {shown.map((it) => (
            <label key={it.value} className={`check ${it.count === 0 ? 'dim' : ''}`}>
              <input type="checkbox" checked={selected.includes(it.value)} onChange={() => onToggle(it.value)} />
              <span className="checkbox">✓</span>
              <span className="checkLbl">{it.label}</span>
              <span className="checkCount">{it.count}</span>
            </label>
          ))}
          {items.length > max ? (
            <button type="button" className="moreBtn" onClick={() => setAll((v) => !v)}>
              {all ? 'Daha az' : `+${items.length - max} daha`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Candidates({ selectedId, onSelect }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cvZoom, setCvZoom] = useState(0.58);
  const [ratings, setRatings] = useState([]);
  const [ratingEdits, setRatingEdits] = useState({}); // agency_id -> { discipline, communication, rehire }
  const [ratingBusy, setRatingBusy] = useState(null); // agency_id | 'load'

  const [fPos, setFPos] = useState([]);
  const [fLang, setFLang] = useState([]);
  const [fSkill, setFSkill] = useState([]);
  const [fNat, setFNat] = useState([]);
  const [fGender, setFGender] = useState([]);
  const [fEmployment, setFEmployment] = useState([]);
  const [fMonths, setFMonths] = useState([]);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [sort, setSort] = useState('new');
  const [collapsed, setCollapsed] = useState(false);
  const [ageOpen, setAgeOpen] = useState(false);

  const load = () => {
    setErr('');
    listCandidates().then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  };

  useEffect(() => { load(); }, []);

  const loadRatings = async (candidateId) => {
    if (!candidateId) { setRatings([]); setRatingEdits({}); return; }
    setRatingBusy('load');
    try {
      const rows = await listCandidateRatings(candidateId);
      setRatings(rows);
      const edits = {};
      rows.forEach((r) => {
        edits[r.agency_id] = {
          discipline: r.discipline,
          communication: r.communication,
          rehire: r.rehire,
        };
      });
      setRatingEdits(edits);
    } catch (e) {
      setErr(e?.message || 'Puanlar yüklenemedi');
      setRatings([]);
    } finally {
      setRatingBusy(null);
    }
  };

  useEffect(() => {
    if (!selectedId) { setDetail(null); setRatings([]); setRatingEdits({}); return; }
    let alive = true;
    setCvZoom(0.58);
    getCandidate(selectedId).then((d) => { if (alive) setDetail(d); })
      .catch((e) => setErr(e.message));
    loadRatings(selectedId);
    return () => { alive = false; };
  }, [selectedId]);

  const base = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLocaleLowerCase('tr');
    return rows.filter((r) => {
      const c = categoryOf(rowSt(r));
      if (cat !== 'all' && c !== cat) return false;
      if (term) {
        const code = candidateCode(r.nationality, r.reg_no) || '';
        const pos = (r.positions || []).map((p) => labelOf(POSITION_LABELS, p)).join(' ');
        const blob = `${code} ${pos} ${r.nationality || ''} ${r.full_name || ''} ${r.email || ''} ${r.title || ''} ${r.reg_no || ''}`;
        if (!blob.toLocaleLowerCase('tr').includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, cat]);

  const count = (pred) => base.reduce((n, r) => n + (pred(r) ? 1 : 0), 0);
  const byCount = (a, b) => b.count - a.count;

  const posFacetsBySector = useMemo(
    () => POSITION_SECTORS.map((sec) => ({
      sector: sec,
      title: labelOf(POSITION_SECTOR_LABELS, sec),
      items: (POSITIONS_BY_SECTOR[sec] || [])
        .map((p) => ({ value: p, label: labelOf(POSITION_LABELS, p), count: count((r) => (r.positions || []).includes(p)) }))
        .sort(byCount),
    })),
    [base],
  );
  const langFacet = useMemo(
    () => LANGUAGES.map((l) => ({ value: l, label: labelOf(LANG_LABELS, l), count: count((r) => rowLangs(r).includes(l)) })).sort(byCount),
    [base],
  );
  const skillFacet = useMemo(
    () => SKILLS.map((s) => ({ value: s, label: labelOf(SKILL_LABELS, s), count: count((r) => (r.skills || []).includes(s)) })).sort(byCount),
    [base],
  );
  const genderFacet = useMemo(
    () => ['male', 'female', 'unspecified'].map((g) => ({ value: g, label: GENDER_LBL[g] || g, count: count((r) => r.gender === g) })),
    [base],
  );
  const natFacet = useMemo(() => {
    const m = {};
    base.forEach((r) => { if (r.nationality) m[r.nationality] = (m[r.nationality] || 0) + 1; });
    return Object.keys(m).sort((a, b) => a.localeCompare(b, 'tr')).map((n) => ({ value: n, label: n, count: m[n] }));
  }, [base]);
  const employFacet = useMemo(
    () => EMPLOYMENT_STATUS.map((e) => ({
      value: e,
      label: labelOf(EMPLOYMENT_STATUS_LABELS, e),
      count: count((r) => r.employment_status === e),
    })),
    [base],
  );
  const workFacet = useMemo(
    () => WORK_AVAILABILITY.map((v) => ({
      value: v,
      label: labelOf(WORK_AVAILABILITY_LABELS, v),
      count: count((r) => rowWork(r) === v),
    })),
    [base],
  );

  const list = useMemo(() => {
    const aMin = parseInt(ageMin, 10) || 0;
    const aMax = parseInt(ageMax, 10) || 0;
    let out = base.filter((r) => {
      if (fPos.length && !fPos.some((p) => (r.positions || []).includes(p))) return false;
      if (fLang.length && !fLang.every((l) => rowLangs(r).includes(l))) return false;
      if (fSkill.length && !fSkill.some((s) => (r.skills || []).includes(s))) return false;
      if (fNat.length && !fNat.includes(r.nationality)) return false;
      if (fGender.length && !fGender.includes(r.gender)) return false;
      if (fEmployment.length && !fEmployment.includes(r.employment_status)) return false;
      if (fMonths.length && !fMonths.includes(rowWork(r))) return false;
      if (aMin || aMax) {
        const a = ageOf(r);
        if (a == null) return false;
        if (aMin && a < aMin) return false;
        if (aMax && a > aMax) return false;
      }
      return true;
    });
    out = out.slice().sort((a, b) => {
      const da = a.updated_at || '';
      const db = b.updated_at || '';
      return sort === 'old' ? (da < db ? -1 : 1) : (da > db ? -1 : 1);
    });
    return out;
  }, [base, fPos, fLang, fSkill, fNat, fGender, fEmployment, fMonths, ageMin, ageMax, sort]);

  const toggle = (set) => (v) => set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));
  const rmFrom = (set) => (v) => set((a) => a.filter((x) => x !== v));
  const activeCount = fPos.length + fLang.length + fSkill.length + fNat.length + fGender.length
    + fEmployment.length + fMonths.length + (ageMin || ageMax ? 1 : 0);
  const clearAll = () => {
    setFPos([]); setFLang([]); setFSkill([]); setFNat([]); setFGender([]);
    setFEmployment([]); setFMonths([]); setAgeMin(''); setAgeMax('');
  };

  const chips = [
    ...fPos.map((v) => ({ id: 'p' + v, label: labelOf(POSITION_LABELS, v), rm: () => rmFrom(setFPos)(v) })),
    ...fLang.map((v) => ({ id: 'l' + v, label: labelOf(LANG_LABELS, v), rm: () => rmFrom(setFLang)(v) })),
    ...fSkill.map((v) => ({ id: 's' + v, label: labelOf(SKILL_LABELS, v), rm: () => rmFrom(setFSkill)(v) })),
    ...fGender.map((v) => ({ id: 'g' + v, label: GENDER_LBL[v] || v, rm: () => rmFrom(setFGender)(v) })),
    ...fEmployment.map((v) => ({ id: 'e' + v, label: labelOf(EMPLOYMENT_STATUS_LABELS, v), rm: () => rmFrom(setFEmployment)(v) })),
    ...fMonths.map((v) => ({ id: 'm' + v, label: labelOf(WORK_AVAILABILITY_LABELS, v), rm: () => rmFrom(setFMonths)(v) })),
    ...fNat.map((v) => ({ id: 'n' + v, label: v, rm: () => rmFrom(setFNat)(v) })),
    ...((ageMin || ageMax) ? [{ id: 'age', label: `Yaş ${ageMin || '…'}–${ageMax || '…'}`, rm: () => { setAgeMin(''); setAgeMax(''); } }] : []),
  ];

  const cvHtml = useMemo(() => {
    if (!detail) return '';
    const cv = detail.data || {};
    const code = candidateCode(detail.nationality || cv.nationality, detail.reg_no);
    const lang = detail.source_lang || cv.sourceLang || 'tr';
    return buildCvHtml({ ...cv, candidateNo: code }, lang, { withLogo: true, masked: false });
  }, [detail]);

  const openDoc = async (path) => {
    const w = window.open('about:blank', '_blank');
    if (!w) {
      setErr('Tarayıcı pop-up engelledi. Safari’de bu site için pop-up’a izin ver.');
      return;
    }
    try {
      const url = await signedUrl('documents', path);
      if (!url) { w.close(); setErr('Belge linki alınamadı'); return; }
      w.location.href = url;
    } catch (e) {
      try { w.close(); } catch { /* ignore */ }
      setErr(e.message);
    }
  };

  const doDelete = async () => {
    setBusy(true); setErr('');
    try {
      await deleteUserFully(selectedId, { kind: 'candidate' });
      setConfirm(false);
      onSelect(null);
      load();
    } catch (e) {
      setErr(e?.message || 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  const patchRatingEdit = (agencyId, field, value) => {
    setRatingEdits((prev) => ({
      ...prev,
      [agencyId]: { ...prev[agencyId], [field]: value },
    }));
  };

  const saveRatingRow = async (agencyId) => {
    const e = ratingEdits[agencyId];
    if (!e) return;
    setRatingBusy(agencyId);
    setErr('');
    try {
      await adminSaveRating(agencyId, selectedId, e);
      await loadRatings(selectedId);
    } catch (ex) {
      setErr(ex?.message || 'Puan kaydedilemedi');
    } finally {
      setRatingBusy(null);
    }
  };

  const deleteRatingRow = async (agencyId) => {
    if (!window.confirm('Bu değerlendirme silinsin mi? Havuz ortalaması güncellenir.')) return;
    setRatingBusy(agencyId);
    setErr('');
    try {
      await adminDeleteRating(agencyId, selectedId);
      await loadRatings(selectedId);
    } catch (ex) {
      setErr(ex?.message || 'Puan silinemedi');
    } finally {
      setRatingBusy(null);
    }
  };

  if (selectedId && detail) {
    const cv = detail.data || {};
    const code = candidateCode(detail.nationality || cv.nationality, detail.reg_no);
    const ratingAvg = ratings.length
      ? (ratings.reduce((s, r) => s + Number(r.avg_score || 0), 0) / ratings.length)
      : null;
    return (
      <div>
        <button type="button" className="backLink" onClick={() => onSelect(null)}>‹ Aday listesi</button>
        {err ? <p className="loginErr">{err}</p> : null}
        <div className="detail">
          <div className="card">
            <h2>Aday</h2>
            <div className="kv">
              <div className="k">Ad soyad</div><div className="v">{detail.full_name || [cv.firstName, cv.lastName].filter(Boolean).join(' ') || '—'}</div>
              <div className="k">E-posta</div><div className="v">{detail.email || cv.email || '—'}</div>
              <div className="k">Kod</div><div className="v mono">{code}</div>
              <div className="k">Ünvan</div><div className="v">{detail.title || cv.title || '—'}</div>
              <div className="k">Uyruk</div><div className="v">{detail.nationality || cv.nationality || '—'}</div>
              <div className="k">Cinsiyet</div><div className="v">{GENDER_LBL[detail.gender] || detail.gender || cv.gender || '—'}</div>
              <div className="k">Dil</div><div className="v">{detail.source_lang || '—'}</div>
              <div className="k">Durum</div><div className="v"><span className="badge">{detail.status || '—'}</span></div>
              <div className="k">Acente</div>
              <div className="v">
                {agencyLabel(detail) ? (
                  <>
                    <strong>{detail.agency_company || detail.agency_contact || '—'}</strong>
                    {detail.agency_email ? <div className="muted" style={{ fontSize: 12.5 }}>{detail.agency_email}</div> : null}
                    {detail.agency_contact && detail.agency_company ? <div className="muted" style={{ fontSize: 12.5 }}>{detail.agency_contact}</div> : null}
                    {detail.agency_phone ? <div className="muted" style={{ fontSize: 12.5 }}>{detail.agency_phone}</div> : null}
                  </>
                ) : '—'}
              </div>
              <div className="k">Aşama</div><div className="v">{detail.stage ?? '—'}</div>
              <div className="k">Belgeler</div>
              <div className="v">{detail.docs_unlocked ? <span className="badge ok">Açık</span> : <span className="badge">Kapalı</span>}</div>
              <div className="k">Güncelleme</div><div className="v">{fmt(detail.updated_at)}</div>
              <div className="k">User ID</div><div className="v mono">{detail.user_id}</div>
            </div>
            <div className="actions">
              <button type="button" className="dangerBtn" onClick={() => setConfirm(true)}>Sistemden sil</button>
            </div>
          </div>
          <div className="card">
            <h2>Belgeler</h2>
            {!detail.documents?.length ? (
              <p className="empty" style={{ padding: 8 }}>Belge yok</p>
            ) : (
              <ul className="docList">
                {detail.documents.map((d) => (
                  <li key={d.kind}>
                    <span><strong>{d.kind}</strong> · {d.status || '—'}</span>
                    {d.storage_path
                      ? <button type="button" className="linkBtn" onClick={() => openDoc(d.storage_path)}>Aç</button>
                      : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="cvToolbar">
            <h2 style={{ margin: 0 }}>Değerlendirmeler</h2>
            {ratingAvg != null ? (
              <div className="adminRateSummary">★ {ratingAvg.toFixed(1)} · {ratings.length} kayıt</div>
            ) : (
              <div className="muted" style={{ fontWeight: 700, fontSize: 13 }}>Henüz puan yok</div>
            )}
          </div>
          {ratingBusy === 'load' ? (
            <p className="muted">Yükleniyor…</p>
          ) : !ratings.length ? (
            <p className="empty" style={{ padding: 8 }}>Bu adaya henüz değerlendirme yapılmamış.</p>
          ) : (
            <div className="adminRateTableWrap">
              <table className="adminRateTable">
                <thead>
                  <tr>
                    <th>Acente</th>
                    <th>Disiplin</th>
                    <th>Performans</th>
                    <th>Tekrar</th>
                    <th>Ort.</th>
                    <th>Güncelleme</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r) => {
                    const ed = ratingEdits[r.agency_id] || r;
                    const rowBusy = ratingBusy === r.agency_id;
                    return (
                      <tr key={r.agency_id}>
                        <td>
                          <strong>{r.agency_label || r.agency_id}</strong>
                          {r.agency_email ? <div className="muted" style={{ fontSize: 12 }}>{r.agency_email}</div> : null}
                        </td>
                        <td>
                          <select
                            className="adminRateSelect"
                            value={ed.discipline}
                            disabled={rowBusy}
                            onChange={(e) => patchRatingEdit(r.agency_id, 'discipline', Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="adminRateSelect"
                            value={ed.communication}
                            disabled={rowBusy}
                            onChange={(e) => patchRatingEdit(r.agency_id, 'communication', Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="adminRateSelect"
                            value={ed.rehire}
                            disabled={rowBusy}
                            onChange={(e) => patchRatingEdit(r.agency_id, 'rehire', Number(e.target.value))}
                          >
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="mono">{(
                          ((Number(ed.discipline) + Number(ed.communication) + Number(ed.rehire)) / 3).toFixed(1)
                        )}</td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{fmt(r.updated_at)}</td>
                        <td className="adminRateActions">
                          <button type="button" className="linkBtn" disabled={rowBusy} onClick={() => saveRatingRow(r.agency_id)}>
                            {rowBusy ? '…' : 'Kaydet'}
                          </button>
                          <button type="button" className="linkBtn danger" disabled={rowBusy} onClick={() => deleteRatingRow(r.agency_id)}>
                            Sil
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="cvToolbar">
            <h2 style={{ margin: 0 }}>CV</h2>
            <div className="cvZoomCtl">
              <button type="button" onClick={() => setCvZoom((z) => Math.max(0.3, +(z - 0.08).toFixed(2)))}>−</button>
              <span>{Math.round(cvZoom * 100)}%</span>
              <button type="button" onClick={() => setCvZoom((z) => Math.min(1.5, +(z + 0.08).toFixed(2)))}>+</button>
            </div>
          </div>
          <div className="detailCv">
            <div className="cvScaleOuter" style={{ width: 900 * cvZoom, height: 2680 * cvZoom }}>
              <div className="cvScaleInner" style={{ transform: `scale(${cvZoom})` }}>
                <iframe title="cv" className="cvFrame" srcDoc={cvHtml} />
              </div>
            </div>
          </div>
        </div>

        {confirm ? (
          <ConfirmDelete
            title="Adayı sil?"
            text={`${detail.email || detail.full_name || 'Bu aday'} hesabı, CV’si ve belgeleri kalıcı silinir. Geri alınamaz.`}
            busy={busy}
            onCancel={() => setConfirm(false)}
            onConfirm={doDelete}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {err ? <p className="loginErr">{err}</p> : null}

      <div className="catTabs">
        {CATS.map((c) => (
          <button key={c.id} type="button" className={`catTab ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className={`ecBody ${collapsed ? 'collapsed' : ''}`}>
        {collapsed ? (
          <button type="button" className="filterReopen" onClick={() => setCollapsed(false)}>
            Filtrele{activeCount ? ` (${activeCount})` : ''}
          </button>
        ) : (
          <aside className="ecSidebar">
            <div className="ecSideTop">
              <span className="ecSideTitle">Filtrele</span>
              <div className="ecSideTopBtns">
                {activeCount ? <button type="button" className="clearF" onClick={clearAll}>Temizle ({activeCount})</button> : null}
                <button type="button" className="collapseF" onClick={() => setCollapsed(true)} title="Kapat">«</button>
              </div>
            </div>

            <div className="facet">
              <button type="button" className={`facetHead ${ageOpen ? 'on' : ''}`} onClick={() => setAgeOpen((v) => !v)}>
                <span>Yaş</span><span className={`caret ${ageOpen ? 'o' : ''}`}>▾</span>
              </button>
              {ageOpen ? (
                <div className="facetBody ageBody">
                  <input className="ageInput" inputMode="numeric" placeholder="Min" value={ageMin} onChange={(e) => setAgeMin(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
                  <span className="ageDash">–</span>
                  <input className="ageInput" inputMode="numeric" placeholder="Maks" value={ageMax} onChange={(e) => setAgeMax(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
                </div>
              ) : null}
            </div>

            <Facet title="Cinsiyet" items={genderFacet} selected={fGender} onToggle={toggle(setFGender)} max={3} />
            <Facet title="Çalışma Durumu" items={employFacet} selected={fEmployment} onToggle={toggle(setFEmployment)} max={2} />
            <Facet title="Çalışma Süresi" items={workFacet} selected={fMonths} onToggle={toggle(setFMonths)} max={2} />
            {posFacetsBySector.map((g) => (
              <Facet key={g.sector} title={g.title} items={g.items} selected={fPos} onToggle={toggle(setFPos)} max={g.sector === 'other' ? 3 : 6} />
            ))}
            <Facet title="Dil" items={langFacet} selected={fLang} onToggle={toggle(setFLang)} />
            <Facet title="Beceriler" items={skillFacet} selected={fSkill} onToggle={toggle(setFSkill)} />
            <Facet title="Uyruk" items={natFacet} selected={fNat} onToggle={toggle(setFNat)} />
          </aside>
        )}

        <section className="ecResults">
          <div className="ecResultBar">
            <div className="ecResultTop">
              <h1 className="ecTitle">Adaylar</h1>
              <div className="ecResultMeta">
                <span className="ecCount"><b>{list.length}</b> aday</span>
                <label className="ecSort">Sırala
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="new">En yeni</option>
                    <option value="old">En eski</option>
                  </select>
                </label>
                <input className="input searchInline" placeholder="Ara: ad, e-posta, kod…" value={q} onChange={(e) => setQ(e.target.value)} />
                <button type="button" className="ghostBtn" onClick={load}>Yenile</button>
              </div>
            </div>
            {chips.length ? (
              <div className="appliedChips">
                {chips.map((ch) => (
                  <button key={ch.id} type="button" className="aChip" onClick={ch.rm}>{ch.label} <span className="aChipX">✕</span></button>
                ))}
                <button type="button" className="aClear" onClick={clearAll}>Tümünü temizle</button>
              </div>
            ) : null}
          </div>

          {!rows ? (
            <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div className="panel">
              <div className="tableWrap">
                <table className="adminTable">
                  <thead>
                    <tr>
                      <th>Ad / Kod</th>
                      <th>E-posta</th>
                      <th>Ünvan</th>
                      <th>Uyruk</th>
                      <th>Durum</th>
                      <th>Acente</th>
                      <th>Güncelleme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr><td colSpan={7} className="empty">Bu filtrede aday yok</td></tr>
                    ) : list.map((r) => (
                      <tr key={r.user_id} className="clickable" onClick={() => onSelect(r.user_id)}>
                        <td>
                          <strong>{r.full_name || '—'}</strong>
                          <div className="mono muted">{candidateCode(r.nationality, r.reg_no)}</div>
                        </td>
                        <td>{r.email || '—'}</td>
                        <td>{r.title || '—'}</td>
                        <td>{r.nationality || '—'}</td>
                        <td><span className="badge">{statusLabel(r)}</span></td>
                        <td>
                          {agencyLabel(r) ? (
                            <>
                              <strong>{r.agency_company || r.agency_contact || 'Acente'}</strong>
                              {r.agency_email ? <div className="muted" style={{ fontSize: 12 }}>{r.agency_email}</div> : null}
                            </>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td>{fmt(r.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
