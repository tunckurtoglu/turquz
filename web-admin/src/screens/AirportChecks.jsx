import { useEffect, useMemo, useState } from 'react';
import { adminAirportCheckAction, adminListAirportChecks } from '../lib/api';

const FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'critical', label: 'Acil' },
  { id: 'warning', label: 'Aday henüz gelmedi' },
  { id: 'pending', label: 'Teyit bekleniyor' },
];

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function flightTime(d) {
  if (!d) return 'Saat bilinmiyor';
  try {
    return new Date(d).toLocaleString('tr-TR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return String(d); }
}

function phoneHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `90${digits}`;
  if (digits.startsWith('0')) return `90${digits.slice(1)}`;
  return digits;
}

function stateLabel(row) {
  if (row.airport_status === 'no_response' || row.airport_status === 'missed') return 'Son teyit alınamadı';
  if (row.last_answer === 'not_yet') return 'Henüz havaalanında değil';
  return 'Teyit bekleniyor';
}

export default function AirportChecks({ onOpenCandidate }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    setErr('');
    try {
      setRows(await adminListAirportChecks(300));
    } catch (e) {
      setErr(e?.message || 'Havaalanı uyarıları yüklenemedi');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => filter === 'all' ? rows : rows.filter((r) => r.alert_level === filter),
    [rows, filter],
  );

  const act = async (row, action) => {
    const key = `${row.candidate_id}:${action}`;
    setBusy(key);
    setErr('');
    try {
      await adminAirportCheckAction(row.candidate_id, action, notes[row.candidate_id] || null);
      await load();
    } catch (e) {
      setErr(e?.message || 'İşlem kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const openWhatsapp = (row) => {
    const phone = phoneHref(row.candidate_phone);
    if (!phone) return;
    const text = `Merhaba ${row.candidate_name || ''}, uçuşunuz için havaalanına ulaştınız mı? Lütfen Turquz uygulamasından teyit verin.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    act(row, 'whatsapp_opened');
  };

  return (
    <div className="card">
      <div className="airportOpsHead">
        <div>
          <h2>Havaalanı kontrolü</h2>
          <p className="muted">
            Cevap vermeyen veya henüz havaalanına ulaşamayan adayları takip edin.
            İlk olumsuz cevap uçuşu kaçırıldı olarak işaretlemez.
          </p>
        </div>
        <button type="button" className="ghostBtn" onClick={load} disabled={!!busy}>Yenile</button>
      </div>

      <div className="interventionFilters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ghostBtn ${filter === item.id ? 'on' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}{item.id === 'all' ? ` (${rows.length})` : ''}
          </button>
        ))}
      </div>

      {err ? <div className="err">{err}</div> : null}
      {!filtered.length ? (
        <div className="airportEmpty">
          <strong>Aktif havaalanı uyarısı yok.</strong>
          <span>Yeni bir teyit sorunu oluştuğunda burada görünecek.</span>
        </div>
      ) : (
        <div className="tableWrap">
          <table className="adminTable airportTable">
            <thead>
              <tr>
                <th>Öncelik</th>
                <th>Aday</th>
                <th>Acente</th>
                <th>Uçuş</th>
                <th>Son durum</th>
                <th>Son soru</th>
                <th>Admin işlemi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const phone = phoneHref(row.candidate_phone);
                const critical = row.alert_level === 'critical';
                const actionKey = (action) => `${row.candidate_id}:${action}`;
                return (
                  <tr key={row.candidate_id} className={critical ? 'airportCritical' : ''}>
                    <td>
                      <span className={`badge ${critical ? 'miss' : row.alert_level === 'warning' ? 'warn' : 'ok'}`}>
                        {critical ? 'Acil' : row.alert_level === 'warning' ? 'Uyarı' : 'Bekliyor'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="linkish" onClick={() => onOpenCandidate?.(row.candidate_id)}>
                        {row.candidate_name || '—'}
                      </button>
                      <div className="muted mono">
                        {row.candidate_reg_no != null ? `#${row.candidate_reg_no}` : row.candidate_id}
                      </div>
                    </td>
                    <td>
                      <div>{row.agency_company || '—'}</div>
                      {row.agency_phone ? <div className="muted">{row.agency_phone}</div> : null}
                    </td>
                    <td>
                      <strong>{flightTime(row.flight_depart_at)}</strong>
                      <div className="muted">{row.flight_no || 'Uçuş no yok'}</div>
                      {row.minutes_to_departure > 0 ? (
                        <div className="airportCountdown">T-{row.minutes_to_departure} dk</div>
                      ) : (
                        <div className="muted">Kalkış zamanı geçti</div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${critical ? 'miss' : row.alert_level === 'warning' ? 'warn' : 'ok'}`}>
                        {stateLabel(row)}
                      </span>
                      <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                        {row.remind_count || 0}/4 soru gönderildi
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {row.asked_at ? fmt(row.asked_at) : 'Henüz gönderilmedi'}
                      {row.last_admin_action ? (
                        <div className="airportLastAction">
                          Son işlem: {row.last_admin_action === 'whatsapp_opened' ? 'WhatsApp açıldı' : row.last_admin_action}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="airportActions">
                        <input
                          className="input"
                          placeholder="İç not"
                          value={notes[row.candidate_id] || ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [row.candidate_id]: e.target.value }))}
                        />
                        <div className="airportActionBtns">
                          <button
                            type="button"
                            className="ghostBtn"
                            disabled={!phone || !!busy}
                            title={phone ? 'WhatsApp ile ulaş' : 'Telefon numarası yok'}
                            onClick={() => openWhatsapp(row)}
                          >
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            className="ghostBtn"
                            disabled={!!busy}
                            onClick={() => act(row, 'contacted')}
                          >
                            {busy === actionKey('contacted') ? '…' : 'İlgileniliyor'}
                          </button>
                          <button
                            type="button"
                            className="goldBtn airportResolveBtn"
                            disabled={!!busy}
                            onClick={() => act(row, 'resolved')}
                          >
                            {busy === actionKey('resolved') ? '…' : 'Çözüldü'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
