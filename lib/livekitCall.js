// lib/livekitCall.js
// Mülakat görüntülü görüşmesi yardımcıları (LiveKit). Token'ı Edge Function üretir.
import { supabase } from './supabase';
import { fromISO } from './interviews';

export const CALL_MINUTES = 10;   // bireysel görüşme sayacı
export const GROUP_MINUTES = 24;  // grup görüşme sayacı
export const JOIN_PERIOD_MIN = 30; // SABİT periyot: slot saatinden 30 dk sonra katılım kapanır (süre ne olursa olsun)

// Görüşmeye katılım penceresi: slot - 5 dk  ↔  slot + 30 dk (sabit periyot).
// Görüşme erken bitse de, uzun sürse de bu 30 dk dolunca "Görüşmeye Katıl" kaybolur.
// TEST: true iken katılım penceresi yok sayılır, buton her zaman görünür.
// CANLI ÖNCESİ tekrar false yap.
const FORCE_JOINABLE = true;

export function callWindow(slotISO) {
  const p = fromISO(slotISO);
  if (!p) return { joinable: false, start: null, end: null };
  const base = new Date(Number(p.y), Number(p.m) - 1, Number(p.d), Number(p.hhmm.split(':')[0]), Number(p.hhmm.split(':')[1])).getTime();
  const start = base - 5 * 60 * 1000;
  const end = base + JOIN_PERIOD_MIN * 60 * 1000;
  const now = Date.now();
  return { joinable: FORCE_JOINABLE || (now >= start && now <= end), start, end, base };
}

// Token al (odaya giriş için). arg = { candidateUserId } (bireysel) VEYA { groupId } (grup).
// lang = kullanıcının uygulama dili (ajan çeviri için kullanır). Döner: { token, url, room, role }.
export async function getCallToken(arg, lang) {
  const body = typeof arg === 'string' ? { candidateUserId: arg, lang } : { ...arg, lang };
  const { data, error } = await supabase.functions.invoke('livekit-token', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
