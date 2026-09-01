// lib/favorites.js — acente: işletme + departman shortlist (aday başına tek slot)
import { supabase } from './supabase';

/** Belirli işletme+departman favori aday id'leri (yeniden eskiye). */
export async function listFavoriteCandidateIds(agencyId, employerId, department) {
  if (!agencyId || !employerId || !department) return [];
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
    .eq('department', department)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('favorite ids:', error.message);
    return [];
  }
  return (data || []).map((r) => r.candidate_id);
}

/** Adayın favori slotu (0–1): { employerId, department }[] */
export async function listFavoriteSlots(agencyId, candidateId) {
  if (!agencyId || !candidateId) return [];
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('employer_id, department')
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('favorite slots:', error.message);
    return [];
  }
  if (!data?.employer_id || !data?.department) return [];
  return [{ employerId: data.employer_id, department: data.department }];
}

async function visibleCandidateIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return new Set();
  const { data, error } = await supabase
    .from('candidate_pool')
    .select('user_id')
    .in('user_id', unique);
  if (error) {
    console.warn('favorite visible candidates:', error.message);
    return null;
  }
  return new Set((data || []).map((r) => r.user_id).filter(Boolean));
}

/** Adayın favori olduğu işletme id'leri (benzersiz). */
export async function listFavoriteEmployerIds(agencyId, candidateId) {
  const slots = await listFavoriteSlots(agencyId, candidateId);
  return [...new Set(slots.map((s) => s.employerId))];
}

/** İşletme → benzersiz favori aday sayısı (filtre otel listesi). */
export async function listFavoriteEmployerCounts(agencyId) {
  if (!agencyId) return {};
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('employer_id, candidate_id')
    .eq('agency_id', agencyId);
  if (error) {
    console.warn('favorite employer counts:', error.message);
    return {};
  }
  const visible = await visibleCandidateIds((data || []).map((r) => r.candidate_id));
  const byEmp = new Map();
  (data || []).forEach((r) => {
    if (!r.employer_id || !r.candidate_id || (visible && !visible.has(r.candidate_id))) return;
    if (!byEmp.has(r.employer_id)) byEmp.set(r.employer_id, new Set());
    byEmp.get(r.employer_id).add(r.candidate_id);
  });
  const out = {};
  byEmp.forEach((set, id) => { out[id] = set.size; });
  return out;
}

/** İşletmede departman → aday sayısı + benzersiz toplam kişi. */
export async function listFavoriteDepartmentCounts(agencyId, employerId) {
  if (!agencyId || !employerId) return { departments: [], totalPeople: 0 };
  const { data, error } = await supabase
    .from('agency_favorites')
    .select('department, candidate_id')
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId);
  if (error) {
    console.warn('favorite dept counts:', error.message);
    return { departments: [], totalPeople: 0 };
  }
  const visible = await visibleCandidateIds((data || []).map((r) => r.candidate_id));
  const map = new Map();
  const people = new Set();
  (data || []).forEach((r) => {
    if (!r.department || (visible && !visible.has(r.candidate_id))) return;
    if (!map.has(r.department)) map.set(r.department, new Set());
    map.get(r.department).add(r.candidate_id);
    if (r.candidate_id) people.add(r.candidate_id);
  });
  const departments = [...map.entries()]
    .map(([department, candidateIds]) => ({ department, count: candidateIds.size }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department, 'tr'));
  return { departments, totalPeople: people.size };
}

export async function isFavorited(agencyId, candidateId, employerId = null, department = null) {
  if (!agencyId || !candidateId) return false;
  let q = supabase
    .from('agency_favorites')
    .select('candidate_id')
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
  if (employerId) q = q.eq('employer_id', employerId);
  if (department) q = q.eq('department', department);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) return false;
  return !!data;
}

/** Aynı adayı başka departman/işletmedeyse yeni slota taşır (tek satır). */
export async function addFavorite(agencyId, employerId, department, candidateId) {
  if (!agencyId || !employerId || !department || !candidateId) throw new Error('missing');
  const { error } = await supabase.from('agency_favorites').upsert(
    {
      agency_id: agencyId,
      employer_id: employerId,
      department,
      candidate_id: candidateId,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'agency_id,candidate_id' },
  );
  if (error) throw error;
}

/** department yoksa o işletmedeki tüm departmanlar; employer da yoksa tümü. */
export async function removeFavorite(agencyId, candidateId, employerId = null, department = null) {
  if (!agencyId || !candidateId) throw new Error('missing');
  let q = supabase
    .from('agency_favorites')
    .delete()
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
  if (employerId) q = q.eq('employer_id', employerId);
  if (department) q = q.eq('department', department);
  const { error } = await q;
  if (error) throw error;
}

/** true = eklendi/taşındı, false = aynı slottan çıkarıldı */
export async function toggleFavorite(agencyId, employerId, department, candidateId) {
  if (!agencyId || !employerId || !department || !candidateId) throw new Error('missing');
  const on = await isFavorited(agencyId, candidateId, employerId, department);
  if (on) {
    await removeFavorite(agencyId, candidateId, employerId, department);
    return false;
  }
  await addFavorite(agencyId, employerId, department, candidateId);
  return true;
}

export async function listFavoriteCandidates(agencyId, employerId, department) {
  const ids = await listFavoriteCandidateIds(agencyId, employerId, department);
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
