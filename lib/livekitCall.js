// lib/livekitCall.js
// Mülakat görüntülü görüşmesi yardımcıları (LiveKit). Token'ı Edge Function üretir.
import { supabase } from './supabase';
import { fromISO } from './interviews';

export const CALL_MINUTES = 10;   // 1 aday
export const GROUP_MINUTES = 24;  // grup görüşme
export const CALL_MINUTES_MAX = 25;
export const EXTEND_SECS = 300;   // +5 dk
export const JOIN_BEFORE_MIN = 0; // katılım slot saatinden kaç dk önce açılsın
/** Resmi bitişten sonra yeniden katılım / kısa kopma toleransı (sn). */
export const REJOIN_GRACE_SECS = 120;
/** Geriye uyumluluk: varsayılan pencere = bireysel süre. */
export const JOIN_PERIOD_MIN = CALL_MINUTES;

const FORCE_JOINABLE = false;

export function minutesForPeerCount(n) {
  const c = Number(n) || 1;
  if (c >= 3) return 25;
  if (c === 2) return 20;
  return CALL_MINUTES;
}

/**
 * Katılım / bitiş penceresi.
 * opts.minutes — oda süresi (1/2/3 aday)
 * opts.extraSecs — kalıcı +5 uzatmaları
 * opts.graceSecs — joinable için ekstra tolerans (varsayılan REJOIN_GRACE_SECS); ended için 0 geçilebilir
 */
export function callWindow(slotISO, opts = {}) {
  const p = fromISO(slotISO);
  if (!p?.dt) return { joinable: false, start: null, end: null, base: null, ended: true };
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

/** Aday sayısı + call_extra_secs ile pencere seçenekleri. */
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

/** Acente +5: DB'ye yaz (oda geneli), peer'lara data channel ile duyurulur. */
export async function extendInterviewCall(candidateUserId, addSecs = EXTEND_SECS) {
  const { data, error } = await supabase.rpc('extend_interview_call', {
    p_candidate: candidateUserId,
    p_add_secs: addSecs,
  });
  if (error) throw error;
  return data;
}

// Token al (odaya giriş için). arg = { candidateUserId } (bireysel) VEYA { groupId } (grup).
// lang = kullanıcının uygulama dili (ajan çeviri için kullanır).
export async function getCallToken(arg, lang) {
  const body = typeof arg === 'string' ? { candidateUserId: arg, lang } : { ...arg, lang };
  const { data, error } = await supabase.functions.invoke('livekit-token', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
