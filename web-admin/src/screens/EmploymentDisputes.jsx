import { useEffect, useState } from 'react';
import { adminListEmploymentDisputes, adminResolveEmployment, getCandidate } from '../lib/api';

export default function EmploymentDisputes() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState({});
  const [names, setNames] = useState({});
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const list = await adminListEmploymentDisputes();
      setRows(list || []);
      const map = {};
      await Promise.all((list || []).map(async (ep) => {
        try {
          const c = await getCandidate(ep.candidate_id);
          map[ep.candidate_id] = c?.title || c?.reg_no || ep.candidate_id.slice(0, 8);
        } catch (_) {
          map[ep.candidate_id] = ep.candidate_id.slice(0, 8);
        }
      }));
      setNames(map);
    } catch (e) {
      setErr(e?.message || 'Yüklenemedi');
    }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id, decision) => {
    setBusy(id + decision);
    try {
      await adminResolveEmployment(id, decision, note[id] || null);
      await load();
    } catch (e) {
      setErr(e?.message || 'Karar kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h2>İstihdam itirazları</h2>
      <p className="muted">Ayrılış itirazlarında nihai kararı burada verin. “Devam” = personel sürer; “Erken ayrılış” = havuza döner, sertifika yok.</p>
      {err ? <div className="err">{err}</div> : null}
      {!rows.length ? (
        <p className="muted">Açık itiraz yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Aday</th>
                <th>Otel / ünvan</th>
                <th>Talep</th>
                <th>İtiraz</th>
                <th>Not</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ep) => (
                <tr key={ep.id}>
                  <td>
                    <div>{names[ep.candidate_id] || '…'}</div>
                    <code style={{ fontSize: 11 }}>{ep.candidate_id}</code>
                  </td>
                  <td>{ep.employer_title || '—'}</td>
                  <td>
                    {ep.end_request_role || '—'}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ep.end_requested_at ? new Date(ep.end_requested_at).toLocaleString('tr-TR') : ''}
                    </div>
                  </td>
                  <td>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ep.contest_at ? new Date(ep.contest_at).toLocaleString('tr-TR') : ''}
                    </div>
                    <div>{ep.contest_note || '—'}</div>
                  </td>
                  <td>
                    <input
                      className="input"
                      placeholder="İç not (opsiyonel)"
                      value={note[ep.id] || ''}
                      onChange={(e) => setNote((n) => ({ ...n, [ep.id]: e.target.value }))}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={!!busy}
                      onClick={() => resolve(ep.id, 'continue')}
                    >
                      {busy === `${ep.id}continue` ? '…' : 'Devam ettir'}
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="dangerBtn"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Erken ayrılış onaylansın mı? Sertifika verilmez, aday havuza döner.')) {
                          resolve(ep.id, 'early_exit');
                        }
                      }}
                    >
                      {busy === `${ep.id}early_exit` ? '…' : 'Erken ayrılış'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="ghostBtn" style={{ marginTop: 12 }} onClick={load}>Yenile</button>
    </div>
  );
}
