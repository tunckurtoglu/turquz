// Aday → işletme (otel) eşlemesi: sözleşme / episode / tek favori.
import { supabase } from './supabase';

export const EMPLOYER_NONE_KEY = '__none__';

export function normalizeEmployerKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * candidateId → { employerKey, employerLabel, employerId }
 * Öncelik: açık episode.employer_id → episode/contract title → tek favori.
 */
export async function mapCandidateEmployers(agencyId, candidateIds) {
  const ids = [...new Set((candidateIds || []).filter(Boolean))];
  const out = {};
  ids.forEach((id) => {
    out[id] = { employerKey: EMPLOYER_NONE_KEY, employerLabel: null, employerId: null };
  });
  if (!agencyId || !ids.length) return out;

  const [{ data: contracts }, { data: episodes }, { data: employers }, { data: favs }] = await Promise.all([
    supabase.from('contracts').select('user_id, title').in('user_id', ids),
    supabase
      .from('employment_episodes')
      .select('candidate_id, employer_id, employer_title')
      .eq('agency_id', agencyId)
      .in('candidate_id', ids)
      .in('outcome', ['active', 'early_exit_pending', 'disputed']),
    supabase.from('agency_employers').select('id, name, title').eq('agency_id', agencyId),
    supabase.from('agency_favorites').select('candidate_id, employer_id').eq('agency_id', agencyId).in('candidate_id', ids),
  ]);

  const empById = {};
  const empByNorm = {};
  (employers || []).forEach((e) => {
    empById[e.id] = e;
    const nt = normalizeEmployerKey(e.title);
    const nn = normalizeEmployerKey(e.name);
    if (nt) empByNorm[nt] = e;
    if (nn) empByNorm[nn] = empByNorm[nn] || e;
  });

  const contractTitle = {};
  (contracts || []).forEach((c) => {
    if (c.title) contractTitle[c.user_id] = String(c.title).trim();
  });

  const episodeByCand = {};
  (episodes || []).forEach((e) => { episodeByCand[e.candidate_id] = e; });

  const favsByCand = {};
  (favs || []).forEach((f) => {
    if (!favsByCand[f.candidate_id]) favsByCand[f.candidate_id] = [];
    favsByCand[f.candidate_id].push(f.employer_id);
  });

  ids.forEach((id) => {
    const ep = episodeByCand[id];
    let employerId = ep?.employer_id || null;
    let rawTitle = (ep?.employer_title || contractTitle[id] || '').trim() || null;

    if (!employerId && rawTitle) {
      const match = empByNorm[normalizeEmployerKey(rawTitle)];
      if (match) employerId = match.id;
    }

    if (!employerId && !rawTitle) {
      const fids = [...new Set(favsByCand[id] || [])];
      if (fids.length === 1) employerId = fids[0];
    }

    if (employerId && empById[employerId]) {
      const e = empById[employerId];
      out[id] = {
        employerKey: employerId,
        employerLabel: (e.name || e.title || rawTitle || '').trim() || null,
        employerId,
      };
      return;
    }

    if (rawTitle) {
      out[id] = {
        employerKey: `t:${normalizeEmployerKey(rawTitle)}`,
        employerLabel: rawTitle,
        employerId: null,
      };
      return;
    }

    out[id] = { employerKey: EMPLOYER_NONE_KEY, employerLabel: null, employerId: null };
  });

  return out;
}

export function withEmployerFields(rows, map, idKey = 'user_id') {
  return (rows || []).map((r) => {
    const id = r[idKey] ?? r.candidateId ?? r.candidate_id;
    const m = map[id] || { employerKey: EMPLOYER_NONE_KEY, employerLabel: null, employerId: null };
    return {
      ...r,
      employerKey: m.employerKey,
      employerLabel: m.employerLabel,
      employerId: m.employerId,
    };
  });
}

/** Eski personel satırları (employer_title hazır). */
export function withFormerEmployerFields(rows) {
  return (rows || []).map((r) => {
    const raw = (r.employer_title || '').trim();
    if (!raw) {
      return { ...r, employerKey: EMPLOYER_NONE_KEY, employerLabel: null, employerId: r.employer_id || null };
    }
    return {
      ...r,
      employerKey: r.employer_id || `t:${normalizeEmployerKey(raw)}`,
      employerLabel: raw,
      employerId: r.employer_id || null,
    };
  });
}

export async function attachEmployers(agencyId, rows, idKey = 'user_id') {
  const ids = (rows || []).map((r) => r[idKey] ?? r.candidateId ?? r.candidate_id).filter(Boolean);
  const map = await mapCandidateEmployers(agencyId, ids);
  return withEmployerFields(rows, map, idKey);
}

/**
 * SectionList / web grupları için.
 * @returns {{ key, title, data }[]}
 */
export function groupByEmployer(rows, { noneLabel = 'İşletme atanmamış' } = {}) {
  const buckets = new Map();
  (rows || []).forEach((r) => {
    const key = r.employerKey || EMPLOYER_NONE_KEY;
    const title = key === EMPLOYER_NONE_KEY ? noneLabel : (r.employerLabel || noneLabel);
    if (!buckets.has(key)) buckets.set(key, { key, title, data: [] });
    buckets.get(key).data.push(r);
  });
  const sections = [...buckets.values()];
  sections.sort((a, b) => {
    if (a.key === EMPLOYER_NONE_KEY) return 1;
    if (b.key === EMPLOYER_NONE_KEY) return -1;
    return String(a.title).localeCompare(String(b.title), 'tr', { sensitivity: 'base' });
  });
  return sections;
}
