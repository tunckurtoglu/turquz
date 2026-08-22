// web/src/lib/favorites.js — acente: tek favori listesi (yıldız aç/kapa)
import { supabase } from './supabase';

export async function listFavoriteCandidateIds(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('favorite ids:', error.message);
    return [];
  }
  return (data || []).map((r) => r.candidate_id);
}

export async function isFavorited(agencyId, candidateId) {
  if (!agencyId || !candidateId) return false;
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function addFavorite(agencyId, candidateId) {
  if (!agencyId || !candidateId) throw new Error('missing');
  const { error } = await supabase.from('agency_favorites').upsert(
    {
      agency_id: agencyId,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id,candidate_id' },
  );
  if (error) throw error;
}

export async function removeFavorite(agencyId, candidateId) {
  if (!agencyId || !candidateId) throw new Error('missing');
  const { error } = await supabase
    .from('agency_favorites')
    .delete()
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}

export async function toggleFavorite(agencyId, candidateId) {
  const on = await isFavorited(agencyId, candidateId);
  if (on) {
    await removeFavorite(agencyId, candidateId);
    return false;
  }
  await addFavorite(agencyId, candidateId);
  return true;
}

export async function listFavoriteCandidates(agencyId) {
  const ids = await listFavoriteCandidateIds(agencyId);
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
