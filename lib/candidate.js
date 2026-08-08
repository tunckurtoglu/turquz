// lib/candidate.js
// Aday durumu (belge yükleme kapısı). Bkz. supabase/migrations/0003_candidate_status.sql
// Belge yükleme yalnızca otel/acenta KABUL edince (docs_unlocked) açılır.
import { supabase } from './supabase';
import { PASSPORT_DEADLINE_DAYS } from './pipeline';

// Teklif sonrası pasaport son tarihi (accepted_at + 10 gün). Döner: { end, days, overdue } | null.
export function passportDeadline(status) {
  if (!status?.accepted_at) return null;
  const end = new Date(new Date(status.accepted_at).getTime() + PASSPORT_DEADLINE_DAYS * 24 * 3600 * 1000);
  const days = Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));
  return { end, days, overdue: days < 0 };
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
  if (!status || status.status !== 'hired') return { hired: false };
  const end = status.work_end_at ? new Date(status.work_end_at) : null;
  const expired = end ? Date.now() >= end.getTime() : false;
  return { hired: true, end, expired };
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
