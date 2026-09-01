import { useEffect, useMemo, useState } from 'react';
import { listFlights } from '../lib/api';
import { parseArriveAt } from '../../../lib/flights';
import { candidateCode } from '../../../lib/candidateCode';
import { withLatinName } from '../../../lib/translit';
import { buildArrivalsHtml } from '../../../cv/buildArrivalsHtml';
import { useLang } from '../i18n.jsx';

const FILTERS = [
  { id: 'today', key: 'arr_today' },
  { id: 'upcoming', key: 'arr_upcoming' },
  { id: 'week', key: 'arr_week' },
  { id: 'all', key: 'arr_all' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export default function Arrivals({ candidates }) {
  const { t, lang } = useLang();
  const [flights, setFlights] = useState(null);
  const [filter, setFilter] = useState('today');

  useEffect(() => { let a = true; listFlights().then((f) => { if (a) setFlights(f); }); return () => { a = false; }; }, []);

  const byId = useMemo(() => { const m = {}; (candidates || []).forEach((c) => { m[c.user_id] = c; }); return m; }, [candidates]);

  const all = useMemo(() => {
    if (!flights) return null;
    return flights
      .map((f) => {
        const c = byId[f.user_id]; if (!c) return null; // sadece bu sekmedeki (personel) adaylar
        const p = parseArriveAt(f.arrive_at);
        const data = withLatinName(c.data || {});
        const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
        const pickupName = String(f.pickup_name || '').trim();
        return {
          user_id: f.user_id,
          code: candidateCode(c.nationality, c.reg_no),
          name: name || '—',
          nationality: c.nationality || '—',
          arrival: [f.to_airport, f.to_city].filter(Boolean).join(' · ') || '—',
          terminal: f.terminal ? `T${String(f.terminal).replace(/^t/i, '')}` : '',
          flightNo: f.flight_no || '—',
          airline: f.airline || '',
          pickupName,
          pickupPhone: String(f.pickup_phone || '').trim(),
          pickupSent: !!f.pickup_sent_at,
          transit: c.arrivalStatus === 'transit' || c.st?.status === 'in_transit',
          airportCheckStatus: c.airport_check_status || c.st?.airport_check_status || '',
          airportCheckAnsweredAt: c.airport_check_answered_at || c.st?.airport_check_answered_at || '',
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
    const rows = (list || []).map((r, i) => ({
      no: i + 1, code: r.code, name: r.name, nationality: r.nationality,
      arrival: r.arrival, terminal: r.terminal, date: r.date, time: r.time,
      flightNo: r.flightNo, airline: r.airline,
      driver: r.pickupName || t('arr_no_driver'),
    }));
    const sub = t(FILTERS.find((f) => f.id === filter)?.key || 'arr_all');
    const html = buildArrivalsHtml(rows, { subtitle: `${t('arr_filter')}: ${sub}`, generatedAt: new Date().toLocaleString(lang || 'tr-TR') });
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
  };

  const soon = (dt) => {
    if (!dt) return null;
    const h = (dt - Date.now()) / 36e5;
    if (h < 0) return { txt: t('arr_past'), c: 'gray' };
    if (h < 24) return { txt: t('arr_hours_left', { n: Math.round(h) }), c: 'red' };
    if (h < 72) return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), c: 'gold' };
    return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), c: 'gray' };
  };

  return (
    <div className="arr">
      <div className="arrBar">
        <div className="arrFilters">
          {FILTERS.map((f) => (
            <button key={f.id} className={`arrChip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
              {t(f.key)}
            </button>
          ))}
        </div>
        <button className="goldBtn sm" onClick={exportPdf} disabled={!list || !list.length}>🛬 {t('arr_pdf')}</button>
      </div>

      {list === null ? (
        <div className="center pad"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty">{t('arr_empty')}</div>
      ) : (
        <div className="arrTableWrap">
          <table className="arrTable">
            <thead>
              <tr>
                <th>{t('arr_col_code')}</th>
                <th>{t('arr_col_name')}</th>
                <th>{t('f_nationality')}</th>
                <th>{t('arr_col_airport')}</th>
                <th>{t('arr_col_date')}</th>
                <th>{t('arr_col_time')}</th>
                <th>{t('flight_f_no')}</th>
                <th>{t('arr_col_airline')}</th>
                <th>{t('arr_driver')}</th>
                <th>{t('arr_col_status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => { const s = soon(r.dt); const missing = !r.pickupName; return (
                <tr key={r.user_id} className={missing ? 'missing' : ''}>
                  <td className="b">{r.code}</td>
                  <td>{r.name}{r.transit ? <span className="muted"> · {t('arr_in_transit')}</span> : null}</td>
                  <td>{r.nationality}</td>
                  <td>{r.arrival}{r.terminal ? <span className="muted"> / {r.terminal}</span> : null}</td>
                  <td className="b">{r.date}</td>
                  <td className="b">{r.time || '—'}</td>
                  <td>{r.flightNo}</td>
                  <td>{r.airline || '—'}</td>
                  <td className={missing ? 'hot' : ''}>{missing ? t('arr_unassigned') : r.pickupName}{r.pickupPhone && !missing ? <span className="muted"> · {r.pickupPhone}</span> : null}</td>
                  <td>
                    {r.airportCheckStatus === 'confirmed' ? (
                      <span className="arrTag green">
                        ✓ {t('airport_check_agency_confirmed') || 'Havaalanına geldi'}
                        {r.airportCheckAnsweredAt ? ` · ${new Date(r.airportCheckAnsweredAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    ) : r.airportCheckStatus === 'missed' || r.airportCheckStatus === 'no_response' ? (
                      <span className="arrTag red">{t('airport_check_agency_late') || 'Uçuşa geç kaldı'}</span>
                    ) : r.airportCheckStatus === 'pending' ? (
                      <span className="arrTag gold">{t('airport_check_agency_pending') || 'Havaalanı teyidi bekleniyor'}</span>
                    ) : s ? (
                      <span className={`arrTag ${s.c}`}>{s.txt}</span>
                    ) : '—'}
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
