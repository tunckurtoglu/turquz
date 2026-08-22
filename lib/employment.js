// lib/employment.js
// İstihdam episode: aktif / pending / itiraz / tamamlandı / erken çıkış.
import { supabase } from './supabase';

export function isEmploymentNotif(type) {
  const t = String(type || '');
  return t.startsWith('employment_')
    || t === 'work_start_confirm'
    || t === 'transit_stalled'
    || t === 'rating_required'
    || t === 'rating_remind';
}

/** Acente: bildirimin ilgili adayı (payload veya karşı taraf). */
export async function candidateIdFromNotif(n) {
  if (!n) return null;
  if (n.payload?.candidateId) return n.payload.candidateId;
  const epId = n.payload?.episodeId;
  if (epId) {
    const { data } = await supabase
      .from('employment_episodes')
      .select('candidate_id')
      .eq('id', epId)
      .maybeSingle();
    if (data?.candidate_id) return data.candidate_id;
  }
  return n.ref_user || null;
}

export async function requestEmploymentEnd(candidateId = null, reason = null) {
  const { data, error } = await supabase.rpc('request_employment_end', {
    p_candidate: candidateId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function undoEmploymentEnd(episodeId) {
  const { error } = await supabase.rpc('undo_employment_end', { p_episode: episodeId });
  if (error) throw error;
}

export async function contestEmploymentEnd(episodeId, note = null) {
  const { error } = await supabase.rpc('contest_employment_end', {
    p_episode: episodeId,
    p_note: note,
  });
  if (error) throw error;
}

export async function acceptEmploymentEnd(episodeId) {
  const { error } = await supabase.rpc('accept_employment_end', { p_episode: episodeId });
  if (error) throw error;
}

export async function answerEmploymentTerm(episodeId, answer /* 'ok' | 'problem' */) {
  const { error } = await supabase.rpc('answer_employment_term', {
    p_episode: episodeId,
    p_answer: answer,
  });
  if (error) throw error;
}

export async function getMyEmploymentEpisode() {
  const { data, error } = await supabase.rpc('get_my_employment_episode');
  if (error) { console.warn('Episode okunamadı:', error.message); return null; }
  return data || null;
}

export async function getCandidateEmploymentEpisode(candidateId) {
  if (!candidateId) return null;
  const { data, error } = await supabase.rpc('get_candidate_employment_episode', {
    p_candidate: candidateId,
  });
  if (error) { console.warn('Episode okunamadı:', error.message); return null; }
  return data || null;
}

export async function listFormerStaff(agencyId = null) {
  const { data, error } = await supabase.rpc('list_former_staff', { p_agency: agencyId });
  if (error) { console.warn('Eski personel okunamadı:', error.message); return []; }
  return data || [];
}

export async function listCandidateWorkHistory(candidateId) {
  if (!candidateId) return [];
  const { data, error } = await supabase.rpc('list_candidate_work_history', {
    p_candidate: candidateId,
  });
  if (error) { console.warn('İş geçmişi okunamadı:', error.message); return []; }
  return data || [];
}

export async function scanEmploymentLifecycle() {
  try {
    const { data, error } = await supabase.rpc('scan_employment_lifecycle');
    if (error) throw error;
    try {
      await supabase.rpc('scan_boarding_missed_remind');
    } catch (e) {
      console.warn('boarding missed remind:', e?.message || e);
    }
    try {
      await supabase.functions.invoke('scan-ops', { body: { scan: true, jobs: ['lifecycle_push'] } });
    } catch (e) {
      console.warn('İstihdam push:', e?.message || e);
    }
    return data;
  } catch (e) {
    console.warn('İstihdam taraması:', e?.message || e);
    return null;
  }
}

export async function adminListEmploymentDisputes() {
  const { data, error } = await supabase.rpc('admin_list_employment_disputes');
  if (error) throw error;
  return data || [];
}

export async function adminResolveEmployment(episodeId, decision, note = null) {
  const { error } = await supabase.rpc('admin_resolve_employment', {
    p_episode: episodeId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw error;
}

export async function setWorkStartAt(
  candidateId,
  startDate /* 'YYYY-MM-DD' */,
  flightDepart = null,
  endDate = null /* 'YYYY-MM-DD' — null → sunucu +1 yıl */,
) {
  const { error } = await supabase.rpc('agency_set_work_start', {
    p_candidate: candidateId,
    p_start: startDate,
    p_flight_depart: flightDepart,
    p_end: endDate,
  });
  if (error) throw error;
}

/** Acente: işe başladı → personel (in_transit → hired). */
export async function confirmHire(candidateId) {
  const { error } = await supabase.rpc('agency_confirm_hire', { p_candidate: candidateId });
  if (error) throw error;
}

/** Acente: henüz başlamadı → yeni işe başlama tarihi. */
export async function deferWorkStart(candidateId, startDate) {
  const { error } = await supabase.rpc('agency_defer_work_start', {
    p_candidate: candidateId,
    p_start: startDate,
  });
  if (error) throw error;
}

export async function answerBoarding(answer /* 'confirmed' | 'missed' */) {
  const { error } = await supabase.rpc('candidate_answer_boarding', { p_answer: answer });
  if (error) {
    const raw = String(error.message || error.code || '');
    if (raw.includes('boarding_too_early')) {
      const e = new Error('boarding_too_early');
      throw e;
    }
    throw error;
  }
}

/** Acente: aday sessiz — geldi / gelmedi. */
export async function agencyAnswerBoarding(candidateId, answer /* 'confirmed' | 'missed' */) {
  const { error } = await supabase.rpc('agency_answer_boarding', {
    p_candidate: candidateId,
    p_answer: answer,
  });
  if (error) throw error;
}

/** endEmployment: geriye uyumlu — artık wipe değil, pending başlatır. */
export async function endEmployment(candidateUserId) {
  return requestEmploymentEnd(candidateUserId, null);
}
