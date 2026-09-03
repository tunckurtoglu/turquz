// lib/roles.js
// Roller + acente paneli veri erişimi. Bkz. supabase/migrations/0007_roles_agency.sql
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { parseCode } from './candidateCode';
import { matchesCandidateQuery, toCyrillicGuess, foldSearch } from './candidateSearch';

const ROLE_CACHE_KEY = (userId) => `turquz:role:${userId}`;
const VALID_ROLES = new Set(['candidate', 'agency', 'admin', 'hotel']);

export async function loadCachedRole(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(ROLE_CACHE_KEY(userId));
    if (VALID_ROLES.has(raw)) return raw;
  } catch (e) {
    console.warn('[role] cache okunamadı:', e?.message);
  }
  return null;
}

export async function cacheRole(userId, role) {
  if (!userId || !VALID_ROLES.has(role)) return;
  try {
    await AsyncStorage.setItem(ROLE_CACHE_KEY(userId), role);
  } catch (e) {
    console.warn('[role] cache yazılamadı:', e?.message);
  }
}

export async function clearCachedRole(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(ROLE_CACHE_KEY(userId));
  } catch (e) {
    console.warn('[role] cache silinemedi:', e?.message);
  }
}

/**
 * Rolü DB’den oku; başarıda cache’le.
 * Ağ/RLS hatasında cache’e düş (acente → yanlışlıkla aday paneli olmasın).
 * Cache de yoksa role=null, uncertain=true.
 */
export async function resolveRole(userId) {
  if (!userId) return { role: 'candidate', source: 'default', uncertain: false };
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[role] okunamadı:', error.message);
    const cached = await loadCachedRole(userId);
    if (cached) {
      console.log('[role] cache kullanıldı:', cached);
      return { role: cached, source: 'cache', uncertain: false, error: error.message };
    }
    return { role: null, source: 'error', uncertain: true, error: error.message };
  }
  const role = VALID_ROLES.has(data?.role) ? data.role : 'candidate';
  await cacheRole(userId, role);
  console.log('[role] tespit edilen:', role);
  return { role, source: 'db', uncertain: false };
}

/** Geriye uyumlu: string rol. Belirsizse cache yoksa 'candidate' DEĞİL — null. */
export async function getRole(userId) {
  const r = await resolveRole(userId);
  return r.role;
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
  if (f.employmentStatus) q = q.eq('employment_status', f.employmentStatus);
  if (f.availableMonths && f.availableMonths.length) q = q.in('work_availability', f.availableMonths);
  if (f.turquzCertified) q = q.eq('turquz_certified', true);
  const thisYear = new Date().getFullYear();
  if (f.ageMax) q = q.gte('birth_year', thisYear - f.ageMax);
  if (f.ageMin) q = q.lte('birth_year', thisYear - f.ageMin);
  return q;
}

