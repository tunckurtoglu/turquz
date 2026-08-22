// lib/flights.js
// Uçuş bilgisi (acentenin doldurduğu alanlar). Aday user_id'ye bağlı. PDF bu veriden üretilir.
import { supabase } from './supabase';

// camelCase (uygulama) <-> snake_case (db)
function toRow(f, agencyId) {
  return {
    from_city: f.fromCity || null,
    from_airport: f.fromAirport || null,
    to_city: f.toCity || null,
    to_airport: f.toAirport || null,
    depart_at: f.departAt || null,
    arrive_at: f.arriveAt || null,
    flight_no: f.flightNo || null,
    terminal: f.terminal || null,
    airline: f.airline || null,
    created_by: agencyId || null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(r) {
  if (!r) return null;
  return {
    fromCity: r.from_city || '',
    fromAirport: r.from_airport || '',
    toCity: r.to_city || '',
    toAirport: r.to_airport || '',
    departAt: r.depart_at || '',
    arriveAt: r.arrive_at || '',
    flightNo: r.flight_no || '',
    terminal: r.terminal || '',
    airline: r.airline || '',
    // Havaalanı karşılama
    pickupName: r.pickup_name || '',
    pickupPhone: r.pickup_phone || '',
    pickupSent: !!r.pickup_sent_at,
  };
}

export async function getFlight(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.from('flights').select('*').eq('user_id', candidateUserId).maybeSingle();
  if (error) { console.warn('Uçuş bilgisi okunamadı:', error.message); return null; }
  return fromRow(data);
}

/** Acente: tüm uçuş satırları (varış listesi). */
export async function listFlights() {
  const { data, error } = await supabase.from('flights')
    .select('user_id, from_city, from_airport, to_city, to_airport, depart_at, arrive_at, flight_no, terminal, airline, pickup_name, pickup_phone, pickup_sent_at');
  if (error) { console.warn('Uçuş listesi okunamadı:', error.message); return []; }
  return data || [];
}

/** "18.08.2026 14:30" / "18/08/2026" → { dt, date, time, ymd } */
export function parseArriveAt(s) {
  if (!s) return null;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(s).trim());
  if (!m) return null;
  const [, d, mo, y, h = '0', mi = '0'] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (Number.isNaN(dt.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return {
    dt,
    date: `${p(Number(d))}.${p(Number(mo))}.${y}`,
    time: m[4] != null ? `${p(Number(h))}:${mi}` : '',
    ymd: `${y}-${p(Number(mo))}-${p(Number(d))}`,
  };
}

/** ymd `2026-08-18` + `14:30` → `18.08.2026 14:30` (parseArriveAt ile aynı biçim) */
export function formatArriveAt(ymd, hm) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return '';
  const p = (n) => String(n).padStart(2, '0');
  const date = `${p(Number(d))}.${p(Number(m))}.${y}`;
  return hm ? `${date} ${hm}` : date;
}

/** Iniş anına kalan ms (0 = geldi veya tarih yok). */
export function msUntilArrival(arriveAt, nowMs = Date.now()) {
  const p = parseArriveAt(arriveAt);
  if (!p?.dt) return 0;
  const left = p.dt.getTime() - (Number(nowMs) || Date.now());
  return left > 0 ? left : 0;
}

/** YYYY-MM-DD günü (yerel gece yarısı) gelene kalan ms. */
export function msUntilYmdGate(ymd, nowMs = Date.now()) {
  if (!ymd) return 0;
  const [y, m, day] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return 0;
  const gate = new Date(y, m - 1, day, 0, 0, 0, 0).getTime();
  const left = gate - (Number(nowMs) || Date.now());
  return left > 0 ? left : 0;
}

export function isYmdDue(ymd, nowMs = Date.now()) {
  return !!ymd && msUntilYmdGate(ymd, nowMs) === 0;
}

export async function saveFlight(candidateUserId, fields, agencyId) {
  const row = { user_id: candidateUserId, ...toRow(fields, agencyId) };
  const { error } = await supabase.from('flights').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Varışlar / karşılama hatırlatması için iniş anı. Diğer uçuş alanlarını silmez. */
export async function saveArrival(candidateUserId, arriveAt, agencyId) {
  if (!candidateUserId) return;
  const { error } = await supabase.from('flights').upsert(
    {
      user_id: candidateUserId,
      arrive_at: arriveAt || null,
      created_by: agencyId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function deleteFlight(candidateUserId) {
  const { error } = await supabase.from('flights').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}

// ---- Havaalanı karşılama (pickup) ----
// Acente karşılayacak kişinin adını + WhatsApp numarasını kaydeder (uçuş satırı yoksa oluşturur).
export async function savePickup(candidateUserId, { pickupName, pickupPhone }, agencyId) {
  const { error } = await supabase.from('flights').upsert(
    { user_id: candidateUserId, pickup_name: pickupName || null, pickup_phone: pickupPhone || null, created_by: agencyId || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' });
  if (error) throw error;
}

// "Adaya Gönder": karşılama bilgisini adaya ilet (trigger zille uyarır; push'u çağıran yapar).
export async function sendPickup(candidateUserId) {
  const { error } = await supabase.from('flights')
    .update({ pickup_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId);
  if (error) throw error;
}
