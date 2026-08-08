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
