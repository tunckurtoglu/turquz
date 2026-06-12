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
  return { d: pad(dt.getDate()), m: pad(dt.getMonth() + 1), y: String(dt.getFullYear()), hhmm: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`, dow: dt.getDay() };
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

// Acentenin DOLU (artık önerilemez) slotları: aynı acente+slot için 3 aday SEÇMİŞSE o slot dolu.
// (Birden fazla aday aynı slotu seçebilir; 3 dolunca yenisine kapanır.)
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

// Mülakatı iptal et / sil.
export async function cancelInterview(candidateUserId) {
  const { error } = await supabase.from('interviews').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}
