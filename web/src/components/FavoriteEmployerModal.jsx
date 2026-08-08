import { useEffect, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { listEmployers, saveEmployer } from '../lib/employers';
import { toggleFavorite, countFavoritesByEmployer } from '../lib/favorites';

const EMPLOYER_FORM = [
  ['name', 'Liste adı *'],
  ['title', 'İşveren unvanı *'],
  ['address', 'İşyeri adresi *'],
  ['phone', 'Telefon'],
  ['email', 'E-posta'],
  ['contactPhone', 'İletişim telefonu'],
  ['contactEmail', 'İletişim e-postası'],
];

/**
 * mode: 'toggle' | 'filter'
 */
export default function FavoriteEmployerModal({
  open,
  mode = 'toggle',
  agencyId,
  candidateId,
  activeEmployerIds = [],
  selectedEmployerId = null,
  onChanged,
  onPickEmployer,
  onClearFilter,
  onClose,
}) {
  const { t } = useLang();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [active, setActive] = useState(() => new Set(activeEmployerIds));
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [empF, setEmpF] = useState({});
  const [saving, setSaving] = useState(false);

  const activeKey = (activeEmployerIds || []).slice().sort().join(',');

  const reload = () => {
    if (!agencyId) return;
    setLoading(true);
    Promise.all([
      listEmployers(agencyId),
      mode === 'filter' ? countFavoritesByEmployer(agencyId) : Promise.resolve({}),
    ]).then(([emps, cnt]) => {
      const list = emps || [];
      const c = cnt || {};
      setRows(mode === 'filter'
        ? list.slice().sort((a, b) => (c[b.id] || 0) - (c[a.id] || 0) || (a.name || '').localeCompare(b.name || '', 'tr'))
        : list);
      setCounts(c);
      setLoading(false);
    }).catch(() => { setRows([]); setCounts({}); setLoading(false); });
  };

  useEffect(() => {
    if (!open || !agencyId) return undefined;
    setActive(new Set(activeEmployerIds || []));
    setFormOpen(false);
    setEditId(null);
    reload();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agencyId, mode, activeKey]);

  if (!open) return null;

  const onToggle = async (employer) => {
    if (!candidateId || !agencyId) return;
    setBusyId(employer.id);
    try {
      const nowOn = await toggleFavorite(agencyId, employer.id, candidateId);
      setActive((prev) => {
        const next = new Set(prev);
        if (nowOn) next.add(employer.id);
        else next.delete(employer.id);
        return next;
      });
      onChanged?.(candidateId, employer.id, nowOn);
    } catch (e) {
      alert(e?.message || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const openNew = () => {
    setEditId(null);
    setEmpF({});
    setFormOpen(true);
  };

  const openEdit = (e) => {
    setEditId(e.id);
    setEmpF({
      name: e.name || '',
      title: e.title || '',
      address: e.address || '',
      phone: e.phone || '',
      email: e.email || '',
      contactPhone: e.contactPhone || '',
      contactEmail: e.contactEmail || '',
    });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!agencyId || !empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()) return;
    setSaving(true);
    try {
      const emp = await saveEmployer(agencyId, empF, editId || undefined);
      setFormOpen(false);
      setEditId(null);
      reload();
      if (selectedEmployerId === emp.id) onPickEmployer?.(emp);
      if (!editId && mode === 'toggle' && candidateId) await onToggle(emp);
    } catch (e) {
      alert(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'filter' ? (t('fav_title_filter') || 'Favori listesi') : (t('fav_title_add') || 'Favoriye ekle');
  const sub = mode === 'filter' ? (t('fav_sub_filter') || '') : (t('fav_sub_add') || '');

  return (
    <div className="modalOverlay" onClick={onClose} role="presentation">
      <div className="modalCard sm favModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        {!formOpen ? (
          <>
            <div className="modalHead">
              <h3>{title}</h3>
              <button type="button" className="modalX" onClick={onClose}>✕</button>
            </div>
            <p className="favModalSub">{sub}</p>
            {mode === 'filter' && selectedEmployerId ? (
              <button
                type="button"
                className="favClearBtn"
                onClick={() => { onClearFilter?.(); onClose?.(); }}
              >
                {t('fav_filter_clear') || 'Favori filtresini kaldır'}
              </button>
            ) : null}
            {loading ? <div className="spinner" style={{ margin: '24px auto' }} /> : (
              <div className="favEmpList">
                {rows.map((e) => {
                  const on = active.has(e.id);
                  const selected = selectedEmployerId === e.id;
                  const n = counts[e.id] || 0;
                  return (
                    <div key={e.id} className={`favEmpCard ${(on || selected) ? 'on' : ''}`}>
                      <button
                        type="button"
                        className="favEmpRow"
                        disabled={busyId === e.id}
                        onClick={() => {
                          if (mode === 'filter') { onPickEmployer?.(e); onClose?.(); }
                          else onToggle(e);
                        }}
                      >
                        <span className="favEmpMeta">
                          <strong>{e.name}</strong>
                          {e.title ? <small>{e.title}</small> : null}
                          <em>{mode === 'filter' ? (t('fav_count', { n }) || `${n} aday`) : (on ? (t('fav_in') || '') : (t('fav_add_tap') || ''))}</em>
                        </span>
                        <span className={`favEmpStar ${(on || selected) ? 'on' : ''}`}>
                          {mode === 'filter' ? (selected ? '★' : '☆') : (on ? '★' : '☆')}
                        </span>
                      </button>
                      <button type="button" className="favEmpEdit" onClick={() => openEdit(e)}>
                        {t('employer_edit') || 'Düzenle'}
                      </button>
                    </div>
                  );
                })}
                {!rows.length ? <div className="empty">{t('employer_pick_empty') || 'Henüz işletme yok.'}</div> : null}
                <button type="button" className="favAddNew" onClick={openNew}>
                  + {t('employer_add_new') || 'Yeni işletme ekle'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="modalHead">
              <h3>{editId ? (t('employer_form_edit_title') || 'İşletmeyi Düzenle') : (t('employer_form_title') || 'İşletme Kaydet')}</h3>
              <button type="button" className="modalX" onClick={() => { setFormOpen(false); setEditId(null); }}>✕</button>
            </div>
            <div className="modalBody cForm" style={{ padding: '12px 16px 8px' }}>
              {EMPLOYER_FORM.map(([key, label]) => (
                <div key={key} className="cField">
                  <label className="fieldLbl">{label}</label>
                  {['title', 'address'].includes(key)
                    ? <textarea className="input" rows={2} value={empF[key] || ''} onChange={(ev) => setEmpF((p) => ({ ...p, [key]: ev.target.value }))} />
                    : <input className="input" value={empF[key] || ''} onChange={(ev) => setEmpF((p) => ({ ...p, [key]: ev.target.value }))} />}
                </div>
              ))}
            </div>
            <div className="modalFoot">
              <button type="button" className="ghostBtn" onClick={() => { setFormOpen(false); setEditId(null); }}>Vazgeç</button>
              <button
                type="button"
                className="goldBtn sm"
                onClick={saveForm}
                disabled={saving || !empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()}
              >
                {saving ? '…' : 'Kaydet'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