/** sort: 'online' | 'online_old' — son görünürlük yeniden eskiye / eskiden yeniye */
export async function listCandidates({ from = 0, to = 23, filters = {}, sort = 'online' } = {}) {
  const ascending = sort === 'online_old';
  let q = supabase
    .from('candidate_pool') // acente/admin gizli + PII ayıklanmış görünüm
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at, turquz_certified')
    .order('last_seen_at', { ascending, nullsFirst: false })
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
    .select('user_id, status, selected_slot, slots, employer_id, updated_at, created_at, respond_by, call_extra_secs')
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
  const slotPeerCount = {};
  (ivs || []).forEach((iv) => {
    if (iv.status === 'scheduled' && iv.selected_slot) {
      slotPeerCount[iv.selected_slot] = (slotPeerCount[iv.selected_slot] || 0) + 1;
    }
  });
  const minutesFor = (n) => (n >= 3 ? 25 : n === 2 ? 20 : 10);
  return (ivs || [])
    .filter((iv) => byId[iv.user_id])
    .map((iv) => {
      // Sıralama/filtre için "etkin tarih": planlandıysa seçilen slot; değilse ilk önerilen slot.
      const sortDate = iv.selected_slot || (Array.isArray(iv.slots) && iv.slots.length ? [...iv.slots].sort()[0] : iv.updated_at);
      const peers = iv.selected_slot ? (slotPeerCount[iv.selected_slot] || 1) : 1;
      return {
        ...byId[iv.user_id],
        ivStatus: iv.status,
        ivSlot: iv.selected_slot,
        ivSlots: iv.slots || [],
        ivEmployerId: iv.employer_id || null,
        ivSortDate: sortDate,
        ivExtraSecs: Number(iv.call_extra_secs) || 0,
        ivMinutes: minutesFor(peers),
        ivCreatedAt: iv.created_at,
        ivRespondBy: iv.respond_by,
      };
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
  const baseSelect = 'user_id, title, data, reg_no, nationality, work_end_at';
  let { data, error } = await supabase
    .from('candidate_hired')
    .select(`${baseSelect}, airport_check_status, airport_check_answered_at`)
    .eq('accepted_by', agencyId);
  if (error) {
    ({ data, error } = await supabase
      .from('candidate_hired')
      .select(baseSelect)
      .eq('accepted_by', agencyId));
  }
  if (error) { console.warn('Personel okunamadı:', error.message); return []; }
  return data || [];
}

/** Yolda / işe başlama onayı bekleyen (in_transit). */
export async function listInTransit(agencyId) {
  if (!agencyId) return [];
  const baseSelect = 'user_id, title, data, reg_no, nationality, work_start_at, flight_depart_on, planned_end_on, boarding_status, work_start_asked_at';
  const airportSelect = `${baseSelect}, airport_check_status, airport_check_asked_at, airport_check_answered_at, airport_check_last_answer`;
  let { data, error } = await supabase
    .from('candidate_in_transit')
    .select(airportSelect)
    .eq('accepted_by', agencyId);
  if (error) {
    ({ data, error } = await supabase
      .from('candidate_in_transit')
      .select(baseSelect)
      .eq('accepted_by', agencyId));
  }
  if (error) { console.warn('Transit listesi okunamadı:', error.message); return []; }
  return data || [];
}

// user_id'den tek adayı getir (bildirim yönlendirmesi için). Bulamazsa null.
export async function getCandidateById(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.warn('Aday (id) bulunamadı:', error.message); return null; }
  if (data) return data;
  const { data: transit } = await supabase
    .from('candidate_in_transit')
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (transit) return transit;
  // Personeldeyse havuzda yok — chat bildirimi için hired görünümüne bak.
  const { data: hired } = await supabase
    .from('candidate_hired')
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at')
    .eq('user_id', userId)
    .maybeSingle();
  return hired || null;
}

// Aday No'dan (uyruk + reg_no) tek aday bul. Havuzda yoksa yolda/personel görünümüne bak.
export async function findCandidateByCode(nationality, regNo) {
  const sel = 'user_id, title, data, reg_no, nationality, updated_at, last_seen_at, turquz_certified';
  const tryView = async (view) => {
    const { data, error } = await supabase
      .from(view)
      .select(sel)
      .eq('nationality', nationality)
      .eq('reg_no', regNo)
      .maybeSingle();
    if (error) {
      console.warn(`Koda göre aday (${view}):`, error.message);
      return null;
    }
    return data;
  };
  return (await tryView('candidate_pool'))
    || (await tryView('candidate_in_transit'))
    || (await tryView('candidate_hired'));
}

const POOL_SEARCH_SEL = 'user_id, title, data, reg_no, nationality, updated_at, last_seen_at, turquz_certified';

function uniqSearchRows(rows, term) {
  const seen = new Set();
  const out = [];
  (rows || []).forEach((row) => {
    if (!row?.user_id || seen.has(row.user_id) || !matchesCandidateQuery(row, term)) return;
    seen.add(row.user_id);
    out.push(row);
  });
  return out.slice(0, 40);
}

async function findCandidatesByNameFallback(term) {
  const safe = String(term || '').replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (foldSearch(safe).length < 1) return [];
  const primary = safe.split(/\s+/).filter(Boolean)[0] || '';
  const cyr = toCyrillicGuess(primary);
  const variants = [...new Set([
    primary,
    primary.toLocaleLowerCase('tr'),
    foldSearch(primary),
    cyr,
  ].filter((s) => s && s.length >= 1))];

  const orParts = [];
  variants.forEach((v) => {
    const pat = `%${v}%`;
    orParts.push(
      `data->>firstName.ilike.${pat}`,
      `data->>lastName.ilike.${pat}`,
      `data->>passportFirstName.ilike.${pat}`,
      `data->>passportLastName.ilike.${pat}`,
      `title.ilike.${pat}`,
    );
  });

  const { data, error } = await supabase
    .from('candidate_pool')
    .select(POOL_SEARCH_SEL)
    .or(orParts.join(','))
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .limit(48);
  if (error) {
    console.warn('İsme göre aday aranamadı:', error.message);
    return [];
  }
  return uniqSearchRows(data, term);
}

/**
 * Kod veya isim ile ara — her zaman dizi (profil açılmaz; UI listeler).
 * İsim: yazıldıkça parça/önek; Latin kart adı + Kiril kayıt.
 */
export async function findCandidatesByName(term) {
  const q = String(term || '').trim();
  if (q.length < 1) return [];

  const parsed = parseCode(q);
  if (parsed) {
    const row = await findCandidateByCode(parsed.nationality, parsed.regNo);
    return row ? [row] : [];
  }

  if (foldSearch(q).length < 1) return [];

  const { data, error } = await supabase.rpc('search_candidate_pool', { p_q: q });
  if (!error && Array.isArray(data)) return uniqSearchRows(data, q);
  if (error) console.warn('search_candidate_pool:', error.message);

  return findCandidatesByNameFallback(q);
}

// Sözleşme için adayın özel alanları (passportNo, doğum yeri, adres, aile). Havuz görünümü
// bunları gizler; süreçteki adayda RPC ile gelir. Yetki/eşleşme yoksa null döner.
export async function getCandidateContractFields(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_candidate_contract_fields', { p_user: userId });
  if (error) { console.warn('Sözleşme alanları okunamadı:', error.message); return null; }
  return data || null; // { passportNo, birthPlace, location, family } | null
}

// Sözleşme ödemesi (paid/waived) sonrası CV’de açılacak PII. Aksi halde null.
export async function getCandidateCvReveal(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc('get_candidate_cv_reveal', { p_user: userId });
  if (error) { console.warn('CV açma alanları okunamadı:', error.message); return null; }
  return data || null;
}

// Adayın KENDİ belge yüklediği user_id kümesi (acenta belgeleri sayılmaz) -> "süreçte" kategorisi.
const CANDIDATE_DOC_KINDS = ['passport', 'diploma', 'criminal', 'health_report', 'contract_signed', 'consulate_ref', 'work_permit'];
export async function listCandidatesWithDocs() {
  const { data, error } = await supabase.from('user_documents').select('user_id').in('kind', CANDIDATE_DOC_KINDS).not('submitted_at', 'is', null);
  if (error) {
    console.warn('Belge sahibi adaylar okunamadı:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.user_id));
}

// Adayların kabul/aşama durumları (user_id -> satır).
// Tüm tabloyu çekmek admin/büyük veride OOM + giriş sonrası çökme yapıyordu.
// agencyUserId: bu acenteye bağlı satırlar; forUserIds: havuzdaki görünür adaylar.
export async function listStatuses(agencyUserId, { forUserIds } = {}) {
  const map = {};
  const sel = 'user_id, docs_unlocked, stage, status, accepted_by, offered_at, offer_employer_id, docs_deadline_at, boarding_status, flight_depart_on';

  if (agencyUserId) {
    const { data, error } = await supabase
      .from('candidate_status')
      .select(sel)
      .eq('accepted_by', agencyUserId);
    if (error) console.warn('Durumlar okunamadı:', error.message);
    else (data || []).forEach((r) => { map[r.user_id] = r; });
  }

  const extra = [...new Set((forUserIds || []).filter((id) => id && !map[id]))].slice(0, 80);
  if (extra.length) {
    const { data, error } = await supabase
      .from('candidate_status')
      .select(sel)
      .in('user_id', extra);
    if (error) console.warn('Durumlar (havuz) okunamadı:', error.message);
    else (data || []).forEach((r) => { map[r.user_id] = r; });
  }

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
export async function withdrawCandidate(candidateUserId, reason = 'agency_cancel', note = null) {
  // Tercihen RPC: DB temizliği + ispat log. Yoksa eski yol.
  try {
    const { error } = await supabase.rpc('agency_end_process', {
      p_candidate: candidateUserId,
      p_reason: reason,
      p_note: note,
    });
    if (!error) return;
    if (!/agency_end_process|schema cache|PGRST202|does not exist/i.test(`${error.message || ''} ${error.code || ''}`)) {
      throw error;
    }
  } catch (e) {
    if (!/agency_end_process|schema cache|PGRST202|does not exist/i.test(`${e?.message || ''} ${e?.code || ''}`)) {
      throw e;
    }
  }

  try {
    await supabase.rpc('close_process_chat', { p_candidate: candidateUserId });
  } catch (e) {
    await supabase
      .from('process_chats')
      .update({ closed_at: new Date().toISOString() })
      .eq('candidate_id', candidateUserId)
      .is('closed_at', null);
  }
  const { error } = await supabase.from('candidate_status').update(
    {
      docs_unlocked: false,
      stage: 0,
      status: 'new',
      accepted_by: null,
      accepted_at: null,
      offered_at: null,
      hired_at: null,
      work_end_at: null,
      docs_deadline_notified_at: null,
      updated_at: new Date().toISOString(),
    },
  ).eq('user_id', candidateUserId);
  if (error) throw error;
}

// Personel sürecini sonlandır: aday havuza döner (RPC — geri alınamaz).
export async function endEmployment(candidateUserId) {
  const { requestEmploymentEnd } = await import('./employment');
  return requestEmploymentEnd(candidateUserId, null);
}
