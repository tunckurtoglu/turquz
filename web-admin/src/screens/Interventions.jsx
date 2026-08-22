import { useEffect, useMemo, useState } from 'react';
import {
  adminInterventionAct,
  adminListEmploymentClosed,
  adminListInterventionLog,
  adminListInterventions,
} from '../lib/api';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'flight', label: 'Uçuş' },
  { id: 'work', label: 'İşe başlama' },
  { id: 'employment', label: 'İstihdam' },
];

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function kindLabel(kind) {
  if (kind === 'boarding_candidate_silent') return 'Uçuş · aday sessiz';
  if (kind === 'boarding_agency_silent') return 'Uçuş · acente sessiz';
  if (kind === 'work_start_pending') return 'İşe başlama bekliyor';
  if (kind === 'transit_stalled') return 'Yolda takılı (14+ gün)';
  if (kind === 'employment_disputed') return 'İtiraz';
  if (kind === 'employment_term') return 'Dönem onayı';
  if (kind === 'employment_exit') return 'Ayrılış talebi';
  return kind || '—';
}

function kindBadgeClass(kind) {
  if (kind === 'transit_stalled' || kind === 'employment_disputed') return 'miss';
  if (kind.startsWith('boarding_')) return 'warn';
  if (kind.startsWith('employment_')) return 'warn';
  return 'ok';
}

function filterOf(kind) {
  if (kind.startsWith('boarding_')) return 'flight';
  if (kind === 'work_start_pending' || kind === 'transit_stalled') return 'work';
  if (kind.startsWith('employment_')) return 'employment';
  return 'all';
}

function silentLabel(party) {
  if (party === 'candidate') return 'Aday';
  if (party === 'agency') return 'Acente';
  if (party === 'both') return 'Her iki taraf';
  return party || '—';
}

function outcomeLabel(o) {
  if (o === 'completed') return 'Tamamladı';
  if (o === 'early_exit') return 'Erken ayrılış';
  return o || '—';
}

