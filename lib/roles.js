// lib/roles.js
// Roller + acente paneli veri erişimi. Bkz. supabase/migrations/0007_roles_agency.sql
import { supabase } from './supabase';

// Mevcut kullanıcının rolü ('candidate' | 'agency' | 'admin'). Satır yoksa 'candidate'.
export async function getRole(userId) {
  if (!userId) return 'candidate';
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('[role] okunamadı (tablo/şema/RLS?):', error.message);
    return 'candidate';
  }
  console.log('[role] tespit edilen:', data?.role || 'candidate (satır yok)');
  return data?.role || 'candidate';
}

// Aday havuzu (acente görür). Sayfalı + arama + filtreler.
// opts: { search, from, to, filters }
//   filters: { ageMin, ageMax, gender, nationalities[], positions[], languages[], skills[] }
// Filtreleri bir sorguya uygular (listCandidates + listCandidateIds ortak kullanır).
function applyCandidateFilters(q, filters = {}) {
  const f = filters || {};
  if (f.codeNation) q = q.eq('nationality', f.codeNation);
  if (f.regNo) q = q.eq('reg_no', f.regNo);
  if (f.gender) q = q.eq('gender', f.gender);
  if (f.nationalities && f.nationalities.length) q = q.in('nationality', f.nationalities);
  if (f.positions && f.positions.length) q = q.overlaps('positions', f.positions);
  if (f.languages && f.languages.length) q = q.overlaps('languages', f.languages);
  if (f.skills && f.skills.length) q = q.overlaps('skills', f.skills);
  const thisYear = new Date().getFullYear();
  if (f.ageMax) q = q.gte('birth_year', thisYear - f.ageMax);
  if (f.ageMin) q = q.lte('birth_year', thisYear - f.ageMin);
  return q;
}

export async function listCandidates({ from = 0, to = 23, filters = {} } = {}) {
  let q = supabase
    .from('candidate_pool') // acente/admin gizli + PII ayıklanmış görünüm
    .select('user_id, title, data, reg_no, nationality, updated_at')
    .order('updated_at', { ascending: false })
    .range(from, to);
  q = applyCandidateFilters(q, filters);
  const { data, error } = await q;
  if (error) {
    console.warn('Aday havuzu okunamadı:', error.message);
    return [];
  }
  return data || [];
}

// Filtreye uyan TÜM adayların yalnızca user_id'leri (toplu "Tümünü Seç" için, hafif sorgu).
export async function listCandidateIds({ filters = {} } = {}) {
  let q = supabase.from('candidate_pool').select('user_id');
  q = applyCandidateFilters(q, filters);
  const { data, error } = await q;
  if (error) {
    console.warn('Aday id listesi okunamadı:', error.message);
    return [];
  }
  return (data || []).map((r) => r.user_id);
}

// Acentenin mülakat teklif ettiği adaylar: proposed (yanıt bekleniyor) + scheduled (mülakata girecek).
// Aday profili (maskeli) ile birleştirir. Döner: [{ ...candidate, ivStatus, ivSlot }]
export async function listInterviewCandidates(agencyId) {
  if (!agencyId) return [];
  const { data: ivs, error } = await supabase
    .from('interviews')
    .select('user_id, status, selected_slot, slots, updated_at')
    .eq('created_by', agencyId)
    .in('status', ['proposed', 'scheduled']);
  if (error) { console.warn('Mülakatlar okunamadı:', error.message); return []; }
  const ids = (ivs || []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality')
    .in('user_id', ids);
  const byId = {};
  (profs || []).forEach((p) => { byId[p.user_id] = p; });
  return (ivs || [])
    .filter((iv) => byId[iv.user_id])
    .map((iv) => {
      // Sıralama/filtre için "etkin tarih": planlandıysa seçilen slot; değilse ilk önerilen slot.
      const sortDate = iv.selected_slot || (Array.isArray(iv.slots) && iv.slots.length ? [...iv.slots].sort()[0] : iv.updated_at);
      return { ...byId[iv.user_id], ivStatus: iv.status, ivSlot: iv.selected_slot, ivSlots: iv.slots || [], ivSortDate: sortDate };
    });
}

// Süreçte: teklif gönderilmiş (kabul edilmiş, henüz personel olmamış) adaylar.
export async function listInProcess(agencyId) {
  if (!agencyId) return [];
  const { data: st, error } = await supabase
    .from('candidate_status')
    .select('user_id, stage')
    .eq('accepted_by', agencyId)
    .eq('status', 'accepted');
  if (error) { console.warn('Süreçtekiler okunamadı:', error.message); return []; }
  const ids = (st || []).map((r) => r.user_id);
  if (!ids.length) return [];
  const stageById = {};
  (st || []).forEach((r) => { stageById[r.user_id] = r.stage; });
  const { data: profs } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality')
    .in('user_id', ids);
  return (profs || []).map((p) => ({ ...p, stage: stageById[p.user_id] }));
}

// Acente: sonuçlanan görüşmede adayı reddet (kibar bildirim + havuzda kalır). RPC.
export async function declineInterview(candidateUserId) {
  const { error } = await supabase.rpc('decline_interview', { p_candidate: candidateUserId });
  if (error) throw error;
}

// Acentenin personeli (işe aldıkları). Döner: [{ ...candidate, work_end_at }]
export async function listStaff(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('candidate_hired')
    .select('user_id, title, data, reg_no, nationality, work_end_at')
    .eq('accepted_by', agencyId);
  if (error) { console.warn('Personel okunamadı:', error.message); return []; }
  return data || [];
}

// user_id'den tek adayı getir (bildirim yönlendirmesi için). Bulamazsa null.
export async function getCandidateById(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.warn('Aday (id) bulunamadı:', error.message); return null; }
  return data;
}

