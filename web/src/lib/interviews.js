// Web mülakat katmanı — mobil lib/interviews & lib/livekitCall ile AYNI tablolar/RPC.
import { supabase } from './supabase';

export const CALL_MINUTES = 10;
export const CALL_MINUTES_MAX = 25;
export const EXTEND_SECS = 300;
export const REJOIN_GRACE_SECS = 120;
const JOIN_BEFORE_MIN = 0; // katılım slot saatinden kaç dk önce açılsın (0 = tam saatte)
export const JOIN_PERIOD_MIN = CALL_MINUTES; // geriye uyumluluk
const FORCE_JOINABLE = false;

export function minutesForPeerCount(n) {
  const c = Number(n) || 1;
  if (c >= 3) return 25;
  if (c === 2) return 20;
  return CALL_MINUTES;
}

const pad = (n) => String(n).padStart(2, '0');
const LOCALE = { tr: 'tr-TR', en: 'en-US', ru: 'ru-RU', kk: 'kk-KZ', ky: 'ky-KG', uz: 'uz-UZ', tk: 'tk-TM', de: 'de-DE', th: 'th-TH', fa: 'fa-IR' };

// Yerel parçalar (acente cihazı) -> UTC ISO
export function toISO(d, m, y, hhmm) {
  const [H, M] = String(hhmm || '').split(':').map(Number);
  return new Date(Number(y), Number(m) - 1, Number(d), H || 0, M || 0, 0, 0).toISOString();
}
// UTC ISO -> yerel parçalar (gösteren cihaz). Eski "gg.aa.yyyy ss:dd" biçimini de destekler.
export function fromISO(iso) {
  if (!iso) return null;
  const old = /^(\d{2})\.(\d{2})\.(\d{4})[ ](\d{2}):(\d{2})/.exec(String(iso));
  const dt = old
    ? new Date(Number(old[3]), Number(old[2]) - 1, Number(old[1]), Number(old[4]), Number(old[5]))
    : new Date(iso);
  if (isNaN(dt)) return null;
  return { d: pad(dt.getDate()), m: pad(dt.getMonth() + 1), y: String(dt.getFullYear()), hhmm: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`, dow: dt.getDay(), dt };
}
export function slotMs(iso) {
  const p = fromISO(iso);
  return p?.dt ? p.dt.getTime() : NaN;
}
export function formatCountdown(ms) {
  if (!(ms > 0)) return '00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}g ${h}s ${String(m).padStart(2, '0')}dk`;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function slotDateKey(iso) { const p = fromISO(iso); return p ? `${p.d}.${p.m}.${p.y}` : ''; }
export function slotTime(iso) { const p = fromISO(iso); return p ? p.hhmm : ''; }

export function weekdayOf(iso, lang = 'tr') {
  const p = fromISO(iso); if (!p) return '';
  try { return p.dt.toLocaleDateString(LOCALE[lang] || 'en-US', { weekday: 'long' }); } catch { return ''; }
}
export function weekdayOfParts(d, m, y, lang = 'tr') {
  if (!(d && m && y)) return '';
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(dt)) return '';
  try { return dt.toLocaleDateString(LOCALE[lang] || 'en-US', { weekday: 'long' }); } catch { return ''; }
}
export function slotLabel(iso, lang = 'tr') {
  const p = fromISO(iso); if (!p) return String(iso || '');
  const wd = weekdayOf(iso, lang);
  const base = `${p.d}.${p.m}.${p.y} ${p.hhmm}`;
  return wd ? `${wd} · ${base}` : base;
}

// Katılım penceresi: slot ↔ slot + minutes + extra (+ grace).
export function callWindow(slotISO, opts = {}) {
  const p = fromISO(slotISO);
  if (!p) return { joinable: false, start: null, end: null, base: null, ended: true };
  const minutes = opts.minutes ?? CALL_MINUTES;
  const extraSecs = opts.extraSecs ?? 0;
  const graceSecs = opts.graceSecs ?? REJOIN_GRACE_SECS;
  const base = p.dt.getTime();
  const start = base - JOIN_BEFORE_MIN * 60 * 1000;
  const end = base + minutes * 60 * 1000 + extraSecs * 1000;
  const now = Date.now();
  const joinable = FORCE_JOINABLE || (now >= start && now <= end + graceSecs * 1000);
  return { joinable, start, end, base, ended: now > end + graceSecs * 1000, minutes, extraSecs };
}

export function callEndAtMs(slotISO, opts = {}) {
  const win = callWindow(slotISO, { ...opts, graceSecs: 0 });
  if (win.end) return win.end;
  return Date.now() + (opts.minutes ?? CALL_MINUTES) * 60 * 1000;
}

export function callRemainingSecs(slotISO, opts = {}) {
  return Math.max(0, Math.ceil((callEndAtMs(slotISO, opts) - Date.now()) / 1000));
}

export async function getCallWindowOpts(interview) {
  const extraSecs = Number(interview?.callExtraSecs) || 0;
  if (!interview?.selectedSlot || !interview?.createdBy) {
    return { minutes: CALL_MINUTES, extraSecs };
  }
  try {
    const { count } = await supabase
      .from('interviews')
      .select('user_id', { count: 'exact', head: true })
      .eq('created_by', interview.createdBy)
      .eq('status', 'scheduled')
      .eq('selected_slot', interview.selectedSlot);
    return { minutes: minutesForPeerCount(count || 1), extraSecs };
  } catch {
    return { minutes: CALL_MINUTES, extraSecs };
  }
}

export async function extendInterviewCall(candidateUserId, addSecs = EXTEND_SECS) {
  const { data, error } = await supabase.rpc('extend_interview_call', {
    p_candidate: candidateUserId,
    p_add_secs: addSecs,
  });
  if (error) throw error;
  return data;
}

function fromRow(r) {
  if (!r) return null;
  return {
    status: r.status,
    slots: Array.isArray(r.slots) ? r.slots : [],
    selectedSlot: r.selected_slot || '',
    employerId: r.employer_id || null,
    createdBy: r.created_by || null,
    createdAt: r.created_at || null,
    respondBy: r.respond_by || null,
    noResponseNotifiedAt: r.no_response_notified_at || null,
    callExtraSecs: Number(r.call_extra_secs) || 0,
  };
}

export async function getInterview(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.from('interviews').select('*').eq('user_id', candidateUserId).maybeSingle();
  if (error) { console.warn('Mülakat okunamadı:', error.message); return null; }
  return fromRow(data);
}

// Acente kendi DOLU (3 aday seçmiş) slotları.
export async function agencyTakenSlots(agencyId) {
  if (!agencyId) return new Set();
  const { data, error } = await supabase.from('interviews').select('selected_slot')
    .eq('created_by', agencyId).eq('status', 'scheduled').not('selected_slot', 'is', null);
  if (error) { console.warn(error.message); return new Set(); }
  const counts = {};
  (data || []).forEach((r) => { counts[r.selected_slot] = (counts[r.selected_slot] || 0) + 1; });
  return new Set(Object.keys(counts).filter((s) => counts[s] >= 3));
}

export async function agencyBusySlots(agencyId, excludeUserId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('interviews')
    .select('user_id, status, slots, selected_slot')
    .eq('created_by', agencyId)
    .in('status', ['proposed', 'scheduled']);
  if (error) { console.warn(error.message); return []; }
  const out = [];
  (data || []).forEach((r) => {
    if (excludeUserId && r.user_id === excludeUserId) return;
    if (r.status === 'scheduled' && r.selected_slot) out.push(r.selected_slot);
    else if (r.status === 'proposed' && Array.isArray(r.slots)) out.push(...r.slots);
  });
  return out;
}

export async function agencyScheduledCounts(agencyId) {
  if (!agencyId) return {};
  const { data, error } = await supabase.from('interviews').select('selected_slot')
    .eq('created_by', agencyId).eq('status', 'scheduled').not('selected_slot', 'is', null);
  if (error) return {};
  const counts = {};
  (data || []).forEach((r) => { counts[r.selected_slot] = (counts[r.selected_slot] || 0) + 1; });
  return counts;
}

export const SLOT_BUFFER_MS = 30 * 60 * 1000;
export function slotConflictKind(iso, busyIsos) {
  const t = slotMs(iso);
  if (isNaN(t)) return 'ok';
  let exact = false;
  for (const b of busyIsos || []) {
    const bt = slotMs(b);
    if (isNaN(bt)) continue;
    if (bt === t) { exact = true; continue; }
    if (Math.abs(bt - t) < SLOT_BUFFER_MS) return 'near';
  }
  return exact ? 'exact' : 'ok';
}
export function conflictNeighborLabels(iso, busyIsos, lang = 'tr') {
  const t = slotMs(iso);
  if (isNaN(t)) return null;
  let nearest = null;
  for (const b of busyIsos || []) {
    const bt = slotMs(b);
    if (isNaN(bt) || bt === t) continue;
    const diff = Math.abs(bt - t);
    if (diff < SLOT_BUFFER_MS && (!nearest || diff < nearest.diff)) nearest = { iso: b, bt, diff };
  }
  if (!nearest) return null;
  const earlier = new Date(nearest.bt - SLOT_BUFFER_MS).toISOString();
  const later = new Date(nearest.bt + SLOT_BUFFER_MS).toISOString();
  return { conflict: slotLabel(nearest.iso, lang), earlier: slotLabel(earlier, lang), later: slotLabel(later, lang) };
}

export async function proposeInterview(candidateUserId, slots, agencyId, employerId = null) {
  const { error } = await supabase.rpc('agency_propose_interview', {
    p_candidate: candidateUserId,
    p_employer: employerId,
    p_slots: slots || [],
  });
  if (error) throw error;
}

export async function cancelInterview(candidateUserId) {
  const { error } = await supabase.from('interviews').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}

export async function markInterviewDone(candidateUserId) {
  if (!candidateUserId) return;
  const { error } = await supabase
    .from('interviews')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId)
    .eq('status', 'scheduled');
  if (error) throw error;
}

// TEST: tarih/saat seçmeden anında "scheduled" mülakat kur (görüntülü görüşme testi için).
// Hem acente hem aday aynı odayı görür. Test bitince normal "İptal Et" ile silinir.
export async function forceScheduleForTest(candidateUserId, agencyId) {
  const slot = new Date().toISOString();
  const row = { user_id: candidateUserId, created_by: agencyId || null, status: 'scheduled', slots: [slot], selected_slot: slot, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('interviews').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// Görüşme token'ı (Edge Function). Döner: { token, url, room, role, minutes }.
export async function getCallToken(candidateUserId, lang) {
  const { data, error } = await supabase.functions.invoke('livekit-token', { body: { candidateUserId, lang } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Mülakat bildirimi (aday tarafına push) — edge function ile.
export async function notifyInterview(candidateUserId, kind) {
  try { await supabase.functions.invoke('notify-interview', { body: { candidateUserId, kind } }); } catch (e) { console.warn('bildirim:', e?.message); }
}
