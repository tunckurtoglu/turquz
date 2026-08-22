import { useEffect, useState } from 'react';
import {
  adminListEmploymentClosed,
  adminListEmploymentDisputes,
  adminResolveEmployment,
  getCandidate,
} from '../lib/api';

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function outcomeLabel(o) {
  if (o === 'disputed') return 'İtiraz';
  if (o === 'completion_pending') return 'Dönem onayı';
  if (o === 'early_exit_pending') return 'Ayrılış bekliyor';
  if (o === 'completed') return 'Tamamladı';
  if (o === 'early_exit') return 'Erken ayrılış';
  return o || '—';
}

export default function EmploymentDisputes() {
  const [rows, setRows] = useState([]);
  const [closed, setClosed] = useState([]);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState({});
  const [names, setNames] = useState({});
  const [err, setErr] = useState('');

  const loadNames = async (list) => {
    const map = { ...names };
    await Promise.all((list || []).map(async (ep) => {
      if (map[ep.candidate_id]) return;
      try {
        const c = await getCandidate(ep.candidate_id);
        map[ep.candidate_id] = c?.title || c?.reg_no || ep.candidate_id.slice(0, 8);
      } catch (_) {
        map[ep.candidate_id] = ep.candidate_id.slice(0, 8);
      }
    }));
    setNames(map);
  };

  const load = async () => {
    setErr('');
    try {
      const [open, done] = await Promise.all([
        adminListEmploymentDisputes(),
        adminListEmploymentClosed(90),
      ]);
      setRows(open || []);
      setClosed(done || []);
      await loadNames([...(open || []), ...(done || [])]);
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
      const m = e?.message || '';
      if (m.includes('candidate_busy')) setErr('Aday başka bir süreçte (teklif/kabul/yolda/personel). Geri alınamaz.');
      else if (m.includes('open_episode')) setErr('Adayın açık istihdam kaydı var.');
      else setErr(m || 'Karar kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h2>İstihdam kuyruğu</h2>
      <p className="muted">
        İtiraz, dönem onayı ve açık ayrılış talepleri burada. Sertifika yalnızca iki taraf (veya siz) “tamamladı” deyince verilir.
        7 gün sessizlikle erken ayrılış kesinleştiyse aşağıdaki listeden geri alabilirsiniz — belgeler silinmiş olur, yeniden yüklenir.
      </p>
      {err ? <div className="err">{err}</div> : null}
      {!rows.length ? (
        <p className="muted">Açık kayıt yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Durum</th>
                <th>Aday</th>
                <th>Otel / ünvan</th>
                <th>Detay</th>
                <th>Not</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ep) => (
                <tr key={ep.id}>
                  <td>{outcomeLabel(ep.outcome)}</td>
                  <td>
                    <div>{names[ep.candidate_id] || '…'}</div>
                    <code style={{ fontSize: 11 }}>{ep.candidate_id}</code>
                  </td>
                  <td>{ep.employer_title || '—'}</td>
                  <td>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {ep.outcome === 'completion_pending'
                        ? `Aday: ${ep.term_vote_candidate || '—'} · Acente: ${ep.term_vote_agency || '—'}`
                        : `${ep.end_request_role || '—'} ${fmt(ep.end_requested_at)}`}
                    </div>
                    <div>{ep.contest_note || ep.end_reason || '—'}</div>
                    {ep.silence_deadline_at ? (
                      <div className="muted" style={{ fontSize: 12 }}>Son: {fmt(ep.silence_deadline_at)}</div>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="input"
                      placeholder="İç not"
                      value={note[ep.id] || ''}
                      onChange={(e) => setNote((n) => ({ ...n, [ep.id]: e.target.value }))}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="ghostBtn" disabled={!!busy} onClick={() => resolve(ep.id, 'continue')}>
                      {busy === `${ep.id}continue` ? '…' : 'Devam (+30 gün)'}
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Dönem başarıyla tamamlansın mı? Sertifika verilir, aday havuza döner.')) {
                          resolve(ep.id, 'completed');
                        }
                      }}
                    >
                      {busy === `${ep.id}completed` ? '…' : 'Tamamladı'}
                    </button>
                    {' '}
                    <button
                      type="button"
                      className="dangerBtn"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Erken ayrılış onaylansın mı? Sertifika yok, aday havuza döner.')) {
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

      <h3 style={{ marginTop: 28 }}>Son 90 gün — kesinleşenler</h3>
      <p className="muted">Yanlış 7 günlük sessizlik veya hatalı kapanış: personeli geri açın. Sözleşme/uçuş/belge geri gelmez.</p>
      {!closed.length ? (
        <p className="muted">Kayıt yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sonuç</th>
                <th>Aday</th>
                <th>Otel</th>
                <th>Bitiş</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {closed.map((ep) => (
                <tr key={ep.id}>
                  <td>{outcomeLabel(ep.outcome)}</td>
                  <td>
                    <div>{names[ep.candidate_id] || '…'}</div>
                    <code style={{ fontSize: 11 }}>{ep.candidate_id}</code>
                  </td>
                  <td>{ep.employer_title || '—'}</td>
                  <td>{fmt(ep.ended_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Personel kaydı yeniden açılsın mı? Belgeler silinmiş olabilir; yeniden yüklenmeli.')) {
                          resolve(ep.id, 'restore');
                        }
                      }}
                    >
                      {busy === `${ep.id}restore` ? '…' : 'Geri al'}
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
