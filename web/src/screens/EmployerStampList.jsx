// web — Ayarlar: işletme listesinden kaşe
import { useEffect, useState } from 'react';
import { listEmployers } from '../lib/employers';
import StampSetup from './StampSetup.jsx';
import { useLang } from '../i18n.jsx';

export default function EmployerStampList({ agencyId, onClose }) {
  const { t } = useLang();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stampEmp, setStampEmp] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try { setRows(await listEmployers(agencyId)); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, [agencyId]);

  if (stampEmp) {
    return (
      <StampSetup
        agencyId={agencyId}
        employer={stampEmp}
        onClose={() => setStampEmp(null)}
        onSaved={() => { setStampEmp(null); refresh(); }}
      />
    );
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard sm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modalHead">
          <h3>{t('stamp_title')}</h3>
          <button type="button" className="modalX" onClick={onClose}>✕</button>
        </div>
        <div className="modalBody">
          <p className="fieldHint">{t('stamp_list_hint')}</p>
          {loading ? <div className="center pad"><div className="spinner" /></div> : (
            <div className="employerList">
              {rows.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="employerCardMain"
                  style={{ width: '100%', textAlign: 'left', marginBottom: 8 }}
                  onClick={() => setStampEmp(e)}
                >
                  <strong>{e.name}</strong>
                  {e.title ? <span>{e.title}</span> : null}
                  <em>{e.hasStamp ? `${t('stamp_ready')} — ${t('employer_edit')}` : t('stamp_missing')}</em>
                </button>
              ))}
              {rows.length === 0 ? <p className="fieldHint">{t('employer_pick_empty')}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
