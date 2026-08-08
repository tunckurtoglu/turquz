// lib/favorites.js — acente: işletme bazlı favori listeleri
import { supabase } from './supabase';

/** agency_id için tüm favoriler: { candidateId: employerId[] } */
export async function listFavoriteMap(agencyId) {
  if (!agencyId) return {};
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id, employer_id, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('favorites map:', error.message);
    return {};
  }
  const map = {};
  (data || []).forEach((r) => {
    if (!map[r.candidate_id]) map[r.candidate_id] = [];
    map[r.candidate_id].push(r.employer_id);
  });
  return map;
}

/** Bir işletmenin favori aday id'leri (yeniden eskiye). */
export async function listFavoriteCandidateIds(agencyId, employerId) {
  if (!agencyId || !employerId) return [];
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('favorite ids:', error.message);
    return [];
  }
  return (data || []).map((r) => r.candidate_id);
}

/** İşletme başına favori sayısı: { employerId: n } */
export async function countFavoritesByEmployer(agencyId) {
  if (!agencyId) return {};
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('employer_id')
    .eq('agency_id', agencyId);
  if (error) {
    console.warn('favorite counts:', error.message);
    return {};
  }
  const map = {};
  (data || []).forEach((r) => {
    map[r.employer_id] = (map[r.employer_id] || 0) + 1;
  });
  return map;
}

export async function isFavorited(agencyId, employerId, candidateId) {
  if (!agencyId || !employerId || !candidateId) return false;
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function addFavorite(agencyId, employerId, candidateId) {
  if (!agencyId || !employerId || !candidateId) throw new Error('missing');
  const { error } = await supabase.from('agency_favorites').upsert(
    {
      agency_id: agencyId,
      employer_id: employerId,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id,employer_id,candidate_id' },
  );
  if (error) throw error;
}

export async function removeFavorite(agencyId, employerId, candidateId) {
  if (!agencyId || !employerId || !candidateId) throw new Error('missing');
  const { error } = await supabase
    .from('agency_favorites')
    .delete()
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}

/** Varsa çıkar, yoksa ekle. Döner: true = eklendi, false = çıkarıldı */
export async function toggleFavorite(agencyId, employerId, candidateId) {
  const on = await isFavorited(agencyId, employerId, candidateId);
  if (on) {
    await removeFavorite(agencyId, employerId, candidateId);
    return false;
  }
  await addFavorite(agencyId, employerId, candidateId);
  return true;
}

/** Favori adayların pool satırları. */
export async function listFavoriteCandidates(agencyId, employerId) {
  const ids = await listFavoriteCandidateIds(agencyId, employerId);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at')
    .in('user_id', ids);
  if (error) {
    console.warn('favorite candidates:', error.message);
    return [];
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return (data || []).sort((a, b) => (order.get(a.user_id) ?? 0) - (order.get(b.user_id) ?? 0));
}
