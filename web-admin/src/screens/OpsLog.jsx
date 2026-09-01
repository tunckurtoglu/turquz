import { useEffect, useState } from 'react';
import { adminListProcessOps } from '../lib/api';

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

const EVENT_TR = {
  offer_sent: 'Teklif gönderildi',
  offer_accepted: 'Teklif kabul',
  docs_extra_candidate: 'Aday ek süre istedi',
  docs_extra_agency: 'Acente ek süre verdi (ilk belgeler)',
  consulate_extra_agency: 'Acente ek süre verdi (konsolosluk)',
  consulate_deadline_started: 'Konsolosluk süresi başladı',
  docs_deadline_warned: 'İlk belge süresi doldu (uyarı)',
  consulate_deadline_warned: 'Konsolosluk süresi doldu (uyarı)',
  doc_submitted: 'Belge gönderildi',
  process_end: 'Süreç sonlandırıldı',
};

const REASON_TR = {
  docs_deadline: 'İlk belge süresi doldu — acente sonlandırdı',
  consulate_deadline: 'Konsolosluk süresi doldu — acente sonlandırdı',
  agency_cancel: 'Acente süreci sonlandırdı',
  offer_withdraw: 'Teklif geri çekildi',
};

export default function OpsLog() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setErr('');
    try {
      const list = await adminListProcessOps(400, null, null, eventFilter || null);
      setRows(list || []);
    } catch (e) {
      setErr(e?.message || 'Yüklenemedi');
    }
  };

  useEffect(() => { load(); }, [eventFilter]);

  const needle = q.trim().toLowerCase();
  const filtered = !needle ? rows : rows.filter((r) => {
    const hay = [
      r.candidate_title, r.agency_company, r.candidate_reg_no, r.event_type, r.reason, r.note,
      r.candidate_id, r.agency_id,
    ].map((x) => String(x || '').toLowerCase()).join(' ');
    return hay.includes(needle);
  });

  return (
    <div className="card">
      <h2>Operasyon kayıtları</h2>
      <p className="muted">
        Aday ↔ acente süreç olaylarının ispat kaydı (teklif, belge, süre, ek süre, süreç sonu).
        Mesaj içerikleri için «Sohbetler» sekmesine bakın.
      </p>
      {err ? <p style={{ color: '#a32d2d', marginTop: 8 }}>{err}</p> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Aday / acente / olay ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <select className="input" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Tüm olaylar</option>
          {Object.entries(EVENT_TR).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="button" className="ghostBtn" onClick={load}>Yenile</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1.2fr 0.9fr' : '1fr', gap: 16, marginTop: 14 }}>
        <div className="tableWrap">
          {!filtered.length ? (
            <p className="muted">Kayıt yok.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Olay</th>
                  <th>Aday</th>
                  <th>Acente</th>
                  <th>Sebep</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{ cursor: 'pointer', background: selected?.id === r.id ? 'rgba(194,162,90,0.12)' : undefined }}
                  >
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(r.created_at)}</td>
                    <td>
                      <strong style={{ fontSize: 13 }}>{EVENT_TR[r.event_type] || r.event_type}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{r.actor_role}</div>
                    </td>
                    <td>
                      {r.candidate_title || '—'}
                      {r.candidate_reg_no != null ? (
                        <div className="muted" style={{ fontSize: 11 }}>#{r.candidate_reg_no}</div>
                      ) : null}
                    </td>
                    <td>{r.agency_company || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.reason ? (REASON_TR[r.reason] || r.reason) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected ? (
          <div className="card" style={{ margin: 0, alignSelf: 'start' }}>
            <h3 style={{ marginTop: 0 }}>Kayıt detayı</h3>
            <p><b>Olay:</b> {EVENT_TR[selected.event_type] || selected.event_type}</p>
            <p><b>Zaman:</b> {fmt(selected.created_at)}</p>
            <p><b>Aktör:</b> {selected.actor_role} {selected.actor_id ? `(${String(selected.actor_id).slice(0, 8)}…)` : ''}</p>
            <p><b>Aday:</b> {selected.candidate_title} {selected.candidate_id ? `(${String(selected.candidate_id).slice(0, 8)}…)` : ''}</p>
            <p><b>Acente:</b> {selected.agency_company}</p>
            {selected.reason ? <p><b>Sebep:</b> {REASON_TR[selected.reason] || selected.reason}</p> : null}
            {selected.note ? <p><b>Not:</b> {selected.note}</p> : null}
            {selected.meta && Object.keys(selected.meta).length ? (
              <pre style={{
                background: '#f4f5f7', padding: 10, borderRadius: 8, fontSize: 11,
                overflow: 'auto', maxHeight: 240,
              }}
              >
                {JSON.stringify(selected.meta, null, 2)}
              </pre>
            ) : null}
            <button type="button" className="ghostBtn" onClick={() => setSelected(null)}>Kapat</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
