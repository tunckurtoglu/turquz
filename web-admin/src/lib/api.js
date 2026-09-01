import { supabase } from './supabase';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_e, session) => cb(session)).data.subscription;
}

export async function getRole(userId) {
  if (!userId) return null;
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role || null;
}

/** Acente paneli ile aynı kategori kuralları */
export function categoryOf(st) {
  if (!st) return 'pool';
  if (st.status === 'hired') return 'hired';
  if (st.docs_unlocked || st.status === 'accepted') return 'process';
  if (st.status === 'offered') return 'offered';
  return 'pool';
}

export async function adminListInterventions() {
  const { data, error } = await supabase.rpc('admin_list_interventions');
  if (error) throw error;
  return data || [];
}

export async function adminListAirportChecks(limit = 200) {
  const { data, error } = await supabase.rpc('admin_list_airport_checks', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminAirportCheckAction(candidateId, action, note = null) {
  const { error } = await supabase.rpc('admin_airport_check_action', {
    p_candidate: candidateId,
    p_action: action,
    p_note: note,
  });
  if (error) throw error;
}

export async function adminInterventionAct(queueId, action, note = null, payload = {}) {
  const { error } = await supabase.rpc('admin_intervention_act', {
    p_queue_id: queueId,
    p_action: action,
    p_note: note,
    p_payload: payload,
  });
  if (error) throw error;
}

export async function adminListInterventionLog(limit = 50) {
  const { data, error } = await supabase.rpc('admin_list_intervention_log', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminAnswerBoardingForCandidate(candidateId, answer, note = null) {
  const { error } = await supabase.rpc('admin_answer_boarding_for_candidate', {
    p_candidate: candidateId,
    p_answer: answer,
    p_note: note,
  });
  if (error) throw error;
}

export async function agencyConfirmHire(candidateId) {
  const { error } = await supabase.rpc('agency_confirm_hire', { p_candidate: candidateId });
  if (error) throw error;
}

export async function agencyDeferWorkStart(candidateId, startDate) {
  const { error } = await supabase.rpc('agency_defer_work_start', {
    p_candidate: candidateId,
    p_start: startDate,
  });
  if (error) throw error;
}

export async function agencyAnswerBoarding(candidateId, answer) {
  const { error } = await supabase.rpc('agency_answer_boarding', {
    p_candidate: candidateId,
    p_answer: answer,
  });
  if (error) throw error;
}

export async function adminListEmploymentDisputes() {
  const { data, error } = await supabase.rpc('admin_list_employment_disputes');
  if (error) throw error;
  return data || [];
}

export async function adminListEmploymentClosed(days = 90) {
  const { data, error } = await supabase.rpc('admin_list_employment_closed', { p_days: days });
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

export async function adminListProcessOps(limit = 200, candidateId = null, agencyId = null, eventType = null) {
  const { data, error } = await supabase.rpc('admin_list_process_ops', {
    p_limit: limit,
    p_candidate: candidateId,
    p_agency: agencyId,
    p_event: eventType || null,
  });
  if (error) throw error;
  return data || [];
}

export async function adminListProcessChats(limit = 200) {
  const { data, error } = await supabase.rpc('admin_list_process_chats', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminListProcessChatMessages(chatId) {
  const { data, error } = await supabase.rpc('admin_list_process_chat_messages', { p_chat: chatId });
  if (error) throw error;
  return data || [];
}

export async function adminDeleteProcessChat(chatId) {
  const { error } = await supabase.rpc('admin_delete_process_chat', { p_chat: chatId });
  if (error) throw error;
}

export async function adminStats() {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  return data || { agencies: 0, candidates: 0, hotels: 0, admins: 0 };
}

export async function listAgencies() {
  const { data, error } = await supabase.rpc('admin_list_agencies');
  if (error) throw error;
  return data || [];
}

export async function getAgency(userId) {
  const { data, error } = await supabase.rpc('admin_get_agency', { p_user: userId });
  if (error) throw error;
  return data;
}

export async function listAgencyCandidates(agencyUserId) {
  const { data, error } = await supabase.rpc('admin_list_agency_candidates', { p_agency: agencyUserId });
  if (error) throw error;
  return data || [];
}

export async function listCandidates() {
  const { data, error } = await supabase.rpc('admin_list_candidates');
  if (error) throw error;
  return data || [];
}

export async function getCandidate(userId) {
  const { data, error } = await supabase.rpc('admin_get_candidate', { p_user: userId });
  if (error) throw error;
  return data;
}

/** Storage klasörünü temizle (best-effort), sonra auth kullanıcısını sil. */
export async function deleteUserFully(userId, { kind } = {}) {
  if (!userId) throw new Error('missing');

  // Belgeler
  try {
    const { data: docs } = await supabase.storage.from('documents').list(userId, { limit: 200 });
    if (docs?.length) {
      await supabase.storage.from('documents').remove(docs.map((f) => `${userId}/${f.name}`));
    }
  } catch (e) {
    console.warn('documents temizliği:', e?.message);
  }

  // Acente vergi levhası
  if (kind === 'agency') {
    try {
      const { data: files } = await supabase.storage.from('agency-docs').list(userId, { limit: 50 });
      if (files?.length) {
        await supabase.storage.from('agency-docs').remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (e) {
      console.warn('agency-docs temizliği:', e?.message);
    }
  }

  const { data, error } = await supabase.rpc('admin_delete_user', { p_user: userId });
  if (error) throw error;
  return data;
}

export async function signedUrl(bucket, path, expires = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
  if (error) throw error;
  return data?.signedUrl || null;
}

const CERT_BUCKET = 'certificate-awards';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      resolve(raw.includes(',') ? raw.split(',')[1] : raw);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function certSnapshotFromDetail(detail, episode) {
  const cv = detail?.data || {};
  return {
    candidateName: detail?.full_name || [cv.firstName, cv.lastName].filter(Boolean).join(' '),
    employerTitle: episode?.employer_title || episode?.employer_name,
    position: episode?.position,
    startAt: episode?.work_start_at || episode?.hired_at,
    endAt: episode?.ended_at,
  };
}

/** Admin: PDF oluştur, kalıcı kayda al, e-posta + bildirim gönder. */
export async function generateAndPublishSuccessCertificate(userId, detail) {
  if (!userId || !detail) throw new Error('missing');
  const { completedEpisodeFromDetail, certificatePdfBlobFromDetail } = await import('./successCertificate');
  const episode = completedEpisodeFromDetail(detail);
  if (!episode?.id) throw new Error('completed_episode_required');
  const blob = await certificatePdfBlobFromDetail(detail);
  const pdfBase64 = await blobToBase64(blob);
  const snapshot = certSnapshotFromDetail(detail, episode);
  const { data, error } = await supabase.functions.invoke('admin-issue-certificate', {
    body: { episodeId: episode.id, candidateUserId: userId, pdfBase64, snapshot },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listPendingCertificates(limit = 200) {
  const { data, error } = await supabase.rpc('admin_list_pending_certificates', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function removeSuccessCertificate(userId, awardId = null) {
  if (!userId && !awardId) throw new Error('missing');
  let award = null;
  if (awardId) {
    const { data } = await supabase.from('certificate_awards').select('id, storage_path, candidate_id').eq('id', awardId).maybeSingle();
    award = data;
  } else {
    const { data } = await supabase
      .from('certificate_awards')
      .select('id, storage_path, candidate_id')
      .eq('candidate_id', userId)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    award = data;
  }
  if (!award?.id) {
    // Eski user_documents taslağı varsa temizle
    const { data: row } = await supabase
      .from('user_documents')
      .select('storage_path')
      .eq('user_id', userId)
      .eq('kind', 'success_certificate')
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from('documents').remove([row.storage_path]).catch(() => {});
    }
    await supabase.from('user_documents').delete().eq('user_id', userId).eq('kind', 'success_certificate');
    return;
  }
  if (award.storage_path) {
    await supabase.storage.from(CERT_BUCKET).remove([award.storage_path]).catch(() => {});
  }
  const { error } = await supabase.rpc('admin_revoke_certificate', { p_award: award.id });
  if (error) throw error;
}

export async function signedCertificateUrl(path, expires = 3600) {
  return signedUrl(CERT_BUCKET, path, expires);
}

/** Admin: adayın tüm acente puanları */
export async function listCandidateRatings(candidateId) {
  if (!candidateId) return [];
  const { data, error } = await supabase.rpc('admin_list_candidate_ratings', { p_candidate: candidateId });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

/** Admin: puan güncelle / oluştur */
export async function adminSaveRating(agencyId, candidateId, { discipline, communication, rehire }) {
  const d = clampScore(discipline);
  const c = clampScore(communication);
  const r = clampScore(rehire);
  const { error } = await supabase.from('candidate_ratings').upsert(
    {
      agency_id: agencyId,
      candidate_id: candidateId,
      discipline: d,
      communication: c,
      rehire: r,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id,candidate_id' },
  );
  if (error) throw error;
}

/** Admin: puan sil */
export async function adminDeleteRating(agencyId, candidateId) {
  const { error } = await supabase
    .from('candidate_ratings')
    .delete()
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!(v >= 1 && v <= 5)) throw new Error('Puan 1–5 olmalı');
  return v;
}

/** Admin: duyuru yayınla (bildirim + push) */
export async function sendAnnouncement({ title, body, audience = 'all', userIds = [] }) {
  const { data, error } = await supabase.functions.invoke('admin-announce', {
    body: { title, body, audience, userIds },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data || {};
}

/** Admin: son duyurular */
export async function listAnnouncements(limit = 30) {
  const { data, error } = await supabase.rpc('admin_list_announcements', { p_limit: limit });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