// Aday No'dan (uyruk + reg_no) tek aday bul. Bulamazsa null.
export async function findCandidateByCode(nationality, regNo) {
  const { data, error } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality')
    .eq('nationality', nationality)
    .eq('reg_no', regNo)
    .maybeSingle();
  if (error) {
    console.warn('Koda göre aday bulunamadı:', error.message);
    return null;
  }
  return data;
}

// Adayın KENDİ belge yüklediği user_id kümesi (acenta belgeleri sayılmaz) -> "süreçte" kategorisi.
const CANDIDATE_DOC_KINDS = ['passport', 'diploma', 'criminal', 'contract_signed', 'consulate_ref', 'work_permit'];
export async function listCandidatesWithDocs() {
  const { data, error } = await supabase.from('user_documents').select('user_id').in('kind', CANDIDATE_DOC_KINDS).not('submitted_at', 'is', null);
  if (error) {
    console.warn('Belge sahibi adaylar okunamadı:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.user_id));
}

// Adayların kabul/aşama durumları (user_id -> satır).
export async function listStatuses() {
  const { data, error } = await supabase.from('candidate_status').select('user_id, docs_unlocked, stage, status');
  if (error) {
    console.warn('Durumlar okunamadı:', error.message);
    return {};
  }
  const map = {};
  (data || []).forEach((r) => { map[r.user_id] = r; });
  return map;
}

// Acente: TEKLİF gönder. status='offered' (belgeler KİLİTLİ; aday cevaplayana kadar bekler).
export async function offerCandidate(candidateUserId) {
  const { error } = await supabase.rpc('offer_candidate', { p_candidate: candidateUserId });
  if (error) throw error;
}

// Aday: bekleyen teklifi KABUL et (belgeler açılır, Süreçte'ye düşer, acenteye bildirim).
export async function acceptOffer() {
  const { error } = await supabase.rpc('accept_offer');
  if (error) throw error;
}

// Aday: bekleyen teklifi REDDET (havuza döner, acenteye bildirim).
export async function rejectOffer() {
  const { error } = await supabase.rpc('reject_offer');
  if (error) throw error;
}

// Adayı kabul et: belge yüklemeyi aç (stage 1).  (Eski doğrudan kabul — teklif akışında offerCandidate kullanılır.)
export async function acceptCandidate(candidateUserId, agencyUserId) {
  const { error } = await supabase.from('candidate_status').upsert(
    {
      user_id: candidateUserId,
      docs_unlocked: true,
      stage: 1,
      status: 'accepted',
      accepted_by: agencyUserId || null,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

// Teklifi geri çek: adayı başa döndür (belge yükleme kilitlenir).
// NOT: Adayın yüklediği belgeler ayrıca removeAllDocuments ile silinir (KVKK + temiz sıfırlama).
export async function withdrawCandidate(candidateUserId) {
  const { error } = await supabase.from('candidate_status').update(
    {
      docs_unlocked: false,
      stage: 0,
      status: 'pending',
      accepted_by: null,
      accepted_at: null,
      updated_at: new Date().toISOString(),
    },
  ).eq('user_id', candidateUserId);
  if (error) throw error;
}