export default function Interventions({ onOpenCandidate }) {
  const [rows, setRows] = useState([]);
  const [closed, setClosed] = useState([]);
  const [log, setLog] = useState([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState({});
  const [deferDate, setDeferDate] = useState({});
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      const [open, done, audit] = await Promise.all([
        adminListInterventions(),
        adminListEmploymentClosed(90),
        adminListInterventionLog(40),
      ]);
      setRows(open || []);
      setClosed(done || []);
      setLog(audit || []);
    } catch (e) {
      setErr(e?.message || 'Yüklenemedi');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => filterOf(r.kind) === filter);
  }, [rows, filter]);

  const act = async (queueId, action, payload = {}) => {
    setBusy(`${queueId}:${action}`);
    setErr('');
    try {
      await adminInterventionAct(queueId, action, note[queueId] || null, payload);
      await load();
    } catch (e) {
      const m = e?.message || '';
      if (m.includes('candidate_busy')) setErr('Aday başka bir süreçte. Geri alınamaz.');
      else if (m.includes('open_episode')) setErr('Adayın açık istihdam kaydı var.');
      else if (m.includes('defer_date_required')) setErr('Erteleme için yeni tarih girin.');
      else if (m.includes('boarding_too_early')) setErr('Kalkış günü henüz gelmedi.');
      else setErr(m || 'İşlem kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const renderActions = (row) => {
    const id = row.queue_id;
    const b = (action) => busy === `${id}:${action}`;

    if (row.kind === 'boarding_candidate_silent') {
      return (
        <>
          <button type="button" className="ghostBtn" disabled={!!busy} onClick={() => act(id, 'candidate_confirmed')}>
            {b('candidate_confirmed') ? '…' : 'Aday: bindi'}
          </button>
          {' '}
          <button type="button" className="dangerBtn" disabled={!!busy} onClick={() => act(id, 'candidate_missed')}>
            {b('candidate_missed') ? '…' : 'Aday: binmedi'}
          </button>
        </>
      );
    }

    if (row.kind === 'boarding_agency_silent') {
      return (
        <>
          <button type="button" className="ghostBtn" disabled={!!busy} onClick={() => act(id, 'agency_confirmed')}>
            {b('agency_confirmed') ? '…' : 'Geldi'}
          </button>
          {' '}
          <button type="button" className="dangerBtn" disabled={!!busy} onClick={() => act(id, 'agency_missed')}>
            {b('agency_missed') ? '…' : 'Gelmedi'}
          </button>
        </>
      );
    }

    if (row.kind === 'work_start_pending' || row.kind === 'transit_stalled') {
      return (
        <>
          <button type="button" className="ghostBtn" disabled={!!busy} onClick={() => act(id, 'confirm_hire')}>
            {b('confirm_hire') ? '…' : 'İşe başladı'}
          </button>
          {' '}
          <input
            type="date"
            className="input"
            style={{ width: 140, display: 'inline-block', padding: '6px 8px', marginRight: 6 }}
            value={deferDate[id] || ''}
            onChange={(e) => setDeferDate((d) => ({ ...d, [id]: e.target.value }))}
          />
          <button
            type="button"
            className="ghostBtn"
            disabled={!!busy}
            onClick={() => act(id, 'defer_start', { deferDate: deferDate[id] })}
          >
            {b('defer_start') ? '…' : 'Ertele'}
          </button>
        </>
      );
    }

    if (row.kind.startsWith('employment_')) {
      return (
        <>
          <button type="button" className="ghostBtn" disabled={!!busy} onClick={() => act(id, 'continue')}>
            {b('continue') ? '…' : 'Devam (+30 gün)'}
          </button>
          {' '}
          <button
            type="button"
            className="ghostBtn"
            disabled={!!busy}
            onClick={() => {
              if (confirm('Dönem başarıyla tamamlansın mı? Sertifika verilir, aday havuza döner.')) {
                act(id, 'completed');
              }
            }}
          >
            {b('completed') ? '…' : 'Tamamladı'}
          </button>
          {' '}
          <button
            type="button"
            className="dangerBtn"
            disabled={!!busy}
            onClick={() => {
              if (confirm('Erken ayrılış onaylansın mı? Sertifika yok, aday havuza döner.')) {
                act(id, 'early_exit');
              }
            }}
          >
            {b('early_exit') ? '…' : 'Erken ayrılış'}
          </button>
        </>
      );
    }

    return null;
  };

  return (
    <div className="card">
      <h2>Müdahale kuyruğu</h2>
      <p className="muted">
        Karşılıklı onay bekleyen adaylar burada toplanır. Uçuş teyidi, işe başlama, dönem ve ayrılış
        kayıtlarında sessiz kalan tarafı siz arayıp işlemi tamamlayabilirsiniz. Her işlem audit log’a yazılır.
      </p>

      <div className="interventionFilters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`ghostBtn ${filter === f.id ? 'on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id === 'all' ? ` (${rows.length})` : ''}
          </button>
        ))}
        <button type="button" className="ghostBtn" style={{ marginLeft: 'auto' }} onClick={load}>
          Yenile
        </button>
      </div>

      {err ? <div className="err">{err}</div> : null}

      {!filtered.length ? (
        <p className="muted">Bu filtrede açık kayıt yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Öncelik</th>
                <th>Aday</th>
                <th>Acente</th>
                <th>Sessiz</th>
                <th>Detay</th>
                <th>Bekliyor</th>
                <th>Not</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.queue_id}>
                  <td>
                    <span className={`badge ${kindBadgeClass(row.kind)}`}>{kindLabel(row.kind)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => onOpenCandidate?.(row.candidate_id)}
                    >
                      {row.candidate_title || '…'}
                    </button>
                    <div><code style={{ fontSize: 11 }}>{row.candidate_id}</code></div>
                  </td>
                  <td>
                    <div>{row.agency_title || '—'}</div>
                    {row.agency_id ? (
                      <code style={{ fontSize: 11 }}>{row.agency_id}</code>
                    ) : null}
                  </td>
                  <td>{silentLabel(row.silent_party)}</td>
                  <td>
                    <div>{row.detail || '—'}</div>
                    {row.ctx?.employerTitle ? (
                      <div className="muted" style={{ fontSize: 12 }}>{row.ctx.employerTitle}</div>
                    ) : null}
                    {row.ctx?.silenceDeadlineAt ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Son: {fmt(row.ctx.silenceDeadlineAt)}
                      </div>
                    ) : null}
                  </td>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(row.since_at)}</td>
                  <td>
                    <input
                      className="input"
                      placeholder="İç not"
                      value={note[row.queue_id] || ''}
                      onChange={(e) => setNote((n) => ({ ...n, [row.queue_id]: e.target.value }))}
                    />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{renderActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>Son müdahaleler</h3>
      {!log.length ? (
        <p className="muted">Henüz kayıt yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Tür</th>
                <th>İşlem</th>
                <th>Aday</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="muted" style={{ fontSize: 12 }}>{fmt(l.created_at)}</td>
                  <td>{kindLabel(l.kind)}</td>
                  <td>{l.action}</td>
                  <td><code style={{ fontSize: 11 }}>{l.candidate_id || l.episode_id}</code></td>
                  <td>{l.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>Son 90 gün — kesinleşen istihdam</h3>
      <p className="muted">Yanlış kapanış: personeli geri açın. Sözleşme/uçuş/belge geri gelmez.</p>
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
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => onOpenCandidate?.(ep.candidate_id)}
                    >
                      {ep.candidate_id?.slice(0, 8) || '…'}
                    </button>
                  </td>
                  <td>{ep.employer_title || '—'}</td>
                  <td>{fmt(ep.ended_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Personel kaydı yeniden açılsın mı? Belgeler silinmiş olabilir.')) {
                          act(`employment:${ep.id}`, 'restore');
                        }
                      }}
                    >
                      {busy === `employment:${ep.id}:restore` ? '…' : 'Geri al'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
