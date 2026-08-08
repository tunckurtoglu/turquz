// Web veri katmanı — mobil lib/roles & lib/auth ile AYNI sorgular/RPC'ler (aynı DB).
import { supabase } from './supabase';

// ---- Oturum / rol ----
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}
export async function signUp(email, password, { portal = 'agency' } = {}) {
  const p = portal === 'agency' ? 'agency' : 'candidate';
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { portal: p } },
  });
  if (error) throw error;
  return data;
}
export async function signOut() { await supabase.auth.signOut(); }

export async function sendPasswordReset(email) {
  const redirectTo = `${window.location.origin}${window.location.pathname || '/'}`;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function registerAsAgency() {
  const { data, error } = await supabase.rpc('register_as_agency');
  if (error) throw error;
  return data;
}

export async function registerAsCandidate() {
  const { data, error } = await supabase.rpc('register_as_candidate');
  if (error) throw error;
  return data;
}

export async function isAgencySetupComplete(userId) {
  if (!userId) return false;
  const { data, error } = await supabase.rpc('is_agency_setup_complete', { p_user: userId });
  if (error) { console.warn(error.message); return false; }
  return !!data;
}

export async function getAgencyProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('agency_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    companyName: data.company_name || '',
    contactFirstName: data.contact_first_name || '',
    contactLastName: data.contact_last_name || '',
    phoneAuthorized: data.phone_authorized || '',
    phoneRep: data.phone_rep || '',
    taxPlatePath: data.tax_plate_path || '',
    completedAt: data.completed_at || null,
  };
}

export async function uploadAgencyTaxPlate(userId, file) {
  if (!userId || !file) throw new Error('missing');
  const path = `${userId}/vergi_levhasi.pdf`;
  const { error } = await supabase.storage.from('agency-docs').upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
  return path;
}

export async function completeAgencySetup(userId, fields) {
  const first = (fields.contactFirstName || '').trim();
  const last = (fields.contactLastName || '').trim();
  const p1 = (fields.phoneAuthorized || '').trim();
  const p2 = (fields.phoneRep || '').trim();
  const tax = (fields.taxPlatePath || '').trim();
  if (!first || !last || !p1 || !p2 || !tax) throw new Error('incomplete');
  const row = {
    user_id: userId,
    company_name: (fields.companyName || '').trim() || null,
    contact_first_name: first,
    contact_last_name: last,
    phone_authorized: p1,
    phone_rep: p2,
    tax_plate_path: tax,
    tax_plate_mime: 'application/pdf',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('agency_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
  const { data, error: uErr } = await supabase.auth.updateUser({
    data: { first_name: first, last_name: last, phone: p1, phone_rep: p2, full_name: `${first} ${last}`.trim(), agency_setup_complete: true },
  });
  if (uErr) throw uErr;
  return data.user;
}

// Acentenin kendi ad/soyad/telefon bilgisini auth metadata'sına yazar (eski düzenle modalı).
export async function updateMyProfile({ firstName, lastName, phone }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const { data, error } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName, phone, full_name: fullName },
  });
  if (error) throw error;
  return data.user;
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}
export function onAuthChange(cb) {
  // cb(session, event)
  return supabase.auth.onAuthStateChange((event, session) => cb(session, event)).data.subscription;
}
export async function getRole(userId) {
  if (!userId) return 'candidate';
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role || 'candidate';
}

// ---- Aday havuzu ----
// candidate_pool (PII ayıklanmış görünüm) + candidate_status birleştirilir.
export async function listPool() {
  const [{ data: cands, error: e1 }, { data: statuses }] = await Promise.all([
    supabase.from('candidate_pool').select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at').order('last_seen_at', { ascending: false, nullsFirst: false }),
    supabase.from('candidate_status').select('user_id, docs_unlocked, stage, status'),
  ]);
  if (e1) throw e1;
  const byId = {};
  (statuses || []).forEach((s) => { byId[s.user_id] = s; });
  return (cands || []).map((c) => ({ ...c, st: byId[c.user_id] || null }));
}

