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
    .select('user_id, from_city, from_airport, to_city, to_airport, depart_at, arrive_at, flight_no, terminal, airline');
  if (error) { console.warn('Uçuş listesi okunamadı:', error.message); return []; }
  return data || [];
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
