// lib/interviews.js
// Mülakat randevusu (Faz 1). Acente slot önerir, aday birini seçer. Slot biçimi: "dd.mm.yyyy hh:mm".
import { supabase } from './supabase';

// Haftanın günleri (0=Pazar ... 6=Cumartesi) — gösterimde dile göre.
const WEEKDAYS = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  kk: ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'],
  ky: ['Жекшемби', 'Дүйшөмбү', 'Шейшемби', 'Шаршемби', 'Бейшемби', 'Жума', 'Ишемби'],
  uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  tk: ['Ýekşenbe', 'Duşenbe', 'Sişenbe', 'Çarşenbe', 'Penşenbe', 'Anna', 'Şenbe'],
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  th: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
};

// Slotlar UTC ISO (mutlak an) saklanır; gösterim CİHAZIN yerel saat dilimine göre yapılır.
// Acente kendi saatiyle girer, aday kendi telefon saatinde görür (otomatik çeviri).
const pad = (n) => String(n).padStart(2, '0');

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
  const p = fromISO(iso);
  if (!p) return '';
  return (WEEKDAYS[lang] || WEEKDAYS.en)[p.dow] || '';
}

// Yerel parçalardan gün adı (acente kurucusunda, henüz ISO yokken).
export function weekdayOfParts(d, m, y, lang = 'tr') {
  if (!(d && m && y)) return '';
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(dt)) return '';
  return (WEEKDAYS[lang] || WEEKDAYS.en)[dt.getDay()] || '';
}

// Gösterim etiketi: "Pazartesi · 12.06.2026 14:30" (yerel saat)
export function slotLabel(iso, lang = 'tr') {
  const p = fromISO(iso);
  if (!p) return String(iso || '');
  const wd = (WEEKDAYS[lang] || WEEKDAYS.en)[p.dow] || '';
  const base = `${p.d}.${p.m}.${p.y} ${p.hhmm}`;
  return wd ? `${wd} · ${base}` : base;
}

// Aynı acente+slot için 3 aday SEÇMİŞSE o slot dolu (grup üst sınırı).
export async function agencyTakenSlots(agencyId) {
  if (!agencyId) return new Set();
  const { data, error } = await supabase
    .from('interviews')
    .select('selected_slot')
    .eq('created_by', agencyId)
    .eq('status', 'scheduled')
    .not('selected_slot', 'is', null);
  if (error) { console.warn('Dolu slotlar okunamadı:', error.message); return new Set(); }
  const counts = {};
  (data || []).forEach((r) => { counts[r.selected_slot] = (counts[r.selected_slot] || 0) + 1; });
  return new Set(Object.keys(counts).filter((s) => counts[s] >= 3));
}

// Acentenin diğer adaylara önerdiği / seçilmiş tüm slotlar (çakışma kontrolü).
export async function agencyBusySlots(agencyId, excludeUserId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('interviews')
    .select('user_id, status, slots, selected_slot')
    .eq('created_by', agencyId)
    .in('status', ['proposed', 'scheduled']);
  if (error) { console.warn('Meşgul slotlar okunamadı:', error.message); return []; }
  const out = [];
  (data || []).forEach((r) => {
    if (excludeUserId && r.user_id === excludeUserId) return;
    if (r.status === 'scheduled' && r.selected_slot) out.push(r.selected_slot);
    else if (r.status === 'proposed' && Array.isArray(r.slots)) out.push(...r.slots);
  });
  return out;
}

// Planlanan/seçilmiş slot başına kaç aday (grup doluluk).
export async function agencyScheduledCounts(agencyId) {
  if (!agencyId) return {};
  const { data, error } = await supabase
    .from('interviews')
    .select('selected_slot')
    .eq('created_by', agencyId)
    .eq('status', 'scheduled')
    .not('selected_slot', 'is', null);
  if (error) return {};
  const counts = {};
  (data || []).forEach((r) => { counts[r.selected_slot] = (counts[r.selected_slot] || 0) + 1; });
  return counts;
}

// Aynı saate ±30 dk içinde başka teklif/randevu varsa 'near'; tam aynıysa 'exact'.
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

// Adayın önerilen slotları için doluluk haritası { slot: kaç aday seçti }. (RPC, RLS-güvenli.)
export async function getSlotAvailability() {
  const { data, error } = await supabase.rpc('slot_availability');
  if (error) { console.warn('Slot doluluğu okunamadı:', error.message); return {}; }
  return data || {};
}

function fromRow(r) {
  if (!r) return null;
  return {
    status: r.status,
    slots: Array.isArray(r.slots) ? r.slots : [],
    selectedSlot: r.selected_slot || '',
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

// Acente: slotları öner (mevcutu sıfırlar, durum 'proposed').
export async function proposeInterview(candidateUserId, slots, agencyId) {
  const row = {
    user_id: candidateUserId,
    created_by: agencyId || null,
    status: 'proposed',
    slots: slots || [],
    selected_slot: null,
    call_extra_secs: 0,
    reminder_24h_sent_at: null,
    reminder_1h_sent_at: null,
    reminder_15m_sent_at: null,
    reminder_5m_sent_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('interviews').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// Aday: bir slot seç. 3-kişi sınırını sunucuda kontrol eder (RPC). Döner: 'ok' | 'full' | 'no_interview'.
export async function selectSlot(candidateUserId, slot) {
  const { data, error } = await supabase.rpc('select_interview_slot', { p_slot: slot });
  if (error) throw error;
  return data; // 'ok' | 'full' | 'no_interview'
}

// TEST: tarih/saat seçmeden anında "scheduled" mülakat kur (görüntülü görüşme testi için).
// Acente + aday aynı odayı görür. Test bitince normal "İptal" ile silinir. CANLI'da kaldırılacak.
export async function forceScheduleForTest(candidateUserId, agencyId) {
  const slot = new Date().toISOString();
  const row = { user_id: candidateUserId, created_by: agencyId || null, status: 'scheduled', slots: [slot], selected_slot: slot, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('interviews').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// Mülakatı iptal et / sil.
export async function cancelInterview(candidateUserId) {
  const { error } = await supabase.from('interviews').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}

/** Aday: proposed daveti reddet (acenteye bildirim DB'de yazılır; push ayrı). */
export async function candidateDeclineInterview() {
  const { error } = await supabase.rpc('candidate_decline_interview');
  if (error) throw error;
}

// Pencere kapandıktan sonra aktif mülakatı "done" yap (yeniden planlamaya izin verir; transcript kalır).
export async function markInterviewDone(candidateUserId) {
  if (!candidateUserId) return;
  const { error } = await supabase
    .from('interviews')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId)
    .eq('status', 'scheduled');
  if (error) throw error;
}
