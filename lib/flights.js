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
  };
}

export async function getFlight(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.from('flights').select('*').eq('user_id', candidateUserId).maybeSingle();
  if (error) { console.warn('Uçuş bilgisi okunamadı:', error.message); return null; }
  return fromRow(data);
}

export async function saveFlight(candidateUserId, fields, agencyId) {
  const row = { user_id: candidateUserId, ...toRow(fields, agencyId) };
  const { error } = await supabase.from('flights').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteFlight(candidateUserId) {
  const { error } = await supabase.from('flights').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}