export async function getCandidate(userId) {
  const { data } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

export async function getCandidateStatus(userId) {
  const { data } = await supabase.from('candidate_status').select('user_id, docs_unlocked, stage, status').eq('user_id', userId).maybeSingle();
  return data || null;
}

/** Acente: mülakatı olan adaylar (proposed / scheduled). */
export async function listInterviewCandidates(agencyId) {
  if (!agencyId) return [];
  const { data: ivs, error } = await supabase
    .from('interviews')
    .select('user_id, status, selected_slot, slots, updated_at, call_extra_secs')
    .eq('created_by', agencyId)
    .in('status', ['proposed', 'scheduled']);
  if (error) { console.warn('Mülakatlar okunamadı:', error.message); return []; }
  const ids = (ivs || []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase
    .from('candidate_pool')
    .select('user_id, title, data, reg_no, nationality, updated_at, last_seen_at')
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
      const sortDate = iv.selected_slot || (Array.isArray(iv.slots) && iv.slots.length ? [...iv.slots].sort()[0] : iv.updated_at);
      const peers = iv.selected_slot ? (slotPeerCount[iv.selected_slot] || 1) : 1;
      return {
        ...byId[iv.user_id],
        ivStatus: iv.status,
        ivSlot: iv.selected_slot,
        ivSlots: iv.slots || [],
        ivSortDate: sortDate,
        ivExtraSecs: Number(iv.call_extra_secs) || 0,
        ivMinutes: minutesFor(peers),
      };
    });
}

