// İşletme bazlı personel kadrosu — hired + in_transit, employer_id eşlemesi.
import { listStaff, listInTransit } from './roles';
import { listFormerStaff } from './employment';
import { supabase } from './supabase';
import { mapCandidateEmployers, withEmployerFields, withFormerEmployerFields } from './employerAttach';

/** Tüm acente kadrosunu işletmeye göre grupla + sayaçlar. */
export async function loadAgencyRoster(agencyId) {
  if (!agencyId) return { staffCounts: {}, staffByEmployer: {}, rows: [] };
  const [staff, transit] = await Promise.all([
    listStaff(agencyId),
    listInTransit(agencyId),
  ]);
  const rows = [
    ...(staff || []).map((r) => ({ ...r, rosterStatus: 'active' })),
    ...(transit || []).map((r) => ({ ...r, rosterStatus: 'transit' })),
  ];
  const ids = rows.map((r) => r.user_id).filter(Boolean);
  const map = await mapCandidateEmployers(agencyId, ids);
  const enriched = withEmployerFields(rows, map);
  const staffCounts = {};
  const staffByEmployer = {};
  enriched.forEach((r) => {
    const eid = r.employerId;
    if (!eid) return;
    staffCounts[eid] = (staffCounts[eid] || 0) + 1;
    if (!staffByEmployer[eid]) staffByEmployer[eid] = [];
    staffByEmployer[eid].push(r);
  });
  return { staffCounts, staffByEmployer, rows: enriched };
}

/** Tek işletme kadrosu — RPC varsa kullan, yoksa tam roster'dan filtrele. */
export async function loadEmployerRoster(agencyId, employerId) {
  if (!agencyId || !employerId) return [];
  try {
    const { data, error } = await supabase.rpc('list_roster_by_employer', {
      p_agency: agencyId,
      p_employer: employerId,
    });
    if (!error && Array.isArray(data)) {
      return data.map((r) => ({
        ...r,
        rosterStatus: r.roster_status === 'transit' ? 'transit' : 'active',
      }));
    }
  } catch { /* RPC henüz yok */ }
  const roster = await loadAgencyRoster(agencyId);
  return roster.staffByEmployer?.[employerId] || [];
}

/** Departman seçeneklerine göre personel grupla. */
export function groupRosterByDepartment(rows, deptOptions = []) {
  const buckets = {};
  const other = [];
  (deptOptions || []).forEach((o) => { buckets[o.value] = []; });
  (rows || []).forEach((r) => {
    const title = String(r.title || '').trim();
    const hit = deptOptions.find((o) => o.value === title || o.label === title);
    if (hit) buckets[hit.value].push(r);
    else other.push(r);
  });
  return { buckets, other };
}

/** İşletmedeki eski personel (tamamlanan / erken çıkış). */
export async function loadFormerForEmployer(agencyId, employerId) {
  if (!agencyId || !employerId) return [];
  const rows = await listFormerStaff(agencyId, employerId);
  return withFormerEmployerFields(rows || []).map((r) => ({
    ...r,
    user_id: r.candidate_id,
    rosterStatus: 'former',
  }));
}
