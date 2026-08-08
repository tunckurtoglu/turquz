import { useEffect, useMemo, useState } from 'react';
import { listFlights } from '../lib/api';
import { candidateCode } from '../../../lib/candidateCode';
import { withLatinName } from '../../../lib/translit';
import { buildArrivalsHtml } from '../../../cv/buildArrivalsHtml';

// "dd.mm.yyyy hh:mm" veya "dd/mm/yyyy hh:mm" -> { dt, date, time }
function parseDT(s) {
  if (!s) return null;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(s).trim());
  if (!m) return null;
  const [, d, mo, y, h = '0', mi = '0'] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (isNaN(dt)) return null;
  return { dt, date: `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`, time: (m[4] != null) ? `${String(h).padStart(2, '0')}:${mi}` : '' };
}

const FILTERS = [
  { id: 'upcoming', label: 'Yaklaşan' },
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Bu hafta' },
  { id: 'all', label: 'Tümü' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export default function Arrivals({ candidates }) {
  const [flights, setFlights] = useState(null);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => { let a = true; listFlights().then((f) => { if (a) setFlights(f); }); return () => { a = false; }; }, []);

  const byId = useMemo(() => { const m = {}; (candidates || []).forEach((c) => { m[c.user_id] = c; }); return m; }, [candidates]);

  const all = useMemo(() => {
    if (!flights) return null;
    return flights
      .map((f) => {
        const c = byId[f.user_id]; if (!c) return null; // sadece bu sekmedeki (personel) adaylar
        const p = parseDT(f.arrive_at);
        const data = withLatinName(c.data || {});
        const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
        return {
          user_id: f.user_id,
          code: candidateCode(c.nationality, c.reg_no),
          name: name || '—',
          nationality: c.nationality || '—',
          arrival: [f.to_airport, f.to_city].filter(Boolean).join(' · ') || '—',
          terminal: f.terminal ? `T${String(f.terminal).replace(/^t/i, '')}` : '',
          flightNo: f.flight_no || '—',
          airline: f.airline || '',
          dt: p?.dt || null,
          date: p?.date || '—',
          time: p?.time || '—',
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.dt && b.dt ? a.dt - b.dt : a.dt ? -1 : 1));
  }, [flights, byId]);

  const list = useMemo(() => {
    if (!all) return null;
    const now = new Date();
    const t0 = startOfDay(now);
    const weekEnd = new Date(t0); weekEnd.setDate(weekEnd.getDate() + 7);
    const tomorrow = new Date(t0); tomorrow.setDate(tomorrow.getDate() + 1);
    return all.filter((r) => {
      if (filter === 'all') return true;
      if (!r.dt) return false;
      if (filter === 'upcoming') return r.dt >= now;
      if (filter === 'today') return r.dt >= t0 && r.dt < tomorrow;
      if (filter === 'week') return r.dt >= t0 && r.dt < weekEnd;
      return true;
    });
  }, [all, filter]);

  const exportPdf = () => {
    const rows = (list || []).map((r, i) => ({ no: i + 1, code: r.code, name: r.name, nationality: r.nationality, arrival: r.arrival, terminal: r.terminal, date: r.date, time: r.time, flightNo: r.flightNo, airline: r.airline }));
    const sub = FILTERS.find((f) => f.id === filter)?.label || '';
    const html = buildArrivalsHtml(rows, { subtitle: `Filtre: ${sub}`, generatedAt: new Date().toLocaleString('tr-TR') });
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
  };

  const soon = (dt) => {
    if (!dt) return null;
    const h = (dt - Date.now()) / 36e5;
    if (h < 0) return { txt: 'Geçti', c: 'gray' };
    if (h < 24) return { txt: `${Math.round(h)} sa kaldı`, c: 'red' };
    if (h < 72) return { txt: `${Math.ceil(h / 24)} gün`, c: 'gold' };
    return { txt: `${Math.ceil(h / 24)} gün`, c: 'gray' };
  };

  return (
    <div className="arr">
      <div className="arrBar">
        <div className="arrFilters">
          {FILTERS.map((f) => <button key={f.id} className={`arrChip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
        <button className="goldBtn sm" onClick={exportPdf} disabled={!list || !list.length}>🛬 PDF Rapor</button>
      </div>

      {list === null ? (
        <div className="center pad"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty">Bu aralıkta varış kaydı yok. (Uçuş bilgisi olan personeller burada listelenir.)</div>
      ) : (
        <div className="arrTableWrap">
          <table className="arrTable">
            <thead><tr><th>Kod</th><th>Ad Soyad</th><th>Uyruk</th><th>Varış Havalimanı</th><th>Tarih</th><th>Saat</th><th>Uçuş No</th><th>Havayolu</th><th>Durum</th></tr></thead>
            <tbody>
              {list.map((r) => { const s = soon(r.dt); return (
                <tr key={r.user_id}>
                  <td className="b">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.nationality}</td>
                  <td>{r.arrival}{r.terminal ? <span className="muted"> / {r.terminal}</span> : null}</td>
                  <td className="b">{r.date}</td>
                  <td className="b">{r.time}</td>
                  <td>{r.flightNo}</td>
                  <td>{r.airline || '—'}</td>
                  <td>{s ? <span className={`arrTag ${s.c}`}>{s.txt}</span> : '—'}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
