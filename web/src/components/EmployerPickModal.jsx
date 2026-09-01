// Favori: 1) işletme 2) turizm departmanı.
// Geri: departman → oteller. ✕ her zaman kapatır. Filtre: mevcut otelde açılabilir.
import { useEffect, useMemo, useState, useRef } from 'react';
import { listEmployers, touchEmployer } from '../lib/employers';
import { listFavoriteDepartmentCounts, listFavoriteEmployerCounts } from '../lib/favorites';
import { langOptions, POSITIONS_BY_SECTOR } from '../../../cv/options';
import { useLang } from '../i18n.jsx';
import EmployerNotes from './EmployerNotes.jsx';

/**
 * @param {'add'|'filter'} purpose
 * @param {{ employerId: string, department: string }[]} markedSlots
 * @param {string|null} initialEmployerId
 * @param {string} initialEmployerName
 */
export default function EmployerPickModal({
  open, agencyId, purpose = 'add', markedSlots = [],
  initialEmployerId = null, initialEmployerName = '',
  onSelect, onClose,
}) {
  const { t, lang } = useLang();
  const opts = langOptions(lang);
  const deptOptions = opts.POSITIONS_BY_SECTOR?.tourism
    || POSITIONS_BY_SECTOR.tourism.map((v) => ({ value: v, label: v }));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('hotel');
  const [picked, setPicked] = useState(null);
  const [deptCounts, setDeptCounts] = useState({});
  const [hotelCounts, setHotelCounts] = useState({});
  const [favTotal, setFavTotal] = useState(null);
  const [deptLoading, setDeptLoading] = useState(false);
  const openGen = useRef(0);

  const markedEmp = useMemo(() => new Set((markedSlots || []).map((s) => s.employerId)), [markedSlots]);
  const markedDeptForPicked = useMemo(() => {
    if (!picked?.id) return new Set();
    return new Set(
      (markedSlots || []).filter((s) => s.employerId === picked.id).map((s) => s.department),
    );
  }, [markedSlots, picked]);

  const openDeptStep = async (emp) => {
    if (!emp?.id) return;
    const gen = ++openGen.current;
    try { await touchEmployer(agencyId, emp.id); } catch { /* ignore */ }
    if (gen !== openGen.current) return;
    setPicked(emp);
    setStep('dept');
    setDeptLoading(true);
    setFavTotal(null);
    setDeptCounts({});
    try {
      const { departments, totalPeople } = await listFavoriteDepartmentCounts(agencyId, emp.id);
      if (gen !== openGen.current) return;
      const map = {};
      (departments || []).forEach((r) => { map[r.department] = r.count; });
      setDeptCounts(map);
      setFavTotal(totalPeople || 0);
    } finally {
      if (gen === openGen.current) setDeptLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !agencyId) return undefined;
    let alive = true;
    openGen.current += 1;
    setLoading(true);
    Promise.all([
      listEmployers(agencyId),
      purpose === 'filter' ? listFavoriteEmployerCounts(agencyId) : Promise.resolve({}),
    ]).then(([list, counts]) => {
      if (!alive) return;
      setRows(list || []);
      setHotelCounts(counts || {});
    }).finally(() => { if (alive) setLoading(false); });

    if (initialEmployerId) {
      openDeptStep({ id: initialEmployerId, name: initialEmployerName || '' });
    } else {
      setStep('hotel');
      setPicked(null);
      setDeptCounts({});
      setFavTotal(null);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/id ile sıfırla
  }, [open, agencyId, initialEmployerId, initialEmployerName, purpose]);

  if (!open) return null;

  const title = step === 'dept'
    ? (t('fav_title_dept') || '')
    : (purpose === 'filter' ? (t('fav_title_filter') || '') : (t('fav_title_add') || ''));
  const sub = step === 'dept'
    ? (purpose === 'filter' ? (t('fav_sub_dept_filter') || '') : (t('fav_sub_dept_add') || ''))
    : (purpose === 'filter' ? (t('fav_sub_filter') || '') : (t('fav_sub_add') || ''));

  const goBackToHotels = () => {
    openGen.current += 1;
    setStep('hotel');
    setPicked(null);
    setFavTotal(null);
    setDeptCounts({});
    setDeptLoading(false);
  };

  const closeAll = () => onClose?.();

  return (
    <div className="modalOverlay" onClick={step === 'dept' ? goBackToHotels : closeAll}>
      <div className="modalCard sm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modalHead" style={{ gap: 8 }}>
          {step === 'dept' ? (
            <button
              type="button"
              onClick={goBackToHotels}
              style={{
                border: 0, background: 'transparent', cursor: 'pointer',
                fontWeight: 800, fontSize: 13, color: '#8a6a1f', padding: '4px 0', whiteSpace: 'nowrap',
              }}
            >
              ‹ {t('fav_back_hotels') || 'Oteller'}
            </button>
          ) : <span style={{ width: 8 }} />}
          <h3 style={{ flex: 1, textAlign: 'center', margin: 0 }}>{title}</h3>
          <button type="button" className="modalX" onClick={closeAll} aria-label="close">✕</button>
        </div>
        <div className="modalBody" style={{ overflowY: 'auto', flex: 1 }}>
          {picked?.name ? (
            <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#c2a25a', fontSize: 13 }}>★ {picked.name}</p>
          ) : null}
          {step === 'dept' && favTotal != null ? (
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 8,
              background: '#142033', borderRadius: 12, padding: '10px 14px', marginBottom: 10,
            }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#c2a25a', letterSpacing: '-0.5px', lineHeight: 1 }}>
                {favTotal}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f5ecda' }}>
                {t('fav_hotel_total_label') || 'kişi favoride'}
              </span>
            </div>
          ) : null}
          <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 13.5, lineHeight: 1.45 }}>{sub}</p>
          {loading && step === 'hotel' ? <p className="muted">…</p> : null}

          {step === 'hotel' && !loading ? (
            <>
              {!rows.length ? <p className="muted">{t('fav_need_hotel') || ''}</p> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((e) => {
                  const on = markedEmp.has(e.id);
                  const hn = hotelCounts[e.id] || 0;
                  const nameLabel = purpose === 'filter'
                    ? (t('fav_dept_count', { label: e.name, n: String(hn) }) || `${e.name} (${hn})`)
                    : e.name;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => openDeptStep(e)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        padding: '12px 14px', borderRadius: 10,
                        border: on || (purpose === 'filter' && hn > 0) ? '1.5px solid #c2a25a' : '1px solid #e6e8ec',
                        background: on || (purpose === 'filter' && hn > 0) ? 'rgba(194,162,90,0.1)' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ color: '#c2a25a', fontSize: 18, width: 22 }}>
                        {on || (purpose === 'filter' && hn > 0) ? '★' : '☆'}
                      </span>
                      <span style={{ flex: 1 }}>
                        <strong style={{ display: 'block', color: '#1b2533' }}>{nameLabel}</strong>
                        {e.title ? <span className="muted" style={{ fontSize: 12.5 }}>{e.title}</span> : null}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6a1f' }}>{t('fav_next_dept') || '→'}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 'dept' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {picked?.id ? (
                <EmployerNotes agencyId={agencyId} employerId={picked.id} />
              ) : null}
              {deptLoading ? <p className="muted">…</p> : null}
              {!deptLoading ? deptOptions.map((o) => {
                const n = deptCounts[o.value] || 0;
                const on = markedDeptForPicked.has(o.value);
                const label = purpose === 'filter'
                  ? (t('fav_dept_count', { label: o.label, n: String(n) }) || `${o.label} (${n})`)
                  : o.label;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onSelect?.({ employer: picked, department: o.value })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: '12px 14px', borderRadius: 10,
                      border: on ? '1.5px solid #c2a25a' : '1px solid #e6e8ec',
                      background: on ? 'rgba(194,162,90,0.1)' : '#fff',
                      opacity: purpose === 'filter' && n === 0 ? 0.55 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    {purpose === 'add' ? (
                      <span style={{ color: '#c2a25a', fontSize: 18, width: 22 }}>{on ? '★' : '☆'}</span>
                    ) : null}
                    <strong style={{ flex: 1, color: '#1b2533' }}>{label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#8a6a1f' }}>
                      {purpose === 'add'
                        ? (on ? (t('fav_remove') || '') : (t('fav_add_tap') || ''))
                        : (n > 0 ? (t('fav_open_list') || '') : '—')}
                    </span>
                  </button>
                );
              }) : null}
            </div>
          ) : null}
        </div>
        {purpose === 'add' && step === 'dept' ? (
          <div style={{
            display: 'flex', gap: 10, padding: '12px 16px',
            borderTop: '1px solid #e6e8ec', background: '#fff',
          }}>
            <button
              type="button"
              onClick={goBackToHotels}
              style={{
                flex: 1, border: 0, borderRadius: 10, padding: '12px 10px', cursor: 'pointer',
                background: '#eef0f2', fontWeight: 800, color: '#1b2533',
              }}
            >
              ‹ {t('fav_back_hotels') || 'Oteller'}
            </button>
            <button
              type="button"
              onClick={closeAll}
              style={{
                flex: 1, border: 0, borderRadius: 10, padding: '12px 10px', cursor: 'pointer',
                background: '#142033', fontWeight: 800, color: '#f5ecda',
              }}
            >
              {t('fav_done') || 'Tamam'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