// ---- Teklif akışı (aynı RPC'ler) ----
export async function offerCandidate(userId) {
  const { error } = await supabase.rpc('offer_candidate', { p_candidate: userId });
  if (error) throw error;
}
export async function notifyOffer(candidateUserId, kind, agencyUserId) {
  try {
    await supabase.functions.invoke('notify-offer', { body: { candidateUserId, kind, agencyUserId } });
  } catch (e) { console.warn('teklif bildirimi:', e?.message); }
}
export async function removeAllDocuments(userId) {
  const { data: rows } = await supabase.from('user_documents').select('storage_path').eq('user_id', userId);
  const paths = (rows || []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from('documents').remove(paths);
  const { error } = await supabase.from('user_documents').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function deleteContract(userId) {
  const { error } = await supabase.from('contracts').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function deleteFlight(userId) {
  const { error } = await supabase.from('flights').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function cancelInterview(userId) {
  const { error } = await supabase.from('interviews').delete().eq('user_id', userId);
  if (error) throw error;
}

// Teklif/süreç geri çek: durum + belgeler + mülakat temizliği (mobil ile aynı).
export async function withdrawCandidate(userId) {
  await removeAllDocuments(userId).catch(() => {});
  await deleteContract(userId).catch(() => {});
  await deleteFlight(userId).catch(() => {});
  await cancelInterview(userId).catch(() => {});
  const { error } = await supabase
    .from('candidate_status')
    .update({
      status: 'new',
      docs_unlocked: false,
      stage: 0,
      accepted_by: null,
      accepted_at: null,
      offered_at: null,
      hired_at: null,
      work_end_at: null,
      docs_deadline_notified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function endEmployment(userId) {
  const { error } = await supabase.rpc('agency_end_employment', { p_candidate: userId });
  if (error) throw error;
}

// ---- Belgeler (aynı tablolar/storage) ----
export async function listDocuments(userId) {
  if (!userId) return [];
  const { data } = await supabase.from('user_documents').select('*').eq('user_id', userId);
  return data || [];
}
export async function getSignedUrl(path, expires = 300) {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expires);
  if (error) throw error;
  return data?.signedUrl || null;
}
export async function requestReupload(candidateUserId, kind) {
  const { error } = await supabase.rpc('request_reupload', { p_candidate: candidateUserId, p_kind: kind });
  if (error) throw error;
}
export async function notifyDocument(candidateUserId, kind) {
  try { await supabase.functions.invoke('notify-document', { body: { candidateUserId, kind } }); } catch (e) { console.warn('bildirim:', e?.message); }
}
export async function notifyDocumentSubmit(candidateUserId, kinds) {
  if (!kinds?.length) return;
  const kind = kinds.length > 1 ? 'document_package' : kinds[0];
  await notifyDocument(candidateUserId, kind);
}
export async function scanDocsDeadline() {
  try { await supabase.functions.invoke('notify-docs-deadline', { body: { scan: true } }); } catch (e) { console.warn('belge süresi taraması:', e?.message); }
}
export async function scanInterviewReminders() {
  try { await supabase.functions.invoke('notify-interview-reminders', { body: { scan: true } }); } catch (e) { console.warn('mülakat hatırlatma taraması:', e?.message); }
}
export async function scanInterviewSla() {
  try { await supabase.functions.invoke('notify-interview-sla', { body: { scan: true } }); } catch (e) { console.warn('mülakat SLA taraması:', e?.message); }
}

// CV PDF'ini KENDİ PDF servisimizde üret (pdf-server -> gerçek Chrome/Puppeteer).
// Adres web/.env'deki VITE_PDF_URL'den gelir (varsayılan lokal). Binary döndüğü için fetch + blob.
export async function buildCvPdfServer(printableHtml, filename) {
  const base = import.meta.env.VITE_PDF_URL || 'http://localhost:8787';
  const token = import.meta.env.VITE_PDF_TOKEN;
  const resp = await fetch(`${base.replace(/\/$/, '')}/cv-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ html: printableHtml, filename }),
  });
  if (!resp.ok) {
    let msg = 'PDF üretilemedi';
    try { msg = (await resp.json())?.error || msg; } catch { /* binary/boş gövde */ }
    throw new Error(msg);
  }
  return await resp.blob();
}

// ---- Belge yükleme/gönderme (acente; aynı tablolar/storage) ----
function b64decode(b64) {
  const bin = atob(b64); const len = bin.length; const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
export async function uploadDocument(userId, kind, base64, mimeType) {
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${kind}_${Date.now()}.${ext}`;
  const { data: prev } = await supabase.from('user_documents').select('storage_path').eq('user_id', userId).eq('kind', kind).maybeSingle();
  const { error: upErr } = await supabase.storage.from('documents').upload(path, b64decode(base64), { contentType: mimeType, upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('user_documents')
    .upsert({ user_id: userId, kind, storage_path: path, mime_type: mimeType, status: 'uploaded', submitted_at: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,kind' })
    .select().single();
  if (error) throw error;
  if (prev?.storage_path && prev.storage_path !== path) supabase.storage.from('documents').remove([prev.storage_path]).catch(() => {});
  return data;
}
export async function submitDocuments(userId, kinds) {
  if (!userId || !kinds?.length) return [];
  const { data, error } = await supabase.from('user_documents').update({ submitted_at: new Date().toISOString() }).eq('user_id', userId).in('kind', kinds).select();
  if (error) throw error;
  return data || [];
}
export async function removeDocument(userId, kind) {
  const { data: prev } = await supabase.from('user_documents').select('storage_path').eq('user_id', userId).eq('kind', kind).maybeSingle();
  await supabase.from('user_documents').delete().eq('user_id', userId).eq('kind', kind);
  if (prev?.storage_path) supabase.storage.from('documents').remove([prev.storage_path]).catch(() => {});
}

// ---- Sözleşme ----
function contractToRow(f, agencyId) {
  return { title: f.title || null, address: f.address || null, phone: f.phone || null, email: f.email || null,
    contact_phone: f.contactPhone || null, contact_email: f.contactEmail || null, position: f.position || null,
    salary: f.salary || null, consulate: f.consulate || null, issue_date: f.issueDate || null,
    created_by: agencyId || null, updated_at: new Date().toISOString() };
}
function contractFromRow(r) {
  if (!r) return null;
  const paymentStatus = r.payment_status || 'unpaid';
  return {
    title: r.title || '', address: r.address || '', phone: r.phone || '', email: r.email || '',
    contactPhone: r.contact_phone || '', contactEmail: r.contact_email || '', position: r.position || '',
    salary: r.salary || '', consulate: r.consulate || '', issueDate: r.issue_date || '',
    paymentStatus,
    paidAt: r.paid_at || null,
    isPaid: paymentStatus === 'paid' || paymentStatus === 'waived',
  };
}
export async function getContract(candidateUserId) {
  const { data } = await supabase.from('contracts').select('*').eq('user_id', candidateUserId).maybeSingle();
  return contractFromRow(data);
}
export async function saveContract(candidateUserId, fields, agencyId) {
  const row = { user_id: candidateUserId, ...contractToRow(fields, agencyId) };
  const { error } = await supabase.from('contracts').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}
// Sözleşme için adayın özel alanları (passportNo, aile, adres) — süreçteki adayda RPC ile gelir.
export async function getCandidateContractFields(userId) {
  const { data, error } = await supabase.rpc('get_candidate_contract_fields', { p_user: userId });
  if (error) { console.warn(error.message); return null; }
  return data || null;
}

// ---- E-imza (işletme imzası + denetim) ----
export async function getMySignature() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id; if (!uid) return null;
  const { data } = await supabase.from('business_signatures').select('image_data, signer_name, signer_title').eq('user_id', uid).maybeSingle();
  if (!data) return null;
  return { image: data.image_data, signerName: data.signer_name, signerTitle: data.signer_title || '' };
}
export async function saveMySignature({ image, signerName, signerTitle }) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id; if (!uid) throw new Error('Oturum yok');
  const { error } = await supabase.from('business_signatures').upsert(
    { user_id: uid, image_data: image, signer_name: (signerName || '').trim(), signer_title: (signerTitle || '').trim() || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' });
  if (error) throw error;
}
export async function logContractSignature({ candidateUserId, signerName, signerTitle, docNo, docHash, platform }) {
  const { data, error } = await supabase.from('contract_signature_log')
    .insert({ candidate_user_id: candidateUserId, signer_name: signerName, signer_title: signerTitle || null, doc_no: docNo || null, doc_hash: docHash, platform: platform || 'web' })
    .select('id, signed_at').single();
  if (error) throw error;
  return data;
}
export async function getLatestContractSignature(candidateUserId) {
  const { data } = await supabase.from('contract_signature_log').select('id, signed_at, doc_hash, signer_name, signer_title')
    .eq('candidate_user_id', candidateUserId).order('signed_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

// ---- Bildirimler (aynı tablo) ----
export async function listNotifications(userId, limit = 25) {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, ref_user, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}
export async function unreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return count || 0;
}
export async function markAllRead(userId) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
}

// ---- Uçuşlar (karşılama/varış raporu) ----
export async function listFlights() {
  const { data } = await supabase.from('flights')
    .select('user_id, from_city, from_airport, to_city, to_airport, depart_at, arrive_at, flight_no, terminal, airline');
  return data || [];
}

// ---- Havaalanı karşılama (pickup) ----
export async function getPickup(userId) {
  const { data } = await supabase.from('flights').select('pickup_name, pickup_phone, pickup_sent_at').eq('user_id', userId).maybeSingle();
  return { pickupName: data?.pickup_name || '', pickupPhone: data?.pickup_phone || '', pickupSent: !!data?.pickup_sent_at };
}
export async function savePickup(userId, { pickupName, pickupPhone }, agencyId) {
  const { error } = await supabase.from('flights').upsert(
    { user_id: userId, pickup_name: pickupName || null, pickup_phone: pickupPhone || null, created_by: agencyId || null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' });
  if (error) throw error;
}
export async function sendPickup(userId) {
  const { error } = await supabase.from('flights').update({ pickup_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) throw error;
}

// ---- CV serbest metin çevirisi (Gemini, DB önbellekli) ----
export {
  extractCvFields, hasCvFreeText, applyCvTranslation, translateCvFields, translateCvInline,
} from '../../../lib/cvTranslate';

// Durum kategorisi: havuzda | teklifli | süreçte | personel
export function categoryOf(st) {
  if (!st) return 'pool';
  if (st.status === 'hired') return 'hired';
  if (st.docs_unlocked || st.status === 'accepted') return 'process';
  if (st.status === 'offered') return 'offered';
  return 'pool';
}
