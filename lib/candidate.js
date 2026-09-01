// lib/candidate.js
// Aday durumu (belge yükleme kapısı). Bkz. supabase/migrations/0003_candidate_status.sql
// Belge yükleme yalnızca otel/acenta KABUL edince (docs_unlocked) açılır.
import { supabase } from './supabase';
import { PASSPORT_DEADLINE_DAYS } from './pipeline';

/** Kalan süre: "X gün, Y saat, Z dakika, J saniye kaldı" (i18n: deadline_remain). */
export function formatDeadlineRemain(ms, t) {
  if (typeof t !== 'function') {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${d} gün, ${h} saat, ${m} dakika, ${s} saniye kaldı`;
  }
  if (!(Number(ms) > 0)) return t('deadline_overdue_short');
  const total = Math.floor(Number(ms) / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return t('deadline_remain', { d: String(d), h: String(h), m: String(m), s: String(s) });
}

/** @deprecated Use formatDeadlineRemain — eski HH:MM:SS uyumluluğu. */
export function formatDeadlineClock(ms) {
  return formatDeadlineRemain(ms);
}

// İlk belge paketi son tarihi. docs_deadline_at varsa onu kullanır (ek süre).
// Döner: { end, days, ms, overdue, extraRequested, agencyExtra } | null.
export function passportDeadline(status) {
  if (!status?.docs_deadline_at && !status?.accepted_at) return null;
  const end = status.docs_deadline_at
    ? new Date(status.docs_deadline_at)
    : new Date(new Date(status.accepted_at).getTime() + PASSPORT_DEADLINE_DAYS * 24 * 3600 * 1000);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 3600 * 1000));
  return {
    end,
    days,
    ms,
    overdue: ms < 0,
    extraRequested: !!status.docs_extra_requested_at,
    agencyExtra: !!status.docs_agency_extra_at,
  };
}

/** Konsolosluk ref süresi (imzalı sözleşmeden sonra 7 gün + ek). */
export function consulateDeadline(status) {
  if (!status?.consulate_deadline_at) return null;
  const end = new Date(status.consulate_deadline_at);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return {
    end,
    days: Math.ceil(ms / (24 * 3600 * 1000)),
    ms,
    overdue: ms < 0,
    agencyExtra: !!status.consulate_agency_extra_at,
  };
}

export async function requestDocsExtraTime() {
  const { data, error } = await supabase.rpc('request_docs_extra_time');
  if (error) throw error;
  return data;
}

/** Acente: docs | consulate için +3 gün. */
export async function agencyGrantDeadlineExtra(candidateUserId, scope) {
  const { data, error } = await supabase.rpc('agency_grant_deadline_extra', {
    p_candidate: candidateUserId,
    p_scope: scope,
  });
  if (error) throw error;
  return data;
}

/** Acente: süreci sonlandır + sebep log (docs_deadline | consulate_deadline | agency_cancel | offer_withdraw). */
export async function agencyEndProcess(candidateUserId, reason, note = null) {
  const { error } = await supabase.rpc('agency_end_process', {
    p_candidate: candidateUserId,
    p_reason: reason,
    p_note: note,
  });
  if (error) throw error;
}

export async function getCandidateStatus(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('candidate_status')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('Aday durumu okunamadı:', error.message);
    return null;
  }
  return data;
}

// Aday tekrar çalışmaya hazır: süreci sıfırla, havuza dön (CV kalır). RPC (security definer).
export async function reactivateCandidate() {
  const { error } = await supabase.rpc('reactivate_candidate');
  if (error) throw error;
}

// Personel mi (işe alındı) + çalışma durumu. status='hired'; work_end_at geçtiyse "süre doldu".
export function workInfo(status) {
  if (!status) return { hired: false, inTransit: false };
  if (status.status === 'hired') {
    const end = status.work_end_at ? new Date(status.work_end_at) : null;
    const expired = end ? Date.now() >= end.getTime() : false;
    return { hired: true, inTransit: false, end, expired };
  }
  if (status.status === 'in_transit') {
    return { hired: false, inTransit: true, end: null, expired: false };
  }
  return { hired: false, inTransit: false };
}

// Aşamayı ayarla (acenta/admin; RLS staff update politikası gerekir).
export async function setStage(userId, stage) {
  const { error } = await supabase
    .from('candidate_status')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
}

// Satır yoksa veya aşama 0 ise kilitli; aşama >= 1 (veya eski docs_unlocked) ise açık.
export function docsUnlocked(status) {
  return getStage(status) >= 1;
}

// Adayın bulunduğu göç hattı aşaması. Eski kayıtlar (stage yok ama docs_unlocked=true) -> 1.
export function getStage(status) {
  if (!status) return 0;
  if (typeof status.stage === 'number') return status.stage;
  return status.docs_unlocked ? 1 : 0;
}
