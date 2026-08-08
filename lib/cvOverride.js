// lib/cvOverride.js
// Acentenin aday CV'si üzerindeki özel düzenlemeler (overlay).
// Aday profili ve havuz görünümü ASLA değişmez.
import { supabase } from './supabase';

// Havuz satırında ünvan hem profiles.title kolonunda hem data.title içinde olabilir.
// CV builder yalnız data.title okur — kolonu data'ya doldur.
export function normalizePoolCvData(row) {
  const data = { ...(row?.data || {}) };
  if (!String(data.title || '').trim() && row?.title) data.title = row.title;
  return data;
}

// Overlay'i taban CV'nin üstüne giydir (title dahil bilinen alanlar açıkça).
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
  const { error } = await supabase.from('agency_cv_overrides')
    .delete()
    .eq('agency_id', agencyId)
    .eq('candidate_id', candidateId);
  if (error) throw error;
}
