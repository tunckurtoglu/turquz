// web/src/lib/cvOverride.js
// Acente'nin aday CV'si üzerindeki özel düzenlemeleri (overlay) yönetir.
// Aday profili ve havuz görünümü ASLA değişmez.
import { supabase } from './supabase';

export function normalizePoolCvData(row) {
  const data = { ...(row?.data || {}) };
  if (!String(data.title || '').trim() && row?.title) data.title = row.title;
  return data;
}

export function applyCvOverrides(base, overrides = {}) {
  if (!overrides || typeof overrides !== 'object') return base || {};
  if (!Object.keys(overrides).length) return base || {};
  const out = { ...(base || {}), ...overrides };
  if (Object.prototype.hasOwnProperty.call(overrides, 'title')) {
    out.title = overrides.title == null ? '' : String(overrides.title);
  }
  return out;
}

export async function loadOverride(agencyId, candidateId) {
  if (!agencyId || !candidateId) return {};
  const { data } = await supabase
    .from('agency_cv_overrides')
    .select('overrides')
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId)
    .maybeSingle();
  return data?.overrides || {};
}

export async function saveOverride(agencyId, candidateId, overrides) {
  if (!agencyId || !candidateId) return;
  const { error } = await supabase.from('agency_cv_overrides').upsert(
    { agency_id: agencyId, candidate_id: candidateId, overrides, updated_at: new Date().toISOString() },
    { onConflict: 'agency_id,candidate_id' },
  );
  if (error) throw error;
}

export async function clearOverride(agencyId, candidateId) {
  if (!agencyId || !candidateId) return;
  await supabase.from('agency_cv_overrides')
    .delete()
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
}
