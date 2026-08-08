// lib/ratings.js — aday derecelendirme (acente → havuzda herkese açık özet)
import { supabase } from './supabase';

export function scoreOf(r) {
  if (!r) return null;
  return Math.round(((Number(r.discipline) + Number(r.communication) + Number(r.rehire)) / 3) * 10) / 10;
}

export async function listRatingStats(candidateIds) {
  const ids = [...new Set((candidateIds || []).filter(Boolean))];
  if (!ids.length) return {};
  // Ham puanlardan hesapla — kırılım (disiplin/iletişim/tekrar) view kolonuna bağlı kalmasın.
  const { data, error } = await supabase
    .from('candidate_ratings')
    .select('candidate_id, discipline, communication, rehire')
    .in('candidate_id', ids);
  if (error) {
    console.warn('rating stats:', error.message);
    return {};
  }
  const buckets = {};
  (data || []).forEach((row) => {
    const id = row.candidate_id;
    if (!buckets[id]) buckets[id] = { d: 0, c: 0, r: 0, n: 0 };
    const b = buckets[id];
    b.d += Number(row.discipline) || 0;
    b.c += Number(row.communication) || 0;
    b.r += Number(row.rehire) || 0;
    b.n += 1;
  });
  const map = {};
  Object.entries(buckets).forEach(([id, b]) => {
    if (!b.n) return;
    const discipline = Math.round((b.d / b.n) * 10) / 10;
    const communication = Math.round((b.c / b.n) * 10) / 10;
    const rehire = Math.round((b.r / b.n) * 10) / 10;
    const avg = Math.round(((discipline + communication + rehire) / 3) * 10) / 10;
    map[id] = { avg, count: b.n, discipline, communication, rehire };
  });
  return map;
}

export async function getMyRating(agencyId, candidateId) {
  if (!agencyId || !candidateId) return null;
  const { data, error } = await supabase
    .from('candidate_ratings')
    .select('discipline, communication, rehire, updated_at')
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  if (error) {
    console.warn('my rating:', error.message);
    return null;
  }
  return data || null;
}

export async function canRateCandidate(candidateId) {
  if (!candidateId) return false;
  const { data, error } = await supabase.rpc('agency_can_rate_candidate', { p_candidate: candidateId });
  if (error) {
    console.warn('can rate:', error.message);
    return false;
  }
  return !!data;
}

export async function saveRating(agencyId, candidateId, { discipline, communication, rehire }) {
  if (!agencyId || !candidateId) throw new Error('missing_ids');
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
  return { discipline: d, communication: c, rehire: r };
}

function clampScore(n) {
  const v = Math.round(Number(n));
  if (!(v >= 1 && v <= 5)) throw new Error('invalid_score');
  return v;
}
